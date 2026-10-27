import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { ApiError, violatedConstraint } from "../api/http";
import { categories, orderItems, productImages, productVariants, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { imageUrl } from "../storage/storage";
import { diff, writeAudit } from "./audit";
import { slugify } from "./slug";

type Base = { imageBaseUrl?: string };

const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
const notFound = (what: string, code: string) => new ApiError(404, code, `${what} not found.`);

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

type Category = typeof categories.$inferSelect;
const categoryView = (c: Category, base?: string, extra: object = {}) => ({
  id: c.id, slug: c.slug, name: c.name, description: c.description, sortOrder: c.sortOrder,
  isActive: c.isActive, imageKey: c.imageKey, imageUrl: imageUrl(base, c.imageKey), createdAt: c.createdAt, ...extra,
});

export async function listCategories(db: AnyDb, o: Base) {
  const rows = await db
    .select({ c: categories, productCount: sql<number>`(select count(*)::int from products p where p.category_id = categories.id)` })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
  return { categories: rows.map((r) => categoryView(r.c, o.imageBaseUrl, { productCount: r.productCount })) };
}

export async function getCategory(db: AnyDb, id: string, o: Base) {
  const [row] = await db
    .select({ c: categories, productCount: sql<number>`(select count(*)::int from products p where p.category_id = categories.id)` })
    .from(categories)
    .where(eq(categories.id, id));
  if (!row) throw notFound("Category", "CATEGORY_NOT_FOUND");
  return categoryView(row.c, o.imageBaseUrl, { productCount: row.productCount });
}

/** First free slug: base, base-2, base-3... */
async function freeSlug(db: AnyDb, table: typeof categories | typeof products, base: string, skipId?: string) {
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`.slice(0, 80);
    const [hit] = await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate));
    if (!hit || hit.id === skipId) return candidate;
  }
  throw new ApiError(409, "SLUG_TAKEN", "Could not find a free URL slug; provide one.");
}

function slugFor(name: string, explicit?: string) {
  const slug = explicit ?? slugify(name);
  if (!slug) {
    throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", {
      fields: {
        slug: "Could not make a URL slug from this name. Enter one using letters and digits.",
      },
    });
  }
  return slug;
}

export async function createCategory(
  db: AnyDb, adminId: string,
  input: { name: string; slug?: string; description?: string | null; sortOrder?: number; isActive?: boolean },
  o: Base,
) {
  const base = slugFor(input.name, input.slug);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.transaction(async (tx) => {
        const slug = input.slug ? base : await freeSlug(tx, categories, base);
        const [c] = await tx
          .insert(categories)
          .values({ slug, name: input.name, description: input.description ?? null, sortOrder: input.sortOrder ?? 0, isActive: input.isActive ?? true })
          .returning();
        await writeAudit(tx, { actorProfileId: adminId, action: "category.created", entityType: "category", entityId: c.id, details: { name: c.name, slug: c.slug } });
        return c;
      });
      return categoryView(created, o.imageBaseUrl, { productCount: 0 });
    } catch (err) {
      if (violatedConstraint(err) !== "categories_slug_uq") throw err;
      if (input.slug) throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", { slug: "Already in use" });
      // auto-generated slug lost a race: loop and pick the next free one
    }
  }
  throw new ApiError(409, "SLUG_TAKEN", "Could not find a free URL slug; provide one.");
}

export async function updateCategory(
  db: AnyDb, adminId: string, id: string,
  patch: { name?: string; slug?: string; description?: string | null; sortOrder?: number; isActive?: boolean },
  o: Base,
) {
  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(categories).where(eq(categories.id, id)).for("update");
      if (!before) throw notFound("Category", "CATEGORY_NOT_FOUND");
      await tx.update(categories).set(patch).where(eq(categories.id, id));
      await writeAudit(tx, { actorProfileId: adminId, action: "category.updated", entityType: "category", entityId: id, details: { changes: diff(before, patch) } });
    });
  } catch (err) {
    if (violatedConstraint(err) === "categories_slug_uq") throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", { slug: "Already in use" });
    throw err;
  }
  return getCategory(db, id, o);
}

/** Returns the image key to remove from storage after commit (if any). */
export async function deleteCategory(db: AnyDb, adminId: string, id: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(categories).where(eq(categories.id, id)).for("update");
    if (!c) throw notFound("Category", "CATEGORY_NOT_FOUND");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(products).where(eq(products.categoryId, id));
    if (n > 0) {
      throw new ApiError(409, "CATEGORY_NOT_EMPTY", `This category still has ${n} product${n === 1 ? "" : "s"}. Move or delete them, or deactivate the category instead.`);
    }
    await tx.delete(categories).where(eq(categories.id, id));
    await writeAudit(tx, { actorProfileId: adminId, action: "category.deleted", entityType: "category", entityId: id, details: { name: c.name, slug: c.slug } });
    return c.imageKey ? [c.imageKey] : [];
  });
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

type ProductInput = {
  categoryId: string; slug?: string; name: string; shortDescription?: string | null; description?: string | null;
  ingredients?: string | null; usage?: string | null; isActive?: boolean;
  isFeatured?: boolean; sortOrder?: number;
};

export async function listProducts(
  db: AnyDb,
  q: { q?: string; categoryId?: string; active?: boolean; limit: number; offset: number },
  o: Base,
) {
  const where: (SQL | undefined)[] = [];
  if (q.q) where.push(or(ilike(products.name, like(q.q)), ilike(products.slug, like(q.q)), sql`exists (select 1 from product_variants v where v.product_id = ${products.id} and v.sku ilike ${like(q.q)})`));
  if (q.categoryId) where.push(eq(products.categoryId, q.categoryId));
  if (q.active !== undefined) where.push(eq(products.isActive, q.active));
  const cond = and(...where);

  const rows = await db
    .select({
      id: products.id, slug: products.slug, name: products.name, isActive: products.isActive, isFeatured: products.isFeatured,
      sortOrder: products.sortOrder,
      createdAt: products.createdAt,
      category: { id: categories.id, name: categories.name, slug: categories.slug },
      variantCount: sql<number>`(select count(*)::int from product_variants v where v.product_id = ${products.id})`,
      minPricePaise: sql<number | null>`(select min(v.price_paise) from product_variants v where v.product_id = ${products.id} and v.is_active)`,
      maxPricePaise: sql<number | null>`(select max(v.price_paise) from product_variants v where v.product_id = ${products.id} and v.is_active)`,
      totalStock: sql<number>`(select coalesce(sum(v.stock), 0)::int from product_variants v where v.product_id = ${products.id})`,
      imageKey: sql<string | null>`(select i.r2_key from product_images i where i.product_id = ${products.id} order by i.is_primary desc, i.sort_order asc, i.id asc limit 1)`,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(cond)
    .orderBy(asc(categories.sortOrder), asc(products.sortOrder), asc(products.name))
    .limit(q.limit)
    .offset(q.offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(cond);

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${products.isActive})::int`,
      inactive: sql<number>`count(*) filter (where not ${products.isActive})::int`,
    })
    .from(products);

  const [{ categoriesCount }] = await db
    .select({ categoriesCount: sql<number>`count(*)::int` })
    .from(categories);

  return {
    products: rows.map((r) => ({ ...r, imageUrl: imageUrl(o.imageBaseUrl, r.imageKey) })),
    total,
    stats: {
      total: stats?.total ?? total,
      active: stats?.active ?? 0,
      inactive: stats?.inactive ?? 0,
      categoriesCount: categoriesCount ?? 0,
    },
    limit: q.limit,
    offset: q.offset,
  };
}

export async function getProduct(db: AnyDb, id: string, o: Base) {
  const [row] = await db
    .select({ p: products, category: { id: categories.id, name: categories.name, slug: categories.slug } })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id));
  if (!row) throw notFound("Product", "PRODUCT_NOT_FOUND");
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id)).orderBy(asc(productVariants.pricePaise), asc(productVariants.sku));
  const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder), asc(productImages.id));
  return {
    ...row.p,
    category: row.category,
    variants,
    images: images.map((i) => ({ ...i, key: i.r2Key, url: imageUrl(o.imageBaseUrl, i.r2Key) })),
  };
}

async function assertCategory(tx: AnyDb, categoryId: string) {
  const [c] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId));
  if (!c) throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", { fields: { categoryId: "Category does not exist" } });
}

export async function createProduct(db: AnyDb, adminId: string, input: ProductInput, o: Base) {
  const base = slugFor(input.name, input.slug);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const id = await db.transaction(async (tx) => {
        await assertCategory(tx, input.categoryId);
        const slug = input.slug ? base : await freeSlug(tx, products, base);

        // Determine sortOrder: If not explicitly specified (> 0), automatically assign
        // the next highest order in this category so the new product appears last.
        let finalSortOrder = input.sortOrder;
        if (finalSortOrder === undefined || finalSortOrder === 0) {
          const [{ maxOrder }] = await tx
            .select({
              maxOrder: sql<number>`coalesce(max(${products.sortOrder}), -1)::int`,
            })
            .from(products)
            .where(eq(products.categoryId, input.categoryId));
          finalSortOrder = maxOrder + 1;
        }

        const [p] = await tx
          .insert(products)
          .values({
            categoryId: input.categoryId, slug, name: input.name,
            shortDescription: input.shortDescription ?? null, description: input.description ?? null,
            ingredients: input.ingredients ?? null, usage: input.usage ?? null,
            isActive: input.isActive ?? true,
            isFeatured: input.isFeatured ?? false, sortOrder: finalSortOrder,
          })
          .returning({ id: products.id });
        await writeAudit(tx, { actorProfileId: adminId, action: "product.created", entityType: "product", entityId: p.id, details: { name: input.name, slug, categoryId: input.categoryId, sortOrder: finalSortOrder } });
        return p.id;
      });
      return getProduct(db, id, o);
    } catch (err) {
      if (violatedConstraint(err) !== "products_slug_uq") throw err;
      if (input.slug) throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", { fields: { slug: "Already in use" } });
    }
  }
  throw new ApiError(409, "SLUG_TAKEN", "Could not find a free URL slug; provide one.");
}

export async function updateProduct(db: AnyDb, adminId: string, id: string, patch: Partial<ProductInput>, o: Base) {
  try {
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(products).where(eq(products.id, id)).for("update");
      if (!before) throw notFound("Product", "PRODUCT_NOT_FOUND");
      if (patch.categoryId) await assertCategory(tx, patch.categoryId);
      await tx.update(products).set(patch).where(eq(products.id, id));
      await writeAudit(tx, { actorProfileId: adminId, action: "product.updated", entityType: "product", entityId: id, details: { changes: diff(before, patch) } });
    });
  } catch (err) {
    if (violatedConstraint(err) === "products_slug_uq") throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", { fields: { slug: "Already in use" } });
    throw err;
  }
  return getProduct(db, id, o);
}

/**
 * Hard delete is only for products that were never ordered. A product that has been sold
 * stays in the catalogue history: deactivate it instead (carts and the storefront then treat
 * it as unavailable). Returns the image keys to delete from storage after commit.
 */
export async function deleteProduct(db: AnyDb, adminId: string, id: string): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) throw notFound("Product", "PRODUCT_NOT_FOUND");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.productId, id));
    if (n > 0) throw new ApiError(409, "PRODUCT_HAS_ORDERS", "This product has been ordered before, so it can't be deleted. Deactivate it instead.");
    const images = await tx.select({ key: productImages.r2Key }).from(productImages).where(eq(productImages.productId, id));
    await tx.delete(products).where(eq(products.id, id)); // variants, images and cart lines go with it
    await writeAudit(tx, { actorProfileId: adminId, action: "product.deleted", entityType: "product", entityId: id, details: { name: p.name, slug: p.slug } });
    return images.map((i) => i.key);
  });
}

/* -------------------------------------------------------------------------- */
/* Variants (price, MRP, stock)                                               */
/* -------------------------------------------------------------------------- */

type VariantInput = { sku: string; label: string; weightGrams?: number | null; mrpPaise: number; pricePaise: number; stock?: number; isActive?: boolean };

const priceRule = (mrp: number, price: number) => {
  if (price > mrp) throw new ApiError(422, "VALIDATION_FAILED", "Some fields are invalid.", { pricePaise: "Selling price can't be higher than MRP" });
};
const skuTaken = () => new ApiError(409, "SKU_TAKEN", "That SKU is already used.", { sku: "Already in use" });

export async function createVariant(db: AnyDb, adminId: string, productId: string, input: VariantInput) {
  priceRule(input.mrpPaise, input.pricePaise);
  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
      if (!p) throw notFound("Product", "PRODUCT_NOT_FOUND");
      const [v] = await tx
        .insert(productVariants)
        .values({
          productId, sku: input.sku, label: input.label, weightGrams: input.weightGrams ?? null,
          mrpPaise: input.mrpPaise, pricePaise: input.pricePaise, stock: input.stock ?? 0, isActive: input.isActive ?? true,
        })
        .returning();
      await writeAudit(tx, { actorProfileId: adminId, action: "variant.created", entityType: "variant", entityId: v.id, details: { productId, sku: v.sku, label: v.label, mrpPaise: v.mrpPaise, pricePaise: v.pricePaise, stock: v.stock } });
      return v;
    });
  } catch (err) {
    if (violatedConstraint(err) === "product_variants_sku_uq") throw skuTaken();
    throw err;
  }
}

/**
 * `stock` sets an exact count (stocktake); `stockDelta` adds or removes units relative to
 * whatever the stock is NOW. Prefer stockDelta while the shop is live: customers buying at
 * the same moment can't be overwritten by it, and it can never push stock below zero.
 */
export async function updateVariant(
  db: AnyDb, adminId: string, variantId: string,
  patch: Partial<VariantInput> & { stockDelta?: number },
) {
  try {
    return await db.transaction(async (tx) => {
      const [before] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
      if (!before) throw notFound("Variant", "VARIANT_NOT_FOUND");

      priceRule(patch.mrpPaise ?? before.mrpPaise, patch.pricePaise ?? before.pricePaise);

      const { stockDelta, stock, ...rest } = patch;
      const set: Record<string, unknown> = { ...rest };
      if (stock !== undefined) set.stock = stock;
      if (stockDelta !== undefined) {
        if (before.stock + stockDelta < 0) {
          throw new ApiError(409, "STOCK_WOULD_GO_NEGATIVE", `Only ${before.stock} in stock; can't remove ${-stockDelta}.`, { stock: String(before.stock) });
        }
        set.stock = sql`${productVariants.stock} + ${stockDelta}`;
      }
      const [after] = await tx.update(productVariants).set(set).where(eq(productVariants.id, variantId)).returning();
      await writeAudit(tx, {
        actorProfileId: adminId, action: "variant.updated", entityType: "variant", entityId: variantId,
        details: { productId: before.productId, changes: diff(before, { ...rest, ...(stock !== undefined || stockDelta !== undefined ? { stock: after.stock } : {}) }), ...(stockDelta !== undefined ? { stockDelta } : {}) },
      });
      return after;
    });
  } catch (err) {
    if (violatedConstraint(err) === "product_variants_sku_uq") throw skuTaken();
    throw err;
  }
}

export async function deleteVariant(db: AnyDb, adminId: string, variantId: string) {
  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for("update");
    if (!v) throw notFound("Variant", "VARIANT_NOT_FOUND");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.variantId, variantId));
    if (n > 0) throw new ApiError(409, "VARIANT_HAS_ORDERS", "This variant has been ordered before, so it can't be deleted. Deactivate it instead.");
    await tx.delete(productVariants).where(eq(productVariants.id, variantId));
    await writeAudit(tx, { actorProfileId: adminId, action: "variant.deleted", entityType: "variant", entityId: variantId, details: { productId: v.productId, sku: v.sku } });
  });
}
