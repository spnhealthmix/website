import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { comboOffers, type ComboOffer } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { ApiError } from "../api/http";
import { diff, writeAudit } from "../admin/audit";
import { checkImageBytes, removeObjects } from "../admin/images";
import {
  IMMUTABLE_CACHE,
  imageUrl,
  newImageKey,
  type ObjectStorage,
} from "../storage/storage";
import type {
  ComboOfferCreateInput,
  ComboOfferUpdateInput,
} from "./validation";

type Log = (msg: string, extra?: unknown) => void;
const defaultLog: Log = (m, e) => console.error(m, e);

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
      eq(comboOffers.desktopImageUrl, keyOrUrl),
      eq(comboOffers.mobileImageUrl, keyOrUrl),
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
 * Fetch all combo offers for the admin dashboard, ordered by displayOrder asc, createdAt desc.
 */
export async function listComboOffers(db: AnyDb): Promise<ComboOffer[]> {
  return db
    .select()
    .from(comboOffers)
    .orderBy(asc(comboOffers.displayOrder), desc(comboOffers.createdAt));
}

/**
 * Fetch active combo offers for the storefront homepage carousel,
 * ordered by displayOrder asc, createdAt asc.
 */
export async function getActiveComboOffers(db: AnyDb): Promise<ComboOffer[]> {
  return db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.isActive, true))
    .orderBy(asc(comboOffers.displayOrder), asc(comboOffers.createdAt));
}

/**
 * Fetch a single combo offer by ID.
 */
export async function getComboOffer(db: AnyDb, id: string): Promise<ComboOffer> {
  const [row] = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.id, id));

  if (!row) {
    throw new ApiError(404, "NOT_FOUND", "Combo offer not found.");
  }

  return row;
}

/**
 * Create a new combo offer.
 */
export async function createComboOffer(
  db: AnyDb,
  adminId: string,
  input: ComboOfferCreateInput,
): Promise<ComboOffer> {
  const [row] = await db
    .insert(comboOffers)
    .values({
      name: input.name,
      desktopImageUrl: input.desktopImageUrl,
      mobileImageUrl: input.mobileImageUrl,
      destinationUrl: input.destinationUrl ?? "/combo-offers",
      displayOrder: input.displayOrder ?? 0,
      isActive: input.isActive ?? true,
    })
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "combo_offer.created",
    entityType: "combo_offer",
    entityId: row.id,
    details: {
      name: row.name,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      destinationUrl: row.destinationUrl,
    },
  });

  return row;
}

/**
 * Update an existing combo offer.
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
): Promise<ComboOffer> {
  const [existing] = await db
    .select()
    .from(comboOffers)
    .where(eq(comboOffers.id, id));

  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Combo offer not found.");
  }

  const keysToEvaluateForCleanup: string[] = [];

  if (input.desktopImageUrl && input.desktopImageUrl !== existing.desktopImageUrl) {
    const oldDesktopKey = extractR2Key(existing.desktopImageUrl);
    if (oldDesktopKey) keysToEvaluateForCleanup.push(oldDesktopKey);
  }

  if (input.mobileImageUrl && input.mobileImageUrl !== existing.mobileImageUrl) {
    const oldMobileKey = extractR2Key(existing.mobileImageUrl);
    if (oldMobileKey) keysToEvaluateForCleanup.push(oldMobileKey);
  }

  const [updated] = await db
    .update(comboOffers)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.desktopImageUrl !== undefined ? { desktopImageUrl: input.desktopImageUrl } : {}),
      ...(input.mobileImageUrl !== undefined ? { mobileImageUrl: input.mobileImageUrl } : {}),
      ...(input.destinationUrl !== undefined ? { destinationUrl: input.destinationUrl } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(comboOffers.id, id))
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "combo_offer.updated",
    entityType: "combo_offer",
    entityId: id,
    details: {
      diff: diff(existing as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>),
    },
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
  const desktopKey = extractR2Key(existing.desktopImageUrl);
  const mobileKey = extractR2Key(existing.mobileImageUrl);

  if (desktopKey) keysToEvaluate.push(desktopKey);
  if (mobileKey && mobileKey !== desktopKey) keysToEvaluate.push(mobileKey);

  await db.delete(comboOffers).where(eq(comboOffers.id, id));

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "combo_offer.deleted",
    entityType: "combo_offer",
    entityId: id,
    details: {
      name: existing.name,
      desktopImageUrl: existing.desktopImageUrl,
      mobileImageUrl: existing.mobileImageUrl,
    },
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
 * Upload a desktop or mobile combo offer poster to Cloudflare R2.
 * Validates file magic bytes (JPEG, PNG, WebP) and 5MB size limit.
 */
export async function uploadComboOfferPoster(
  storage: ObjectStorage,
  bytes: Uint8Array,
  o: { imageBaseUrl?: string; log?: Log } = {},
): Promise<{ key: string; url: string }> {
  const kind = checkImageBytes(bytes);
  const key = newImageKey("combo-offers", "posters", kind.ext);

  try {
    await storage.put(key, bytes, { contentType: kind.contentType, cacheControl: IMMUTABLE_CACHE });
  } catch (err) {
    throw new ApiError(502, "STORAGE_ERROR", "Could not upload image to storage. Please try again.");
  }

  const fullUrl = imageUrl(o.imageBaseUrl, key) ?? `/${key}`;
  return { key, url: fullUrl };
}
