import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import { calculateDiscounts, normalizeCouponCode } from "../src/lib/discounts/engine";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";
import {
  acall, addAddress, call, categoryId as seedCategoryId, checkout, db, deps, fillCart, makeAdmin,
  productId as seedProductId, useHarness, variantId, variant2Id,
} from "./harness";

useHarness();

const SOME_UUID = "11111111-1111-4111-8111-111111111111";

const admin = async () => {
  await makeAdmin("boss");
};

describe("Offers & Coupons — Admin Access Control", () => {
  it("rejects unauthenticated requests to offers and coupons", async () => {
    const endpoints = [
      { method: "GET", path: "/api/admin/offers" },
      { method: "POST", path: "/api/admin/offers", body: { name: "Test" } },
      { method: "GET", path: "/api/admin/coupons" },
      { method: "POST", path: "/api/admin/coupons", body: { code: "TEST" } },
    ];

    for (const ep of endpoints) {
      const res = await acall(ep.method, ep.path, { user: undefined, body: ep.body });
      expect(res.status).toBe(401);
    }
  });

  it("rejects non-admin customer requests with 403 Forbidden", async () => {
    const endpoints = [
      { method: "GET", path: "/api/admin/offers" },
      { method: "POST", path: "/api/admin/offers", body: { name: "Test" } },
      { method: "GET", path: "/api/admin/coupons" },
      { method: "POST", path: "/api/admin/coupons", body: { code: "TEST" } },
    ];

    for (const ep of endpoints) {
      const res = await acall(ep.method, ep.path, { user: "regular-customer", body: ep.body });
      expect(res.status).toBe(403);
    }
  });

  it("rejects mutations with untrusted origin (CSRF protection)", async () => {
    await admin();
    const res = await acall("POST", "/api/admin/offers", {
      user: "boss",
      origin: "https://evil-attacker.com",
      body: { name: "Hack" },
    });
    expect(res.status).toBe(403);
  });
});

describe("Admin Offers Management", () => {
  it("creates, updates, toggles and deletes a product-level offer", async () => {
    await admin();

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);

    // 1. Create product offer
    const createRes = await acall("POST", "/api/admin/offers", {
      user: "boss",
      body: {
        name: "Health Mix 20% Off",
        scope: "product",
        productId: seedProductId,
        discountType: "percentage",
        value: 20,
        startsAt: now.toISOString(),
        endsAt: nextWeek.toISOString(),
        isActive: true,
      },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Health Mix 20% Off");
    expect(createRes.body.value).toBe(20);
    const offerId = createRes.body.id;

    // 2. List offers
    const listRes = await acall("GET", "/api/admin/offers", { user: "boss" });
    expect(listRes.status).toBe(200);
    expect(listRes.body.offers.some((o: any) => o.id === offerId)).toBe(true);

    // 3. Update offer value and name
    const updateRes = await acall("PATCH", `/api/admin/offers/${offerId}`, {
      user: "boss",
      body: {
        name: "Health Mix 25% Off Super Deal",
        value: 25,
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Health Mix 25% Off Super Deal");
    expect(updateRes.body.value).toBe(25);

    // 4. Toggle active state
    const deactivateRes = await acall("PATCH", `/api/admin/offers/${offerId}`, {
      user: "boss",
      body: { isActive: false },
    });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.isActive).toBe(false);

    // 5. Delete offer safely
    const deleteRes = await acall("DELETE", `/api/admin/offers/${offerId}`, { user: "boss" });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const getRes = await acall("GET", `/api/admin/offers/${offerId}`, { user: "boss" });
    expect(getRes.status).toBe(404);
  });

  it("validates offer scope, dates, and percentage limits", async () => {
    await admin();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);

    // Product scope missing productId
    const res1 = await acall("POST", "/api/admin/offers", {
      user: "boss",
      body: {
        name: "Invalid",
        scope: "product",
        discountType: "percentage",
        value: 10,
        startsAt: now.toISOString(),
        endsAt: tomorrow.toISOString(),
      },
    });
    expect(res1.status).toBe(422);

    // End date before start date
    const res2 = await acall("POST", "/api/admin/offers", {
      user: "boss",
      body: {
        name: "Invalid",
        scope: "product",
        productId: seedProductId,
        discountType: "percentage",
        value: 10,
        startsAt: now.toISOString(),
        endsAt: yesterday.toISOString(),
      },
    });
    expect(res2.status).toBe(422);

    // Percentage > 100
    const res3 = await acall("POST", "/api/admin/offers", {
      user: "boss",
      body: {
        name: "Invalid",
        scope: "product",
        productId: seedProductId,
        discountType: "percentage",
        value: 150,
        startsAt: now.toISOString(),
        endsAt: tomorrow.toISOString(),
      },
    });
    expect(res3.status).toBe(422);
  });
});

describe("Admin Coupons Management", () => {
  it("creates, normalizes, updates, and safely deactivates coupons", async () => {
    await admin();

    // 1. Create coupon with lowercase - should normalize to uppercase
    const createRes = await acall("POST", "/api/admin/coupons", {
      user: "boss",
      body: {
        code: "spnwelcome10",
        discountType: "percentage",
        value: 10,
        minOrderPaise: 50000, // ₹500
        maxDiscountPaise: 10000, // ₹100 cap
        maxUses: 100,
      },
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.code).toBe("SPNWELCOME10");
    expect(createRes.body.minOrderPaise).toBe(50000);
    const couponId = createRes.body.id;

    // 2. Reject duplicate code (case-insensitive)
    const dupRes = await acall("POST", "/api/admin/coupons", {
      user: "boss",
      body: {
        code: "SpnWelcome10",
        discountType: "flat",
        value: 5000,
      },
    });
    expect(dupRes.status).toBe(409);

    // 3. Update coupon
    const updateRes = await acall("PATCH", `/api/admin/coupons/${couponId}`, {
      user: "boss",
      body: {
        value: 15,
        maxUses: 250,
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.value).toBe(15);
    expect(updateRes.body.maxUses).toBe(250);

    // 4. Safe deletion when coupon has usage history
    // Simulate 1 usage
    await db.update(s.coupons).set({ usedCount: 1 }).where(eq(s.coupons.id, couponId));

    const delRes = await acall("DELETE", `/api/admin/coupons/${couponId}`, { user: "boss" });
    expect(delRes.status).toBe(200);
    expect(delRes.body.deactivated).toBe(true);

    const getRes = await acall("GET", `/api/admin/coupons/${couponId}`, { user: "boss" });
    expect(getRes.status).toBe(200);
    expect(getRes.body.isActive).toBe(false);
  });
});

describe("Authoritative Discount Engine", () => {
  it("calculates percentage discount with deterministic integer paise rounding", async () => {
    const items = [
      {
        variantId: "v1",
        productId: seedProductId,
        quantity: 1,
        unitPricePaise: 999, // ₹9.99
        lineTotalPaise: 999,
      },
    ];

    // Create 15% coupon
    const [c] = await db
      .insert(s.coupons)
      .values({
        code: "ROUND15",
        discountType: "percentage",
        value: 15,
        isActive: true,
      })
      .returning();

    // 999 * 0.15 = 149.85 -> rounded to 150 paise
    const res = await calculateDiscounts(db, { items, couponCode: "round15" });
    expect(res.couponDiscountPaise).toBe(150);
    expect(res.finalPayablePaise).toBe(849);
    expect(res.finalPayablePaise).toBe(res.subtotalPaise - res.totalDiscountPaise);
  });

  it("enforces maximum discount cap on coupons", async () => {
    const items = [
      {
        variantId: "v1",
        productId: seedProductId,
        quantity: 1,
        unitPricePaise: 100000, // ₹1,000
        lineTotalPaise: 100000,
      },
    ];

    // 20% coupon capped at ₹100 (10000 paise)
    await db.insert(s.coupons).values({
      code: "CAP100",
      discountType: "percentage",
      value: 20, // 20% of 100,000 = 20,000 paise
      maxDiscountPaise: 10000, // cap is 10,000
      isActive: true,
    });

    const res = await calculateDiscounts(db, { items, couponCode: "CAP100" });
    expect(res.couponDiscountPaise).toBe(10000);
    expect(res.finalPayablePaise).toBe(90000);
  });

  it("validates inactive, expired, and minimum order requirements", async () => {
    const now = new Date();
    const items = [
      {
        variantId: "v1",
        productId: seedProductId,
        quantity: 1,
        unitPricePaise: 40000, // ₹400
        lineTotalPaise: 40000,
      },
    ];

    // Inactive coupon
    await db.insert(s.coupons).values({ code: "INACTIVE", discountType: "flat", value: 5000, isActive: false });
    const resInactive = await calculateDiscounts(db, { items, couponCode: "INACTIVE", now });
    expect(resInactive.couponError).toBe("Coupon is not active");

    // Expired coupon
    await db.insert(s.coupons).values({
      code: "EXPIRED",
      discountType: "flat",
      value: 5000,
      endsAt: new Date(now.getTime() - 10000),
      isActive: true,
    });
    const resExpired = await calculateDiscounts(db, { items, couponCode: "EXPIRED", now });
    expect(resExpired.couponError).toBe("Coupon has expired");

    // Min order required ₹500 (50000 paise), cart only has ₹400
    await db.insert(s.coupons).values({
      code: "MIN500",
      discountType: "flat",
      value: 5000,
      minOrderPaise: 50000,
      isActive: true,
    });
    const resMin = await calculateDiscounts(db, { items, couponCode: "MIN500", now });
    expect(resMin.couponError).toContain("Minimum order amount");
  });

  it("applies automatic offers and stacks deterministically with coupons", async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 86400000);
    const past = new Date(now.getTime() - 86400000);

    // Create 10% product offer
    await db.insert(s.offers).values({
      name: "Auto 10%",
      scope: "product",
      productId: seedProductId,
      discountType: "percentage",
      value: 10,
      startsAt: past,
      endsAt: future,
      isActive: true,
    });

    // Create ₹50 flat coupon
    await db.insert(s.coupons).values({
      code: "FLAT50",
      discountType: "flat",
      value: 5000, // ₹50
      isActive: true,
    });

    const items = [
      {
        variantId: "v1",
        productId: seedProductId,
        quantity: 1,
        unitPricePaise: 50000, // ₹500
        lineTotalPaise: 50000,
      },
    ];

    const res = await calculateDiscounts(db, { items, couponCode: "FLAT50", now });
    // Offer: 10% of ₹500 = ₹50 (5000 paise)
    expect(res.offerDiscountPaise).toBe(5000);
    // Coupon: ₹50 (5000 paise)
    expect(res.couponDiscountPaise).toBe(5000);
    // Total discount: ₹100 (10000 paise)
    expect(res.totalDiscountPaise).toBe(10000);
    // Final payable: ₹400 (40000 paise)
    expect(res.finalPayablePaise).toBe(40000);
    expect(res.finalPayablePaise).toBe(res.subtotalPaise - res.totalDiscountPaise);
  });
});

describe("Cart & Checkout Integration", () => {
  it("previews coupon discount via POST /api/cart/coupon", async () => {
    await fillCart("cust_c1", [{ variantId, quantity: 2 }]); // price: 15000 * 2 = 30000 paise (₹300)

    await db.insert(s.coupons).values({
      code: "CART10",
      discountType: "percentage",
      value: 10,
      isActive: true,
    });

    const res = await call("POST", "/api/cart/coupon", {
      user: "cust_c1",
      body: { couponCode: "CART10" },
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.subtotalPaise).toBe(30000);
    expect(res.body.couponDiscountPaise).toBe(3000);
    expect(res.body.finalPayablePaise).toBe(27000);
  });

  it("calculates server-authoritative payable amount and passes it to Razorpay", async () => {
    const addr = await addAddress("cust_c2");
    await fillCart("cust_c2", [{ variantId, quantity: 1 }]); // price: 15000 paise (₹150)

    await db.insert(s.coupons).values({
      code: "CHECKOUT20",
      discountType: "flat",
      value: 2000, // ₹20 off
      isActive: true,
    });

    const res = await call("POST", "/api/checkout", {
      user: "cust_c2",
      body: {
        addressId: addr.id,
        couponCode: "CHECKOUT20",
        expectedSubtotalPaise: 15000,
      },
    });

    expect(res.status).toBe(201);
    // 15000 - 2000 = 13000 paise (plus 0 shipping)
    expect(res.body.amountPaise).toBe(13000);

    // Verify database snapshot
    const [savedOrder] = await db.select().from(s.orders).where(eq(s.orders.id, res.body.orderId));
    expect(savedOrder.subtotalPaise).toBe(15000);
    expect(savedOrder.discountPaise).toBe(2000);
    expect(savedOrder.totalPaise).toBe(13000);
    expect(savedOrder.couponCode).toBe("CHECKOUT20");
  });

  it("rejects checkout when coupon code is invalid", async () => {
    const addr = await addAddress("cust_c3");
    await fillCart("cust_c3", [{ variantId, quantity: 1 }]);

    const res = await call("POST", "/api/checkout", {
      user: "cust_c3",
      body: {
        addressId: addr.id,
        couponCode: "NONEXISTENT",
        expectedSubtotalPaise: 15000,
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_COUPON");
  });

  it("safely increments coupon usage upon payment capture and prevents over-subscription", async () => {
    const addr = await addAddress("cust_c4");
    await fillCart("cust_c4", [{ variantId, quantity: 1 }]);

    // Coupon with maxUses = 1
    const [c] = await db
      .insert(s.coupons)
      .values({
        code: "LIMIT1",
        discountType: "flat",
        value: 1000,
        maxUses: 1,
        usedCount: 0,
        isActive: true,
      })
      .returning();

    // Customer places order
    const res = await call("POST", "/api/checkout", {
      user: "cust_c4",
      body: {
        addressId: addr.id,
        couponCode: "LIMIT1",
        expectedSubtotalPaise: 15000,
      },
    });
    expect(res.status).toBe(201);

    // Capture payment
    const capRes = await applyCapturedPayment(db, {
      razorpayOrderId: res.body.razorpayOrderId,
      razorpayPaymentId: "pay_limit_test",
      amountPaise: res.body.amountPaise,
    });
    expect(capRes.outcome).toBe("confirmed");

    // Check usedCount incremented to 1
    const [updatedCoupon] = await db.select().from(s.coupons).where(eq(s.coupons.id, c.id));
    expect(updatedCoupon.usedCount).toBe(1);

    // Another customer attempts to checkout with LIMIT1
    const addr2 = await addAddress("cust_c5");
    await fillCart("cust_c5", [{ variantId, quantity: 1 }]);

    const res2 = await call("POST", "/api/checkout", {
      user: "cust_c5",
      body: {
        addressId: addr2.id,
        couponCode: "LIMIT1",
        expectedSubtotalPaise: 15000,
      },
    });
    // Immediately rejected because usage limit has been reached!
    expect(res2.status).toBe(400);
    expect(res2.body.error.message).toContain("usage limit");
  });

  it("preserves historical order snapshots when coupon is updated or deactivated later", async () => {
    const addr = await addAddress("cust_c6");
    await fillCart("cust_c6", [{ variantId, quantity: 1 }]);

    const [c] = await db
      .insert(s.coupons)
      .values({
        code: "HISTORICAL10",
        discountType: "flat",
        value: 1000,
        isActive: true,
      })
      .returning();

    const res = await call("POST", "/api/checkout", {
      user: "cust_c6",
      body: {
        addressId: addr.id,
        couponCode: "HISTORICAL10",
        expectedSubtotalPaise: 15000,
      },
    });
    expect(res.status).toBe(201);

    // Admin later changes or deactivates the coupon
    await admin();
    await acall("PATCH", `/api/admin/coupons/${c.id}`, {
      user: "boss",
      body: { value: 5000, isActive: false },
    });

    // Existing order snapshot must be strictly untouched
    const [historicalOrder] = await db.select().from(s.orders).where(eq(s.orders.id, res.body.orderId));
    expect(historicalOrder.discountPaise).toBe(1000);
    expect(historicalOrder.totalPaise).toBe(14000);
    expect(historicalOrder.couponCode).toBe("HISTORICAL10");
  });
});
