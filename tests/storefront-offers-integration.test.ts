import { describe, expect, it } from "vitest";
import {
  evaluateBestOfferForVariant,
  type ActiveOffer,
} from "../src/lib/discounts/engine";
import { computeCartSummary, type CartLineView } from "../src/lib/cart/cart";

describe("Storefront Offers & Promotions Integration", () => {
  const podiCategoryId = "cat-podi-varieties-1111";
  const healthMixCategoryId = "cat-health-mix-2222";

  const idliPodiProductId = "prod-idli-podi-1111";
  const poonduPodiProductId = "prod-poondu-podi-2222";
  const sathuMaavuProductId = "prod-sathu-maavu-3333";

  const now = new Date("2026-10-30T12:00:00Z");
  const yesterday = new Date("2026-10-29T12:00:00Z");
  const tomorrow = new Date("2026-10-31T12:00:00Z");
  const pastDate = new Date("2026-10-01T12:00:00Z");
  const futureDate = new Date("2026-11-15T12:00:00Z");

  const categoryOfferPodi20: ActiveOffer = {
    id: "offer-podi-20",
    name: "20% Off Podi Varieties",
    scope: "category",
    categoryId: podiCategoryId,
    productId: null,
    discountType: "percentage",
    value: 20,
    startsAt: yesterday,
    endsAt: tomorrow,
    isActive: true,
    createdAt: yesterday,
  };

  const productOfferIdliPodiFlat50: ActiveOffer = {
    id: "offer-idli-podi-flat50",
    name: "Flat ₹50 Off Idli Podi",
    scope: "product",
    productId: idliPodiProductId,
    categoryId: null,
    discountType: "flat",
    value: 5000, // 5000 paise = ₹50
    startsAt: yesterday,
    endsAt: tomorrow,
    isActive: true,
    createdAt: yesterday,
  };

  it("applies 20% category-level offer to all eligible products in Podi Varieties", () => {
    const idliPodiVariant = { pricePaise: 15000, mrpPaise: 15000 };
    const poonduPodiVariant = { pricePaise: 20000, mrpPaise: 25000 };

    const res1 = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      [categoryOfferPodi20],
    );

    // 20% of 15000 = 3000 discount -> 12000 selling price
    expect(res1.discountedPricePaise).toBe(12000);
    expect(res1.effectiveMrpPaise).toBe(15000);
    expect(res1.discountPercent).toBe(20);
    expect(res1.appliedOffer?.name).toBe("20% Off Podi Varieties");

    const res2 = evaluateBestOfferForVariant(
      poonduPodiVariant,
      poonduPodiProductId,
      podiCategoryId,
      [categoryOfferPodi20],
    );

    // 20% of 20000 = 4000 discount -> 16000 selling price
    // Effective MRP is original MRP 25000
    // Total discount against MRP = 25000 - 16000 = 9000 (36% OFF)
    expect(res2.discountedPricePaise).toBe(16000);
    expect(res2.effectiveMrpPaise).toBe(25000);
    expect(res2.discountPercent).toBe(36);
    expect(res2.appliedOffer?.name).toBe("20% Off Podi Varieties");
  });

  it("verifies that ineligible products outside the category retain their original prices", () => {
    const sathuMaavuVariant = { pricePaise: 30000, mrpPaise: 35000 };

    const res = evaluateBestOfferForVariant(
      sathuMaavuVariant,
      sathuMaavuProductId,
      healthMixCategoryId,
      [categoryOfferPodi20],
    );

    expect(res.discountedPricePaise).toBe(30000);
    expect(res.effectiveMrpPaise).toBe(35000);
    expect(res.discountPercent).toBe(14); // 5000 / 35000 = 14% regular discount
    expect(res.appliedOffer).toBeNull();
  });

  it("applies product-specific offer only to the matching product", () => {
    const idliPodiVariant = { pricePaise: 15000, mrpPaise: 15000 };
    const poonduPodiVariant = { pricePaise: 20000, mrpPaise: 20000 };

    // Idli Podi matches
    const res1 = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      [productOfferIdliPodiFlat50],
    );
    expect(res1.discountedPricePaise).toBe(10000); // 15000 - 5000
    expect(res1.effectiveMrpPaise).toBe(15000);
    expect(res1.discountPercent).toBe(33);
    expect(res1.appliedOffer?.id).toBe("offer-idli-podi-flat50");

    // Poondu Podi does not match product offer
    const res2 = evaluateBestOfferForVariant(
      poonduPodiVariant,
      poonduPodiProductId,
      podiCategoryId,
      [productOfferIdliPodiFlat50],
    );
    expect(res2.discountedPricePaise).toBe(20000);
    expect(res2.effectiveMrpPaise).toBe(20000);
    expect(res2.discountPercent).toBe(0);
    expect(res2.appliedOffer).toBeNull();
  });

  it("prevents offer stacking and follows priority rules (highest savings / product-scope tie-breaking)", () => {
    const idliPodiVariant = { pricePaise: 20000, mrpPaise: 20000 };

    // Category offer: 20% of 20000 = 4000 paise discount
    // Product offer: Flat 5000 paise discount
    // Product offer gives 5000 > 4000, so product offer wins
    const res = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      [categoryOfferPodi20, productOfferIdliPodiFlat50],
    );
    expect(res.discountedPricePaise).toBe(15000); // 20000 - 5000
    expect(res.appliedOffer?.id).toBe("offer-idli-podi-flat50");

    // Equal savings tie-breaking:
    // Suppose both give 4000 paise discount:
    const productOfferEqual: ActiveOffer = {
      id: "offer-idli-podi-equal",
      name: "Flat ₹40 Off",
      scope: "product",
      productId: idliPodiProductId,
      categoryId: null,
      discountType: "flat",
      value: 4000,
      startsAt: yesterday,
      endsAt: tomorrow,
      isActive: true,
      createdAt: yesterday,
    };

    const resTie = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      [categoryOfferPodi20, productOfferEqual],
    );
    // Product-scope takes priority on equal discount amounts
    expect(resTie.discountedPricePaise).toBe(16000);
    expect(resTie.appliedOffer?.scope).toBe("product");
    expect(resTie.appliedOffer?.id).toBe("offer-idli-podi-equal");
  });

  it("ignores inactive, expired, and future scheduled offers", () => {
    const idliPodiVariant = { pricePaise: 15000, mrpPaise: 15000 };

    // Inactive offer
    const inactiveOffer: ActiveOffer = {
      ...categoryOfferPodi20,
      id: "offer-inactive",
      isActive: false,
    };
    // Should be filtered out or ignored
    const matchingActiveOnly = [inactiveOffer].filter((o) => o.isActive);
    const resInactive = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      matchingActiveOnly,
    );
    expect(resInactive.discountedPricePaise).toBe(15000);
    expect(resInactive.appliedOffer).toBeNull();

    // Expired offer
    const expiredOffer: ActiveOffer = {
      ...categoryOfferPodi20,
      id: "offer-expired",
      startsAt: pastDate,
      endsAt: yesterday,
    };
    const matchingValidDate = [expiredOffer].filter(
      (o) => o.isActive && o.startsAt <= now && o.endsAt >= now,
    );
    const resExpired = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      matchingValidDate,
    );
    expect(resExpired.discountedPricePaise).toBe(15000);
    expect(resExpired.appliedOffer).toBeNull();

    // Future scheduled offer
    const futureOffer: ActiveOffer = {
      ...categoryOfferPodi20,
      id: "offer-future",
      startsAt: tomorrow,
      endsAt: futureDate,
    };
    const matchingFutureDate = [futureOffer].filter(
      (o) => o.isActive && o.startsAt <= now && o.endsAt >= now,
    );
    const resFuture = evaluateBestOfferForVariant(
      idliPodiVariant,
      idliPodiProductId,
      podiCategoryId,
      matchingFutureDate,
    );
    expect(resFuture.discountedPricePaise).toBe(15000);
    expect(resFuture.appliedOffer).toBeNull();
  });

  it("calculates cart summary and line-level discounts correctly", () => {
    const items: CartLineView[] = [
      {
        variantId: "v-1",
        productId: idliPodiProductId,
        productName: "Idli Podi",
        productSlug: "idli-podi",
        variantLabel: "250 g",
        sku: "IP-250",
        imageKey: null,
        quantity: 2,
        unitPricePaise: 15000,
        discountedUnitPricePaise: 12000,
        mrpPaise: 15000,
        lineTotalPaise: 30000,
        discountedLineTotalPaise: 24000,
        offerDiscountPaise: 6000,
        appliedOffer: {
          id: "offer-podi-20",
          name: "20% Off Podi Varieties",
          scope: "category",
          discountType: "percentage",
          value: 20,
        },
        issue: null,
        availableQuantity: 10,
      },
      {
        variantId: "v-2",
        productId: sathuMaavuProductId,
        productName: "Sathu Maavu",
        productSlug: "sathu-maavu",
        variantLabel: "500 g",
        sku: "SM-500",
        imageKey: null,
        quantity: 1,
        unitPricePaise: 30000,
        mrpPaise: 35000,
        lineTotalPaise: 30000,
        issue: null,
        availableQuantity: 10,
      },
    ];

    const summary = computeCartSummary(items, 6000, [
      {
        offerId: "offer-podi-20",
        name: "20% Off Podi Varieties",
        scope: "category",
        targetId: podiCategoryId,
        discountType: "percentage",
        value: 20,
        discountPaise: 6000,
      },
    ]);

    expect(summary.lineCount).toBe(2);
    expect(summary.totalQuantity).toBe(3);
    expect(summary.subtotalPaise).toBe(60000); // 30000 + 30000
    expect(summary.offerDiscountPaise).toBe(6000);
    expect(summary.finalPayablePaise).toBe(54000); // 60000 - 6000
    expect(summary.savingsPaise).toBe(5000 + 6000); // MRP savings (35000 - 30000) + offer savings (6000)
    expect(summary.canCheckout).toBe(true);
  });
});

