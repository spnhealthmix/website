import { and, eq, inArray, lte, gte } from "drizzle-orm";
import { coupons, offers, products } from "../db/schema";
import type { AnyDb } from "../orders/common";

export type DiscountItem = {
  variantId: string;
  productId: string;
  categoryId?: string | null;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
};

export type AppliedOffer = {
  offerId: string;
  name: string;
  scope: "product" | "category";
  targetId: string;
  discountType: "percentage" | "flat";
  value: number;
  discountPaise: number;
};

export type AppliedCoupon = {
  couponId: string;
  code: string;
  discountType: "percentage" | "flat";
  value: number;
  discountPaise: number;
};

export type DiscountCalculationResult = {
  subtotalPaise: number;
  offerDiscountPaise: number;
  couponDiscountPaise: number;
  totalDiscountPaise: number;
  finalPayablePaise: number;
  appliedOffers: AppliedOffer[];
  appliedCoupon: AppliedCoupon | null;
  couponError?: string;
};

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Authoritative discount calculation engine for SPN Foods.
 *
 * Rules:
 * 1. Integer paise exclusively. No floating-point rounding errors.
 * 2. Percentage calculation: Math.round((basePaise * percent) / 100).
 * 3. Line-level Automatic Offers:
 *    - Matching products or categories.
 *    - Highest saving offer selected per line.
 *    - Never exceeds line item total.
 * 4. Order-level Coupon:
 *    - Code normalized to uppercase.
 *    - Validates active state, date window (startsAt/endsAt), usage limit (usedCount < maxUses), and minOrderPaise.
 *    - Percentage discount capped at maxDiscountPaise if set.
 *    - Never exceeds qualifying subtotal.
 * 5. Deterministic Stacking:
 *    - At most 1 customer-entered coupon.
 *    - Total discount = Math.min(subtotalPaise, offerDiscountPaise + couponDiscountPaise).
 *    - finalPayablePaise = subtotalPaise - totalDiscountPaise.
 */
export async function calculateDiscounts(
  db: AnyDb,
  params: {
    items: DiscountItem[];
    couponCode?: string | null;
    now?: Date;
  },
): Promise<DiscountCalculationResult> {
  const now = params.now ?? new Date();
  const subtotalPaise = params.items.reduce((sum, item) => sum + item.lineTotalPaise, 0);

  if (params.items.length === 0 || subtotalPaise <= 0) {
    return {
      subtotalPaise: 0,
      offerDiscountPaise: 0,
      couponDiscountPaise: 0,
      totalDiscountPaise: 0,
      finalPayablePaise: 0,
      appliedOffers: [],
      appliedCoupon: null,
    };
  }

  // 1. Resolve product & category IDs for line items
  const productIds = Array.from(new Set(params.items.map((i) => i.productId)));
  const itemsWithCategory: Array<DiscountItem & { resolvedCategoryId: string | null }> = [];

  // If any item is missing categoryId, fetch from products table
  const missingCategories = params.items.some((i) => !i.categoryId);
  let productCategoryMap = new Map<string, string | null>();

  if (missingCategories && productIds.length > 0) {
    const productRows = await db
      .select({ id: products.id, categoryId: products.categoryId })
      .from(products)
      .where(inArray(products.id, productIds));
    productCategoryMap = new Map(productRows.map((p) => [p.id, p.categoryId]));
  }

  for (const item of params.items) {
    const catId = item.categoryId ?? productCategoryMap.get(item.productId) ?? null;
    itemsWithCategory.push({ ...item, resolvedCategoryId: catId });
  }

  const categoryIds = Array.from(
    new Set(itemsWithCategory.map((i) => i.resolvedCategoryId).filter((id): id is string => Boolean(id))),
  );

  // 2. Query active offers within validity window
  const activeOffers = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.isActive, true),
        lte(offers.startsAt, now),
        gte(offers.endsAt, now),
      ),
    );

  // Filter offers matching our products or categories
  const candidateOffers = activeOffers.filter((o) => {
    if (o.scope === "product" && o.productId && productIds.includes(o.productId)) return true;
    if (o.scope === "category" && o.categoryId && categoryIds.includes(o.categoryId)) return true;
    return false;
  });

  // Calculate line-level offer discounts
  const appliedOffersMap = new Map<string, AppliedOffer>();
  let offerDiscountPaise = 0;

  for (const item of itemsWithCategory) {
    // Find matching offers for this item
    const matching = candidateOffers.filter((o) => {
      if (o.scope === "product" && o.productId === item.productId) return true;
      if (o.scope === "category" && o.categoryId && o.categoryId === item.resolvedCategoryId) return true;
      return false;
    });

    if (matching.length === 0) continue;

    // Pick best offer (max savings) for this line
    let bestOffer = matching[0];
    let bestDiscount = 0;

    for (const off of matching) {
      let disc = 0;
      if (off.discountType === "percentage") {
        disc = Math.round((item.lineTotalPaise * off.value) / 100);
      } else {
        // Flat offer applies per unit or capped at line total
        disc = Math.min(item.lineTotalPaise, off.value * item.quantity);
      }
      disc = Math.max(0, Math.min(item.lineTotalPaise, disc));

      if (disc > bestDiscount) {
        bestDiscount = disc;
        bestOffer = off;
      }
    }

    if (bestDiscount > 0) {
      offerDiscountPaise += bestDiscount;
      const targetId = (bestOffer.scope === "product" ? bestOffer.productId : bestOffer.categoryId) ?? "";
      const existing = appliedOffersMap.get(bestOffer.id);
      if (existing) {
        existing.discountPaise += bestDiscount;
      } else {
        appliedOffersMap.set(bestOffer.id, {
          offerId: bestOffer.id,
          name: bestOffer.name,
          scope: bestOffer.scope,
          targetId,
          discountType: bestOffer.discountType,
          value: bestOffer.value,
          discountPaise: bestDiscount,
        });
      }
    }
  }

  // Cap offer discount at subtotal
  offerDiscountPaise = Math.min(subtotalPaise, offerDiscountPaise);

  // 3. Coupon validation & calculation
  let appliedCoupon: AppliedCoupon | null = null;
  let couponDiscountPaise = 0;
  let couponError: string | undefined;

  if (params.couponCode && params.couponCode.trim().length > 0) {
    const normalized = normalizeCouponCode(params.couponCode);
    const [couponRow] = await db
      .select()
      .from(coupons)
      .where(eq(coupons.code, normalized));

    if (!couponRow) {
      couponError = "Invalid coupon code";
    } else if (!couponRow.isActive) {
      couponError = "Coupon is not active";
    } else if (couponRow.startsAt && now < couponRow.startsAt) {
      couponError = "Coupon is not active yet";
    } else if (couponRow.endsAt && now > couponRow.endsAt) {
      couponError = "Coupon has expired";
    } else if (couponRow.maxUses !== null && couponRow.usedCount >= couponRow.maxUses) {
      couponError = "Coupon usage limit reached";
    } else if (subtotalPaise < couponRow.minOrderPaise) {
      couponError = `Minimum order amount of ₹${(couponRow.minOrderPaise / 100).toFixed(0)} required`;
    } else {
      // Calculate coupon discount
      let rawDiscount = 0;
      if (couponRow.discountType === "percentage") {
        rawDiscount = Math.round((subtotalPaise * couponRow.value) / 100);
      } else {
        rawDiscount = Math.min(subtotalPaise, couponRow.value);
      }

      if (couponRow.maxDiscountPaise !== null && couponRow.maxDiscountPaise > 0) {
        rawDiscount = Math.min(rawDiscount, couponRow.maxDiscountPaise);
      }

      // Ensure discount does not exceed remaining subtotal after offers
      const remainingSubtotal = Math.max(0, subtotalPaise - offerDiscountPaise);
      couponDiscountPaise = Math.max(0, Math.min(remainingSubtotal, rawDiscount));

      appliedCoupon = {
        couponId: couponRow.id,
        code: couponRow.code,
        discountType: couponRow.discountType,
        value: couponRow.value,
        discountPaise: couponDiscountPaise,
      };
    }
  }

  const totalDiscountPaise = Math.min(subtotalPaise, offerDiscountPaise + couponDiscountPaise);
  const finalPayablePaise = Math.max(0, subtotalPaise - totalDiscountPaise);

  return {
    subtotalPaise,
    offerDiscountPaise,
    couponDiscountPaise,
    totalDiscountPaise,
    finalPayablePaise,
    appliedOffers: Array.from(appliedOffersMap.values()),
    appliedCoupon,
    couponError,
  };
}
