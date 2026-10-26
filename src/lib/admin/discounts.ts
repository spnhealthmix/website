import { desc, eq } from "drizzle-orm";
import { coupons, offers, categories, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { ApiError } from "../api/http";
import { diff, writeAudit } from "./audit";
import type {
  offerCreateSchema,
  offerUpdateSchema,
  couponCreateSchema,
  couponUpdateSchema,
} from "../discounts/validation";
import { z } from "zod";

export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>;
export type CouponCreateInput = z.infer<typeof couponCreateSchema>;
export type CouponUpdateInput = z.infer<typeof couponUpdateSchema>;

/* -------------------------------- Offers ---------------------------------- */

export async function listOffers(db: AnyDb) {
  const rows = await db
    .select({
      id: offers.id,
      name: offers.name,
      scope: offers.scope,
      productId: offers.productId,
      categoryId: offers.categoryId,
      discountType: offers.discountType,
      value: offers.value,
      startsAt: offers.startsAt,
      endsAt: offers.endsAt,
      isActive: offers.isActive,
      createdAt: offers.createdAt,
      productName: products.name,
      categoryName: categories.name,
    })
    .from(offers)
    .leftJoin(products, eq(products.id, offers.productId))
    .leftJoin(categories, eq(categories.id, offers.categoryId))
    .orderBy(desc(offers.createdAt));

  return rows;
}

export async function getOffer(db: AnyDb, offerId: string) {
  const [row] = await db
    .select({
      id: offers.id,
      name: offers.name,
      scope: offers.scope,
      productId: offers.productId,
      categoryId: offers.categoryId,
      discountType: offers.discountType,
      value: offers.value,
      startsAt: offers.startsAt,
      endsAt: offers.endsAt,
      isActive: offers.isActive,
      createdAt: offers.createdAt,
      productName: products.name,
      categoryName: categories.name,
    })
    .from(offers)
    .leftJoin(products, eq(products.id, offers.productId))
    .leftJoin(categories, eq(categories.id, offers.categoryId))
    .where(eq(offers.id, offerId));

  if (!row) throw new ApiError(404, "OFFER_NOT_FOUND", "Offer not found.");
  return row;
}

export async function createOffer(db: AnyDb, adminId: string, input: OfferCreateInput) {
  // Validate targets
  if (input.scope === "product" && input.productId) {
    const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, input.productId));
    if (!p) throw new ApiError(400, "PRODUCT_NOT_FOUND", "Referenced product does not exist.");
  } else if (input.scope === "category" && input.categoryId) {
    const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId));
    if (!c) throw new ApiError(400, "CATEGORY_NOT_FOUND", "Referenced category does not exist.");
  }

  const [row] = await db
    .insert(offers)
    .values({
      name: input.name,
      scope: input.scope,
      productId: input.scope === "product" ? input.productId : null,
      categoryId: input.scope === "category" ? input.categoryId : null,
      discountType: input.discountType,
      value: input.value,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      isActive: input.isActive ?? true,
    })
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "offer.created",
    entityType: "offer",
    entityId: row.id,
    details: { name: row.name, scope: row.scope, value: row.value, discountType: row.discountType },
  });

  return getOffer(db, row.id);
}

export async function updateOffer(db: AnyDb, adminId: string, offerId: string, patch: OfferUpdateInput) {
  const current = await getOffer(db, offerId);

  const newScope = patch.scope ?? current.scope;
  let newProductId = patch.productId !== undefined ? patch.productId : current.productId;
  let newCategoryId = patch.categoryId !== undefined ? patch.categoryId : current.categoryId;

  if (newScope === "product") {
    newCategoryId = null;
    if (!newProductId) throw new ApiError(400, "INVALID_OFFER_SCOPE", "Product scope requires productId.");
    const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, newProductId));
    if (!p) throw new ApiError(400, "PRODUCT_NOT_FOUND", "Referenced product does not exist.");
  } else if (newScope === "category") {
    newProductId = null;
    if (!newCategoryId) throw new ApiError(400, "INVALID_OFFER_SCOPE", "Category scope requires categoryId.");
    const [c] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, newCategoryId));
    if (!c) throw new ApiError(400, "CATEGORY_NOT_FOUND", "Referenced category does not exist.");
  }

  const startsAt = patch.startsAt ? new Date(patch.startsAt) : current.startsAt;
  const endsAt = patch.endsAt ? new Date(patch.endsAt) : current.endsAt;
  if (endsAt <= startsAt) {
    throw new ApiError(400, "INVALID_OFFER_WINDOW", "End date must be strictly after start date.");
  }

  const [updated] = await db
    .update(offers)
    .set({
      name: patch.name ?? current.name,
      scope: newScope,
      productId: newProductId,
      categoryId: newCategoryId,
      discountType: patch.discountType ?? current.discountType,
      value: patch.value ?? current.value,
      startsAt,
      endsAt,
      isActive: patch.isActive !== undefined ? patch.isActive : current.isActive,
    })
    .where(eq(offers.id, offerId))
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "offer.updated",
    entityType: "offer",
    entityId: offerId,
    details: diff(current, updated),
  });

  return getOffer(db, offerId);
}

export async function deleteOffer(db: AnyDb, adminId: string, offerId: string) {
  const current = await getOffer(db, offerId);

  await db.delete(offers).where(eq(offers.id, offerId));

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "offer.deleted",
    entityType: "offer",
    entityId: offerId,
    details: { name: current.name },
  });

  return { success: true, id: offerId };
}

/* -------------------------------- Coupons --------------------------------- */

export async function listCoupons(db: AnyDb) {
  const rows = await db
    .select()
    .from(coupons)
    .orderBy(desc(coupons.createdAt));

  return rows;
}

export async function getCoupon(db: AnyDb, couponId: string) {
  const [row] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.id, couponId));

  if (!row) throw new ApiError(404, "COUPON_NOT_FOUND", "Coupon not found.");
  return row;
}

export async function createCoupon(db: AnyDb, adminId: string, input: CouponCreateInput) {
  const normalizedCode = input.code.trim().toUpperCase();

  // Check code uniqueness
  const [existing] = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(eq(coupons.code, normalizedCode));

  if (existing) {
    throw new ApiError(409, "COUPON_CODE_EXISTS", `Coupon code "${normalizedCode}" already exists.`);
  }

  const [row] = await db
    .insert(coupons)
    .values({
      code: normalizedCode,
      discountType: input.discountType,
      value: input.value,
      minOrderPaise: input.minOrderPaise ?? 0,
      maxDiscountPaise: input.maxDiscountPaise ?? null,
      maxUses: input.maxUses ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      isActive: input.isActive ?? true,
    })
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "coupon.created",
    entityType: "coupon",
    entityId: row.id,
    details: { code: row.code, discountType: row.discountType, value: row.value },
  });

  return row;
}

export async function updateCoupon(db: AnyDb, adminId: string, couponId: string, patch: CouponUpdateInput) {
  const current = await getCoupon(db, couponId);

  let newCode = current.code;
  if (patch.code && patch.code.trim().toUpperCase() !== current.code) {
    newCode = patch.code.trim().toUpperCase();
    const [existing] = await db
      .select({ id: coupons.id })
      .from(coupons)
      .where(eq(coupons.code, newCode));
    if (existing && existing.id !== couponId) {
      throw new ApiError(409, "COUPON_CODE_EXISTS", `Coupon code "${newCode}" already exists.`);
    }
  }

  const startsAt = patch.startsAt !== undefined ? (patch.startsAt ? new Date(patch.startsAt) : null) : current.startsAt;
  const endsAt = patch.endsAt !== undefined ? (patch.endsAt ? new Date(patch.endsAt) : null) : current.endsAt;

  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new ApiError(400, "INVALID_COUPON_WINDOW", "End date must be strictly after start date.");
  }

  const [updated] = await db
    .update(coupons)
    .set({
      code: newCode,
      discountType: patch.discountType ?? current.discountType,
      value: patch.value ?? current.value,
      minOrderPaise: patch.minOrderPaise !== undefined ? patch.minOrderPaise : current.minOrderPaise,
      maxDiscountPaise: patch.maxDiscountPaise !== undefined ? patch.maxDiscountPaise : current.maxDiscountPaise,
      maxUses: patch.maxUses !== undefined ? patch.maxUses : current.maxUses,
      startsAt,
      endsAt,
      isActive: patch.isActive !== undefined ? patch.isActive : current.isActive,
    })
    .where(eq(coupons.id, couponId))
    .returning();

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "coupon.updated",
    entityType: "coupon",
    entityId: couponId,
    details: diff(current, updated),
  });

  return updated;
}

export async function deleteCoupon(db: AnyDb, adminId: string, couponId: string) {
  const current = await getCoupon(db, couponId);

  // If coupon has been used in orders, safely deactivate instead of deleting row
  if (current.usedCount > 0) {
    await db.update(coupons).set({ isActive: false }).where(eq(coupons.id, couponId));
    await writeAudit(db, {
      actorProfileId: adminId,
      action: "coupon.deactivated_on_delete",
      entityType: "coupon",
      entityId: couponId,
      details: { reason: "Coupon has existing usage history; deactivated safely instead of physical deletion." },
    });
    return { success: true, id: couponId, deactivated: true };
  }

  await db.delete(coupons).where(eq(coupons.id, couponId));

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "coupon.deleted",
    entityType: "coupon",
    entityId: couponId,
    details: { code: current.code },
  });

  return { success: true, id: couponId, deleted: true };
}
