import { asc, eq, sql } from "drizzle-orm";
import { ApiError } from "../api/http";
import { categories, productImages, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import {
  IMAGE_MAX_BYTES, IMAGES_PER_PRODUCT, IMMUTABLE_CACHE, imageUrl, newImageKey, sniffImage, type ObjectStorage,
} from "../storage/storage";
import { writeAudit } from "./audit";

type Log = (msg: string, extra?: unknown) => void;
const defaultLog: Log = (m, e) => console.error(m, e);

/**
 * Validate the bytes (never the filename or the client's Content-Type) and return what the
 * file really is.
 */
export function checkImageBytes(bytes: Uint8Array) {
  if (bytes.length === 0) throw new ApiError(422, "VALIDATION_FAILED", "The file is empty.", { file: "The file is empty" });
  if (bytes.length > IMAGE_MAX_BYTES) throw new ApiError(413, "IMAGE_TOO_LARGE", `Images can be at most ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`);
  const kind = sniffImage(bytes);
  if (!kind) throw new ApiError(415, "UNSUPPORTED_IMAGE", "Only JPEG, PNG and WebP images are accepted.");
  return kind;
}

/** Best-effort removal of objects that are no longer referenced. A failure only leaves an orphan. */
export async function removeObjects(storage: ObjectStorage, keys: string[], log: Log = defaultLog) {
  if (keys.length === 0) return;
  try {
    await storage.delete(keys);
  } catch (err) {
    log("storage cleanup failed; orphaned objects", { keys, error: err instanceof Error ? err.message : String(err) });
  }
}

async function putObject(storage: ObjectStorage, key: string, bytes: Uint8Array, contentType: string) {
  try {
    await storage.put(key, bytes, { contentType, cacheControl: IMMUTABLE_CACHE });
  } catch (err) {
    throw new ApiError(502, "STORAGE_ERROR", "Could not store the image. Please try again.", undefined);
  }
}

/* ------------------------------ Product images ----------------------------- */

export async function uploadProductImage(
  db: AnyDb, storage: ObjectStorage, adminId: string, productId: string,
  file: { bytes: Uint8Array; alt?: string | null; makePrimary?: boolean },
  o: { imageBaseUrl?: string; log?: Log } = {},
) {
  const kind = checkImageBytes(file.bytes);

  const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId));
  if (!p) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(productImages).where(eq(productImages.productId, productId));
  if (n >= IMAGES_PER_PRODUCT) throw new ApiError(409, "IMAGE_LIMIT", `A product can have at most ${IMAGES_PER_PRODUCT} images.`);

  // 1) store the object   2) record it. If step 2 fails, remove the object again so nothing is orphaned.
  const key = newImageKey("products", productId, kind.ext);
  await putObject(storage, key, file.bytes, kind.contentType);
  try {
    const row = await db.transaction(async (tx) => {
      const [locked] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
      if (!locked) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
      const existing = await tx.select({ id: productImages.id, sortOrder: productImages.sortOrder }).from(productImages).where(eq(productImages.productId, productId));
      if (existing.length >= IMAGES_PER_PRODUCT) throw new ApiError(409, "IMAGE_LIMIT", `A product can have at most ${IMAGES_PER_PRODUCT} images.`);

      const primary = existing.length === 0 || file.makePrimary === true; // the first image is always primary
      if (primary) await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
      const [img] = await tx
        .insert(productImages)
        .values({ productId, r2Key: key, alt: file.alt ?? null, isPrimary: primary, sortOrder: existing.reduce((m, e) => Math.max(m, e.sortOrder), -1) + 1 })
        .returning();
      await writeAudit(tx, { actorProfileId: adminId, action: "image.added", entityType: "image", entityId: img.id, details: { productId, key, bytes: file.bytes.length, primary } });
      return img;
    });
    return { ...row, key: row.r2Key, url: imageUrl(o.imageBaseUrl, row.r2Key) };
  } catch (err) {
    await removeObjects(storage, [key], o.log);
    throw err;
  }
}

export async function updateProductImage(
  db: AnyDb, adminId: string, imageId: string,
  patch: { alt?: string | null; sortOrder?: number; isPrimary?: true },
  o: { imageBaseUrl?: string } = {},
) {
  return db.transaction(async (tx) => {
    const [img] = await tx.select().from(productImages).where(eq(productImages.id, imageId));
    if (!img) throw new ApiError(404, "IMAGE_NOT_FOUND", "Image not found.");
    // Same lock as upload/delete, so "exactly one primary" holds under concurrency.
    await tx.select({ id: products.id }).from(products).where(eq(products.id, img.productId)).for("update");

    const { isPrimary, ...rest } = patch;
    if (isPrimary === true) {
      await tx.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, img.productId));
    }
    const set = { ...rest, ...(isPrimary === true ? { isPrimary: true } : {}) };
    const [row] = Object.keys(set).length
      ? await tx.update(productImages).set(set).where(eq(productImages.id, imageId)).returning()
      : [img];
    await writeAudit(tx, { actorProfileId: adminId, action: "image.updated", entityType: "image", entityId: imageId, details: { productId: img.productId, patch } });
    return { ...row, key: row.r2Key, url: imageUrl(o.imageBaseUrl, row.r2Key) };
  });
}

export async function deleteProductImage(db: AnyDb, storage: ObjectStorage, adminId: string, imageId: string, log?: Log) {
  const key = await db.transaction(async (tx) => {
    const [img] = await tx.select().from(productImages).where(eq(productImages.id, imageId));
    if (!img) throw new ApiError(404, "IMAGE_NOT_FOUND", "Image not found.");
    await tx.select({ id: products.id }).from(products).where(eq(products.id, img.productId)).for("update");

    await tx.delete(productImages).where(eq(productImages.id, imageId));
    if (img.isPrimary) {
      const [next] = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.sortOrder), asc(productImages.id)).limit(1);
      if (next) await tx.update(productImages).set({ isPrimary: true }).where(eq(productImages.id, next.id));
    }
    await writeAudit(tx, { actorProfileId: adminId, action: "image.deleted", entityType: "image", entityId: imageId, details: { productId: img.productId, key: img.r2Key } });
    return img.r2Key;
  });
  await removeObjects(storage, [key], log); // after commit: a storage hiccup can't undo the delete
}

/* ----------------------------- Category image ------------------------------ */

export async function setCategoryImage(
  db: AnyDb, storage: ObjectStorage, adminId: string, categoryId: string, bytes: Uint8Array,
  o: { imageBaseUrl?: string; log?: Log } = {},
) {
  const kind = checkImageBytes(bytes);
  const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId));
  if (!c) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");

  const key = newImageKey("categories", categoryId, kind.ext);
  await putObject(storage, key, bytes, kind.contentType);
  try {
    const old = await db.transaction(async (tx) => {
      const [cur] = await tx.select().from(categories).where(eq(categories.id, categoryId)).for("update");
      if (!cur) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
      await tx.update(categories).set({ imageKey: key }).where(eq(categories.id, categoryId));
      await writeAudit(tx, { actorProfileId: adminId, action: "category.image_set", entityType: "category", entityId: categoryId, details: { key, replaced: cur.imageKey } });
      return cur.imageKey;
    });
    if (old) await removeObjects(storage, [old], o.log);
    return { imageKey: key, imageUrl: imageUrl(o.imageBaseUrl, key) };
  } catch (err) {
    await removeObjects(storage, [key], o.log);
    throw err;
  }
}

export async function removeCategoryImage(db: AnyDb, storage: ObjectStorage, adminId: string, categoryId: string, log?: Log) {
  const old = await db.transaction(async (tx) => {
    const [cur] = await tx.select().from(categories).where(eq(categories.id, categoryId)).for("update");
    if (!cur) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    await tx.update(categories).set({ imageKey: null }).where(eq(categories.id, categoryId));
    await writeAudit(tx, { actorProfileId: adminId, action: "category.image_removed", entityType: "category", entityId: categoryId, details: { key: cur.imageKey } });
    return cur.imageKey;
  });
  if (old) await removeObjects(storage, [old], log);
}
