import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  categories,
  comboOfferItems,
  comboOffers,
  productVariants,
  products,
  type ComboOffer,
  type ComboOfferItemRow,
} from "../db/schema";
import type { AnyDb } from "../orders/common";
import { ApiError, violatedConstraint } from "../api/http";
import { diff, writeAudit } from "../admin/audit";
import { checkImageBytes, removeObjects } from "../admin/images";
import {
  IMMUTABLE_CACHE,
  imageUrl,
  newImageKey,
  type ObjectStorage,
} from "../storage/storage";
import { slugify } from "../admin/slug";
import {
  comboOfferCreateSchema,
  comboOfferUpdateSchema,
  type ComboOfferCreateInput,
  type ComboOfferUpdateInput,
  type IncludedItemInput,
} from "./validation";

type Log = (msg: string, extra?: unknown) => void;
const defaultLog: Log = (m, e) => console.error(m, e);

export type ComboOfferWithDetails = ComboOffer & {
  category?: { id: string; name: string; slug: string } | null;
  items: ComboOfferItemRow[];
  savingsPaise: number;
  discountPercentage: number;
};

export function calculateSavingsAndDiscount(pricePaise: number, mrpPaise: number | null | undefined) {
  const savingsPaise = mrpPaise && mrpPaise > pricePaise ? mrpPaise - pricePaise : 0;
  const discountPercentage = mrpPaise && mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;
  return { savingsPaise, discountPercentage };
}

/**
 * Extracts the Cloudflare R2 object key from an absolute or relative URL / key string.
 * Returns null if the string is not an R2 object key (e.g. static assets like '/hero1.jpeg').
 */
export function extractR2Key(urlOrKey: string | null | undefined): string | null {
  if (!urlOrKey) return null;
  const trimmed = urlOrKey.trim();

  // Full URL: https://.../combo-offers/posters/abc.jpg
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace(/^\/+/, "");
      if (pathname.startsWith("combo-offers/")) {
        return pathname;
      }
    } catch {
      return null;
    }
  }

  // Relative path: /combo-offers/...
  if (trimmed.startsWith("/combo-offers/")) {
    return trimmed.slice(1);
  }

  // Direct key: combo-offers/...
  if (trimmed.startsWith("combo-offers/")) {
    return trimmed;
  }

  return null;
}

/**
 * Checks whether an R2 key or URL is still referenced anywhere in the combo_offers table.
 * If excludeId is provided, that row is omitted from the search (used when deleting or replacing).
 */
export async function isImageReferenced(
  db: AnyDb,
  keyOrUrl: string,
  excludeId?: string,
): Promise<boolean> {
  const conditions = [
    or(
      eq(comboOffers.imageUrl, keyOrUrl),
      eq(comboOffers.desktopImageUrl, keyOrUrl),
      eq(comboOffers.mobileImageUrl, keyOrUrl),
      sql`${comboOffers.imageUrl} LIKE ${`%${keyOrUrl}%`}`,
      sql`${comboOffers.desktopImageUrl} LIKE ${`%${keyOrUrl}%`}`,
      sql`${comboOffers.mobileImageUrl} LIKE ${`%${keyOrUrl}%`}`,
    ),
  ];

  if (excludeId) {
    conditions.push(sql`${comboOffers.id} <> ${excludeId}`);
  }

  const [row] = await db
    .select({ id: comboOffers.id })
    .from(comboOffers)
    .where(and(...conditions))
    .limit(1);

  return Boolean(row);
}

/**
 * Generates the first free slug for a combo offer: base, base-2, base-3...
 */
export async function freeComboSlug(db: AnyDb, base: string, skipId?: string): Promise<string> {
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`.slice(0, 120);
    const [hit] = await db
      .select({ id: comboOffers.id })
      .from(comboOffers)
      .where(eq(comboOffers.slug, candidate));
    if (!hit || hit.id === skipId) return candidate;
  }
  throw new ApiError(409, "SLUG_TAKEN", "Could not find a free URL slug; provide one.");
}

/**
 * Fetch all combo offers for the admin dashboard, ordered by displayOrder asc, createdAt desc.
 * Includes items and calculated savings.
 */
export async function listComboOffers(db: AnyDb): Promise<ComboOfferWithDetails[]> {
  const rows = await db
    .select()
    .from(comboOffers)
    .orderBy(asc(comboOffers.displayOrder), desc(comboOffers.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const offerIds = rows.map((r) => r.id);
  const items = await db
    .select()
    .from(comboOfferItems)
    .where(inArray(comboOfferItems.comboOfferId, offerIds))
    .orderBy(asc(comboOfferItems.sortOrder), asc(comboOfferItems.createdAt));

  const itemsByOfferId = new Map<string, ComboOfferItemRow[]>();
  for (const item of items) {
    const arr = itemsByOfferId.get(item.comboOfferId) ?? [];
    arr.push(item);
    itemsByOfferId.set(item.comboOfferId, arr);
  }

  return rows.map((row) => {
    const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);
    return {
      ...row,
      items: itemsByOfferId.get(row.id) ?? [],
      savingsPaise,
      discountPercentage,
    };
  });
}

/**
 * Fetch active combo offers for the storefront homepage carousel & offers listing,
 * ordered by displayOrder asc, createdAt asc.
 */
export async function getActiveComboOffers(db: AnyDb): Promise<ComboOfferWithDetails[]> {
  const rows = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.isActive, true))
    .orderBy(asc(comboOffers.displayOrder), asc(comboOffers.createdAt));

  if (rows.length === 0) {
    return [];
  }

  const offerIds = rows.map((r) => r.id);
  const items = await db
    .select()
    .from(comboOfferItems)
    .where(inArray(comboOfferItems.comboOfferId, offerIds))
    .orderBy(asc(comboOfferItems.sortOrder), asc(comboOfferItems.createdAt));

  const itemsByOfferId = new Map<string, ComboOfferItemRow[]>();
  for (const item of items) {
    const arr = itemsByOfferId.get(item.comboOfferId) ?? [];
    arr.push(item);
    itemsByOfferId.set(item.comboOfferId, arr);
  }

  return rows.map((row) => {
    const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);
    return {
      ...row,
      items: itemsByOfferId.get(row.id) ?? [],
      savingsPaise,
      discountPercentage,
    };
  });
}

/**
 * Fetch a single combo offer by ID with full item details.
 */
export async function getComboOffer(db: AnyDb, id: string): Promise<ComboOfferWithDetails> {
  const [row] = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.id, id));

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Combo offer not found.");
  }

  let category: { id: string; name: string; slug: string } | null = null;
  if (row.categoryId) {
    const [c] = await db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(eq(categories.id, row.categoryId));
    if (c) category = c;
  }

  const items = await db
    .select()
    .from(comboOfferItems)
    .where(eq(comboOfferItems.comboOfferId, id))
    .orderBy(asc(comboOfferItems.sortOrder), asc(comboOfferItems.createdAt));

  const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);

  return {
    ...row,
    category,
    items,
    savingsPaise,
    discountPercentage,
  };
}

/**
 * Fetch a single active combo offer by SLUG with full item details.
 */
export async function getComboOfferBySlug(
  db: AnyDb,
  slug: string,
  options: { activeOnly?: boolean } = { activeOnly: true },
): Promise<ComboOfferWithDetails | null> {
  const conditions = [eq(comboOffers.slug, slug)];
  if (options.activeOnly) {
    conditions.push(eq(comboOffers.isActive, true));
  }

  const [row] = await db
    .select()
    .from(comboOffers)
    .where(and(...conditions));

  if (!row) {
    return null;
  }

  let category: { id: string; name: string; slug: string } | null = null;
  if (row.categoryId) {
    const [c] = await db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .where(eq(categories.id, row.categoryId));
    if (c) category = c;
  }

  const items = await db
    .select()
    .from(comboOfferItems)
    .where(eq(comboOfferItems.comboOfferId, row.id))
    .orderBy(asc(comboOfferItems.sortOrder), asc(comboOfferItems.createdAt));

  const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);

  return {
    ...row,
    category,
    items,
    savingsPaise,
    discountPercentage,
  };
}

/**
 * Ensures or links a backing product and variant in `products` & `product_variants`
 * so that adding to cart works 100% seamlessly through existing cart & checkout mechanisms.
 */
async function syncBackingVariant(
  tx: AnyDb,
  combo: {
    id: string;
    name: string;
    slug: string;
    shortDescription?: string | null;
    description?: string | null;
    packageLabel?: string | null;
    pricePaise: number;
    mrpPaise?: number | null;
    stock: number;
    isActive: boolean;
    categoryId?: string | null;
    existingVariantId?: string | null;
  },
): Promise<string | null> {
  const effectiveMrp = combo.mrpPaise && combo.mrpPaise >= combo.pricePaise ? combo.mrpPaise : combo.pricePaise;

  // 1. If existingVariantId is provided and valid, update its pricing and stock
  if (combo.existingVariantId) {
    const [variant] = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.id, combo.existingVariantId));

    if (variant) {
      await tx
        .update(productVariants)
        .set({
          pricePaise: combo.pricePaise,
          mrpPaise: effectiveMrp,
          stock: combo.stock,
          isActive: combo.isActive,
          label: combo.packageLabel || "1 Pack",
        })
        .where(eq(productVariants.id, combo.existingVariantId));
      return combo.existingVariantId;
    }
  }

  // 2. Check if a backing product with SKU combo-${slug} already exists
  const comboSku = `combo-${combo.slug}`.slice(0, 50);
  const [existingVariantBySku] = await tx
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.sku, comboSku));

  if (existingVariantBySku) {
    await tx
      .update(productVariants)
      .set({
        pricePaise: combo.pricePaise,
        mrpPaise: effectiveMrp,
        stock: combo.stock,
        isActive: combo.isActive,
        label: combo.packageLabel || "1 Pack",
      })
      .where(eq(productVariants.id, existingVariantBySku.id));
    return existingVariantBySku.id;
  }

  // 3. Create backing product and variant
  // Find valid categoryId
  let targetCategoryId = combo.categoryId;
  if (!targetCategoryId) {
    const [firstCat] = await tx.select({ id: categories.id }).from(categories).limit(1);
    targetCategoryId = firstCat?.id;
  }

  if (!targetCategoryId) {
    // If no categories exist at all, cannot create backing product without category FK
    return null;
  }

  const productSlug = `combo-${combo.slug}`.slice(0, 80);
  const [newProduct] = await tx
    .insert(products)
    .values({
      categoryId: targetCategoryId,
      name: combo.name,
      slug: productSlug,
      shortDescription: combo.shortDescription ?? null,
      description: combo.description ?? null,
      isActive: combo.isActive,
      sortOrder: 9999,
    })
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        name: combo.name,
        isActive: combo.isActive,
      },
    })
    .returning({ id: products.id });

  const [newVariant] = await tx
    .insert(productVariants)
    .values({
      productId: newProduct.id,
      sku: comboSku,
      label: combo.packageLabel || "1 Pack",
      pricePaise: combo.pricePaise,
      mrpPaise: effectiveMrp,
      stock: combo.stock,
      isActive: combo.isActive,
    })
    .onConflictDoUpdate({
      target: productVariants.sku,
      set: {
        pricePaise: combo.pricePaise,
        mrpPaise: effectiveMrp,
        stock: combo.stock,
        isActive: combo.isActive,
        label: combo.packageLabel || "1 Pack",
      },
    })
    .returning({ id: productVariants.id });

  return newVariant.id;
}

async function withTx<T>(db: AnyDb, fn: (tx: AnyDb) => Promise<T>): Promise<T> {
  if (typeof (db as any).transaction === "function") {
    return (db as any).transaction(fn);
  }
  return fn(db);
}

/**
 * Create a new combo offer with included items and backing cart variant.
 */
export async function createComboOffer(
  db: AnyDb,
  adminId: string,
  rawInput: ComboOfferCreateInput,
): Promise<ComboOfferWithDetails> {
  const input = comboOfferCreateSchema.parse(rawInput);
  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!baseSlug) {
    throw new ApiError(422, "VALIDATION_FAILED", "Please provide a valid name or slug with letters and digits.");
  }

  try {
    const offer = await withTx(db, async (tx) => {
      const slug = await freeComboSlug(tx, baseSlug);
      const destinationUrl = input.destinationUrl || `/combo-offers/${slug}`;

      let backingVariantId = input.variantId ?? null;
      if (input.allowAddToCart !== false) {
        try {
          backingVariantId = await syncBackingVariant(tx, {
            id: "",
            name: input.name,
            slug,
            shortDescription: input.shortDescription,
            description: input.description,
            packageLabel: input.packageLabel,
            pricePaise: input.pricePaise ?? 0,
            mrpPaise: input.mrpPaise,
            stock: input.stock ?? 50,
            isActive: input.isActive ?? true,
            categoryId: input.categoryId,
            existingVariantId: input.variantId,
          });
        } catch (err) {
          console.error("Backing variant creation notice:", err);
        }
      }

      const [row] = await tx
        .insert(comboOffers)
        .values({
          name: input.name,
          slug,
          shortDescription: input.shortDescription ?? null,
          description: input.description ?? null,
          offerBadge: input.offerBadge ?? null,
          packageLabel: input.packageLabel ?? null,
          categoryId: input.categoryId ?? null,
          imageUrl: input.imageUrl ?? null,
          desktopImageUrl: input.desktopImageUrl,
          mobileImageUrl: input.mobileImageUrl,
          destinationUrl,
          pricePaise: input.pricePaise ?? 0,
          mrpPaise: input.mrpPaise ?? null,
          stock: input.stock ?? 50,
          allowAddToCart: input.allowAddToCart ?? true,
          packageHighlights: input.packageHighlights ?? [],
          variantId: backingVariantId,
          displayOrder: input.displayOrder ?? 0,
          isActive: input.isActive ?? true,
        })
        .returning();

      // Insert included items
      const createdItems: ComboOfferItemRow[] = [];
      if (input.includedItems && input.includedItems.length > 0) {
        for (let idx = 0; idx < input.includedItems.length; idx++) {
          const item = input.includedItems[idx];
          const [insertedItem] = await tx
            .insert(comboOfferItems)
            .values({
              comboOfferId: row.id,
              productId: item.productId ?? null,
              productVariantId: item.productVariantId ?? null,
              itemTitle: item.itemTitle,
              quantity: item.quantity ?? 1,
              unit: item.unit ?? null,
              sortOrder: item.sortOrder ?? idx,
            })
            .returning();
          createdItems.push(insertedItem);
        }
      }

      await writeAudit(tx, {
        actorProfileId: adminId,
        action: "combo_offer.created",
        entityType: "combo_offer",
        entityId: row.id,
        details: {
          name: row.name,
          slug: row.slug,
          pricePaise: row.pricePaise,
          mrpPaise: row.mrpPaise,
          displayOrder: row.displayOrder,
          isActive: row.isActive,
          destinationUrl: row.destinationUrl,
          itemsCount: createdItems.length,
        },
      });

      const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);

      return {
        ...row,
        items: createdItems,
        savingsPaise,
        discountPercentage,
      };
    });

    return offer;
  } catch (err) {
    if (violatedConstraint(err) === "combo_offers_slug_uq") {
      throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", {
        fields: { slug: "Already in use" },
      });
    }
    throw err;
  }
}

/**
 * Update an existing combo offer and its included items.
 * When an image URL is replaced, the old R2 image is cleaned up only after confirming
 * it is no longer referenced in the database.
 */
export async function updateComboOffer(
  db: AnyDb,
  storage: ObjectStorage | undefined,
  adminId: string,
  id: string,
  input: ComboOfferUpdateInput,
  o: { log?: Log } = {},
): Promise<ComboOfferWithDetails> {
  const [existing] = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.id, id));

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Combo offer not found.");
  }

  const keysToEvaluateForCleanup: string[] = [];

  if (input.imageUrl !== undefined && input.imageUrl !== existing.imageUrl) {
    const oldKey = extractR2Key(existing.imageUrl);
    if (oldKey) keysToEvaluateForCleanup.push(oldKey);
  }

  if (input.desktopImageUrl !== undefined && input.desktopImageUrl !== existing.desktopImageUrl) {
    const oldDesktopKey = extractR2Key(existing.desktopImageUrl);
    if (oldDesktopKey) keysToEvaluateForCleanup.push(oldDesktopKey);
  }

  if (input.mobileImageUrl !== undefined && input.mobileImageUrl !== existing.mobileImageUrl) {
    const oldMobileKey = extractR2Key(existing.mobileImageUrl);
    if (oldMobileKey) keysToEvaluateForCleanup.push(oldMobileKey);
  }

  let nextSlug = existing.slug;
  if (input.slug !== undefined && input.slug !== existing.slug) {
    const candidate = slugify(input.slug);
    if (!candidate) {
      throw new ApiError(422, "VALIDATION_FAILED", "Invalid slug format.");
    }
    nextSlug = await freeComboSlug(db, candidate, id);
  }

  try {
    const updated = await withTx(db, async (tx) => {
      const pricePaise = input.pricePaise !== undefined ? input.pricePaise : existing.pricePaise;
      const mrpPaise = input.mrpPaise !== undefined ? input.mrpPaise : existing.mrpPaise;
      const stock = input.stock !== undefined ? input.stock : existing.stock;
      const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
      const packageLabel = input.packageLabel !== undefined ? input.packageLabel : existing.packageLabel;
      const categoryId = input.categoryId !== undefined ? input.categoryId : existing.categoryId;
      const name = input.name !== undefined ? input.name : existing.name;

      let variantId = input.variantId !== undefined ? input.variantId : existing.variantId;
      if (input.allowAddToCart !== false) {
        try {
          variantId = await syncBackingVariant(tx, {
            id,
            name,
            slug: nextSlug,
            shortDescription: input.shortDescription !== undefined ? input.shortDescription : existing.shortDescription,
            description: input.description !== undefined ? input.description : existing.description,
            packageLabel,
            pricePaise,
            mrpPaise,
            stock,
            isActive,
            categoryId,
            existingVariantId: variantId,
          });
        } catch (err) {
          console.error("Backing variant sync notice:", err);
        }
      }

      const updateData: Partial<typeof comboOffers.$inferInsert> = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(nextSlug !== existing.slug ? { slug: nextSlug } : {}),
        ...(input.shortDescription !== undefined ? { shortDescription: input.shortDescription } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.offerBadge !== undefined ? { offerBadge: input.offerBadge } : {}),
        ...(input.packageLabel !== undefined ? { packageLabel: input.packageLabel } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.desktopImageUrl !== undefined ? { desktopImageUrl: input.desktopImageUrl } : {}),
        ...(input.mobileImageUrl !== undefined ? { mobileImageUrl: input.mobileImageUrl } : {}),
        ...(input.destinationUrl !== undefined ? { destinationUrl: input.destinationUrl } : {}),
        ...(input.pricePaise !== undefined ? { pricePaise: input.pricePaise } : {}),
        ...(input.mrpPaise !== undefined ? { mrpPaise: input.mrpPaise } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.allowAddToCart !== undefined ? { allowAddToCart: input.allowAddToCart } : {}),
        ...(input.packageHighlights !== undefined ? { packageHighlights: input.packageHighlights } : {}),
        ...(variantId !== existing.variantId ? { variantId } : {}),
        ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      };

      const [row] = await tx
        .update(comboOffers)
        .set(updateData)
        .where(eq(comboOffers.id, id))
        .returning();

      // If includedItems was supplied, replace existing items with the new set
      if (input.includedItems !== undefined) {
        await tx.delete(comboOfferItems).where(eq(comboOfferItems.comboOfferId, id));
        for (let idx = 0; idx < input.includedItems.length; idx++) {
          const item = input.includedItems[idx];
          await tx.insert(comboOfferItems).values({
            comboOfferId: id,
            productId: item.productId ?? null,
            productVariantId: item.productVariantId ?? null,
            itemTitle: item.itemTitle,
            quantity: item.quantity ?? 1,
            unit: item.unit ?? null,
            sortOrder: item.sortOrder ?? idx,
          });
        }
      }

      await writeAudit(tx, {
        actorProfileId: adminId,
        action: "combo_offer.updated",
        entityType: "combo_offer",
        entityId: id,
        details: {
          diff: diff(existing as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>),
        },
      });

      const updatedItems = await tx
        .select()
        .from(comboOfferItems)
        .where(eq(comboOfferItems.comboOfferId, id))
        .orderBy(asc(comboOfferItems.sortOrder), asc(comboOfferItems.createdAt));

      const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(row.pricePaise, row.mrpPaise);

      return {
        ...row,
        items: updatedItems,
        savingsPaise,
        discountPercentage,
      };
    });

    // Post-commit: Clean up unreferenced replaced images from R2
    if (storage && keysToEvaluateForCleanup.length > 0) {
      for (const key of keysToEvaluateForCleanup) {
        const stillReferenced = await isImageReferenced(db, key);
        if (!stillReferenced) {
          await removeObjects(storage, [key], o.log ?? defaultLog);
        }
      }
    }

    return updated;
  } catch (err) {
    if (violatedConstraint(err) === "combo_offers_slug_uq") {
      throw new ApiError(409, "SLUG_TAKEN", "That URL slug is already used.", {
        fields: { slug: "Already in use" },
      });
    }
    throw err;
  }
}

/**
 * Delete a combo offer.
 * Cleans up old R2 images only after confirming they are no longer referenced anywhere else.
 */
export async function deleteComboOffer(
  db: AnyDb,
  storage: ObjectStorage | undefined,
  adminId: string,
  id: string,
  o: { log?: Log } = {},
): Promise<{ deleted: true }> {
  const [existing] = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.id, id));

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Combo offer not found.");
  }

  const keysToEvaluate: string[] = [];
  const imageKey = extractR2Key(existing.imageUrl);
  const desktopKey = extractR2Key(existing.desktopImageUrl);
  const mobileKey = extractR2Key(existing.mobileImageUrl);

  if (imageKey) keysToEvaluate.push(imageKey);
  if (desktopKey && !keysToEvaluate.includes(desktopKey)) keysToEvaluate.push(desktopKey);
  if (mobileKey && !keysToEvaluate.includes(mobileKey)) keysToEvaluate.push(mobileKey);

  await withTx(db, async (tx) => {
    // Delete comboOfferItems cascade automatically, but explicit delete for safety
    await tx.delete(comboOfferItems).where(eq(comboOfferItems.comboOfferId, id));
    await tx.delete(comboOffers).where(eq(comboOffers.id, id));

    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "combo_offer.deleted",
      entityType: "combo_offer",
      entityId: id,
      details: {
        name: existing.name,
        slug: existing.slug,
        imageUrl: existing.imageUrl,
        desktopImageUrl: existing.desktopImageUrl,
        mobileImageUrl: existing.mobileImageUrl,
      },
    });
  });

  // Post-commit: delete R2 objects if no longer referenced
  if (storage && keysToEvaluate.length > 0) {
    for (const key of keysToEvaluate) {
      const stillReferenced = await isImageReferenced(db, key);
      if (!stillReferenced) {
        await removeObjects(storage, [key], o.log ?? defaultLog);
      }
    }
  }

  return { deleted: true };
}

/**
 * Upload a desktop/mobile combo offer poster or offer image to Cloudflare R2.
 * Validates file magic bytes (JPEG, PNG, WebP) and 5MB size limit.
 */
export async function uploadComboOfferPoster(
  storage: ObjectStorage,
  bytes: Uint8Array,
  o: { imageBaseUrl?: string; folder?: string; log?: Log } = {},
): Promise<{ key: string; url: string }> {
  const kind = checkImageBytes(bytes);
  const folder = o.folder ?? "posters";
  const key = newImageKey("combo-offers", folder, kind.ext);

  try {
    await storage.put(key, bytes, { contentType: kind.contentType, cacheControl: IMMUTABLE_CACHE });
  } catch (err) {
    throw new ApiError(502, "STORAGE_ERROR", "Could not upload image to storage. Please try again.");
  }

  const fullUrl = imageUrl(o.imageBaseUrl, key) ?? `/${key}`;
  return { key, url: fullUrl };
}
