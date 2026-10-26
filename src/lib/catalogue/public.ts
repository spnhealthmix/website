import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { ApiError } from "../api/http";
import { categories, productImages, productVariants, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { imageUrl } from "../storage/storage";
import type { ProductVariant } from "../storefront/types";
import type { PublicProductQuery } from "./validation";

/**
 * PUBLIC catalogue reads. Nothing here needs a signed-in customer, so nothing here may ever
 * return anything private. Two defences:
 *   1. Visibility is decided in ONE place (`visible`), used by every query.
 *   2. Output is built field by field (no spreading database rows), so an internal column
 *      added to a table later can't leak by accident.
 *
 * Prices and availability come from the database on every call. Short caching is applied by
 * the HTTP layer, and checkout re-reads everything inside its own transaction, so a cached
 * price is only ever a display price.
 */

export const LOW_STOCK_AT = 5;
export const MAX_QUANTITY = 99;

type Base = { imageBaseUrl?: string };

/**
 * A product is public if: the product is active and its category is active.
 * A product without configured variants remains visible in the catalogue with an unconfigured
 * commercial state rather than being omitted entirely.
 */
const visible = and(eq(products.isActive, true), eq(categories.isActive, true))!;

const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

const pct = (mrp: number, price: number) => (mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0);

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export async function listPublicCategories(db: AnyDb, o: Base) {
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      imageKey: categories.imageKey,
      // all active products in the category
      productCount: sql<number>`(select count(*)::int from products p
        where p.category_id = categories.id and p.is_active)`,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id));

  return {
    categories: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      productCount: r.productCount,
      image: r.imageKey ? { url: imageUrl(o.imageBaseUrl, r.imageKey)! } : null,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Product cards (list pages)                                                 */
/* -------------------------------------------------------------------------- */

function makeVariantStats(db: AnyDb) {
  return db
    .select({
      productId: productVariants.productId,
      fromPricePaise: sql<number | null>`min(${productVariants.pricePaise})::int`.as("from_price_paise"),
      toPricePaise: sql<number | null>`max(${productVariants.pricePaise})::int`.as("to_price_paise"),
      fromMrpPaise: sql<number | null>`(array_agg(${productVariants.mrpPaise} order by ${productVariants.pricePaise} asc, ${productVariants.id} asc))[1]::int`.as("from_mrp_paise"),
      sizeCount: sql<number>`count(*)::int`.as("size_count"),
      inStock: sql<boolean>`coalesce(bool_or(${productVariants.stock} > 0), false)`.as("in_stock"),
    })
    .from(productVariants)
    .where(eq(productVariants.isActive, true))
    .groupBy(productVariants.productId)
    .as("variant_stats");
}

function makePrimaryImages(db: AnyDb) {
  return db
    .select({
      productId: productImages.productId,
      r2Key: productImages.r2Key,
      alt: productImages.alt,
    })
    .from(productImages)
    .where(eq(productImages.isPrimary, true))
    .as("primary_images");
}

function cardColumns(
  vs: ReturnType<typeof makeVariantStats>,
  pi: ReturnType<typeof makePrimaryImages>,
) {
  return {
    id: products.id,
    slug: products.slug,
    name: products.name,
    shortDescription: products.shortDescription,
    isFeatured: products.isFeatured,
    categorySlug: categories.slug,
    categoryName: categories.name,
    fromPricePaise: vs.fromPricePaise,
    toPricePaise: vs.toPricePaise,
    fromMrpPaise: vs.fromMrpPaise,
    sizeCount: sql<number>`coalesce(${vs.sizeCount}, 0)::int`,
    inStock: sql<boolean>`coalesce(${vs.inStock}, false)`,
    imageKey: sql<string | null>`coalesce(${pi.r2Key}, (select i.r2_key from product_images i where i.product_id = products.id order by i.sort_order asc, i.id asc limit 1))`,
    imageAlt: sql<string | null>`coalesce(${pi.alt}, (select i.alt from product_images i where i.product_id = products.id order by i.sort_order asc, i.id asc limit 1))`,
  };
}

type CardRow = {
  id: string; slug: string; name: string; shortDescription: string | null; isFeatured: boolean;
  categorySlug: string; categoryName: string; fromPricePaise: number | null; toPricePaise: number | null; fromMrpPaise: number | null;
  sizeCount: number; inStock: boolean; imageKey: string | null; imageAlt: string | null;
};

function toCard(r: CardRow, o: Base, variants: ProductVariant[] = []) {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortDescription: r.shortDescription,
    isFeatured: r.isFeatured,
    category: { slug: r.categorySlug, name: r.categoryName },
    price: {
      fromPaise: r.fromPricePaise,
      toPaise: r.toPricePaise,
      fromMrpPaise: r.fromMrpPaise,
      discountPercent: r.fromMrpPaise !== null && r.fromPricePaise !== null ? pct(r.fromMrpPaise, r.fromPricePaise) : 0,
    },
    hasMultipleSizes: r.sizeCount > 1,
    inStock: r.inStock,
    image: r.imageKey ? { url: imageUrl(o.imageBaseUrl, r.imageKey)!, alt: r.imageAlt } : null,
    variants,
  };
}

/** Sort orders. Every one ends in products.id so paging is stable (no repeats or gaps). */
function orderFor(
  sort: NonNullable<PublicProductQuery["sort"]>,
  q: string | undefined,
  fromPricePaise?: any,
): SQL[] {
  const priceCol = fromPricePaise ?? sql<number | null>`(select min(v.price_paise) from product_variants v where v.product_id = products.id and v.is_active)`;
  switch (sort) {
    case "price_asc": return [asc(sql`coalesce(${priceCol}, 2147483647)`), asc(products.name), asc(products.id)];
    case "price_desc": return [desc(sql`coalesce(${priceCol}, 0)`), asc(products.name), asc(products.id)];
    case "newest": return [desc(products.createdAt), asc(products.id)];
    case "name": return [asc(products.name), asc(products.id)];
    case "relevance": {
      const s = q ?? "";
      return [
        asc(sql`case when lower(products.name) = lower(${s}) then 0
                     when products.name ilike ${like(s).slice(1)} then 1
                     when products.name ilike ${like(s)} then 2
                     else 3 end`),
        desc(products.isFeatured), asc(products.name), asc(products.id),
      ];
    }
    default: // "featured": featured first, then the shop's own category/product ordering
      return [desc(products.isFeatured), asc(categories.sortOrder), asc(products.sortOrder), asc(products.name), asc(products.id)];
  }
}

/**
 * Search: every word (up to 5) must appear in the name, short description, ingredients or
 * category name, in any case, as a whole or partial word ("kavu" finds "Kavuni"). Wildcard
 * characters typed by the customer are matched literally. Sized for a catalogue of hundreds
 * of products; thousands would warrant a dedicated search index.
 */
function searchCondition(q: string): SQL[] {
  return q
    .split(" ")
    .filter(Boolean)
    .slice(0, 5)
    .map(
      (term) =>
        or(
          ilike(products.name, like(term)),
          ilike(products.shortDescription, like(term)),
          ilike(products.ingredients, like(term)),
          ilike(categories.name, like(term)),
        )!,
    );
}

async function categoryIsPublic(db: AnyDb, slug: string) {
  const [c] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.slug, slug), eq(categories.isActive, true)));
  return Boolean(c);
}

export async function listPublicProducts(db: AnyDb, q: PublicProductQuery, o: Base) {
  const where: SQL[] = [visible];

  if (q.category) {
    if (!(await categoryIsPublic(db, q.category))) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    where.push(eq(categories.slug, q.category));
  }
  if (q.q) where.push(...searchCondition(q.q));
  if (q.featured) where.push(eq(products.isFeatured, true));
  if (q.inStock) where.push(sql`exists (select 1 from product_variants v where v.product_id = products.id and v.is_active and v.stock > 0)`);
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    // some purchasable size falls inside the range
    where.push(
      sql`exists (select 1 from product_variants v where v.product_id = products.id and v.is_active
            and v.price_paise >= ${q.minPrice ?? 0} and v.price_paise <= ${q.maxPrice ?? 2_147_483_647})`,
    );
  }
  const cond = and(...where);

  const sort = q.sort ?? (q.q ? "relevance" : "featured");

  const vs = makeVariantStats(db);
  const pi = makePrimaryImages(db);

  const rows = await db
    .select(cardColumns(vs, pi))
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(vs, eq(vs.productId, products.id))
    .leftJoin(pi, eq(pi.productId, products.id))
    .where(cond)
    .orderBy(...orderFor(sort, q.q, vs.fromPricePaise))
    .limit(q.limit)
    .offset(q.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(cond);

  const productIds = rows.map((r) => r.id);
  const allVariants = productIds.length > 0
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          label: productVariants.label,
          weightGrams: productVariants.weightGrams,
          mrpPaise: productVariants.mrpPaise,
          pricePaise: productVariants.pricePaise,
          stock: productVariants.stock,
        })
        .from(productVariants)
        .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true)))
        .orderBy(asc(productVariants.pricePaise), asc(productVariants.id))
    : [];

  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of allVariants) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      label: v.label,
      weightGrams: v.weightGrams,
      mrpPaise: v.mrpPaise,
      pricePaise: v.pricePaise,
      discountPercent: pct(v.mrpPaise, v.pricePaise),
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK_AT,
      maxQuantity: Math.max(0, Math.min(v.stock, MAX_QUANTITY)),
    });
    variantsByProduct.set(v.productId, list);
  }

  return {
    products: rows.map((r) => toCard(r, o, variantsByProduct.get(r.id) ?? [])),
    total,
    limit: q.limit,
    offset: q.offset,
    hasMore: q.offset + rows.length < total,
    sort,
  };
}

/* -------------------------------------------------------------------------- */
/* Product detail                                                             */
/* -------------------------------------------------------------------------- */

export const RELATED_COUNT = 4;

export async function getPublicProduct(db: AnyDb, slug: string, o: Base) {
  const [p] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      shortDescription: products.shortDescription,
      description: products.description,
      ingredients: products.ingredients,
      usage: products.usage,
      isFeatured: products.isFeatured,
      categoryId: categories.id,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), visible));
  if (!p) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");

  const variants = await db
    .select({
      id: productVariants.id,
      label: productVariants.label,
      weightGrams: productVariants.weightGrams,
      mrpPaise: productVariants.mrpPaise,
      pricePaise: productVariants.pricePaise,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, p.id), eq(productVariants.isActive, true)))
    .orderBy(asc(productVariants.pricePaise), asc(productVariants.id));

  const images = await db
    .select({ r2Key: productImages.r2Key, alt: productImages.alt, isPrimary: productImages.isPrimary })
    .from(productImages)
    .where(eq(productImages.productId, p.id))
    .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder), asc(productImages.id));

  const vs = makeVariantStats(db);
  const pi = makePrimaryImages(db);

  const relatedRows = await db
    .select(cardColumns(vs, pi))
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(vs, eq(vs.productId, products.id))
    .leftJoin(pi, eq(pi.productId, products.id))
    .where(and(visible, eq(products.categoryId, p.categoryId), ne(products.id, p.id)))
    .orderBy(...orderFor("featured", undefined, vs.fromPricePaise))
    .limit(RELATED_COUNT);

  const relatedIds = relatedRows.map((r) => r.id);
  const relatedVariants = relatedIds.length > 0
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          label: productVariants.label,
          weightGrams: productVariants.weightGrams,
          mrpPaise: productVariants.mrpPaise,
          pricePaise: productVariants.pricePaise,
          stock: productVariants.stock,
        })
        .from(productVariants)
        .where(and(inArray(productVariants.productId, relatedIds), eq(productVariants.isActive, true)))
        .orderBy(asc(productVariants.pricePaise), asc(productVariants.id))
    : [];

  const relatedVariantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of relatedVariants) {
    const list = relatedVariantsByProduct.get(v.productId) ?? [];
    list.push({
      id: v.id,
      label: v.label,
      weightGrams: v.weightGrams,
      mrpPaise: v.mrpPaise,
      pricePaise: v.pricePaise,
      discountPercent: pct(v.mrpPaise, v.pricePaise),
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK_AT,
      maxQuantity: Math.max(0, Math.min(v.stock, MAX_QUANTITY)),
    });
    relatedVariantsByProduct.set(v.productId, list);
  }

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    ingredients: p.ingredients,
    usage: p.usage,
    isFeatured: p.isFeatured,
    category: { slug: p.categorySlug, name: p.categoryName },
    inStock: variants.some((v) => v.stock > 0),
    variants: variants.map((v) => ({
      id: v.id, // what the cart takes
      label: v.label,
      weightGrams: v.weightGrams,
      mrpPaise: v.mrpPaise,
      pricePaise: v.pricePaise,
      discountPercent: pct(v.mrpPaise, v.pricePaise),
      inStock: v.stock > 0,
      lowStock: v.stock > 0 && v.stock <= LOW_STOCK_AT,
      maxQuantity: Math.max(0, Math.min(v.stock, MAX_QUANTITY)), // what can be ordered right now
    })),
    images: images.map((i) => ({ url: imageUrl(o.imageBaseUrl, i.r2Key)!, alt: i.alt, isPrimary: i.isPrimary })),
    related: relatedRows.map((r) => toCard(r, o, relatedVariantsByProduct.get(r.id) ?? [])),
  };
}
