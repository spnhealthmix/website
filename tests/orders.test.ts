/**
 * Runs against a REAL Postgres (not a mock) because the properties under test
 * (row locks, atomic UPDATE, deadlocks) only exist in a real database.
 *
 *   TEST_DATABASE_URL=postgres://user:pw@localhost:5432/spn_test npm test
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import { OrderError } from "../src/lib/orders/common";
import { applyCapturedPayment, processCapturedPaymentEvent } from "../src/lib/orders/capture-payment";
import { startCheckout } from "../src/lib/orders/checkout";
import { createPendingOrder } from "../src/lib/orders/create-order";
import { expirePendingOrders } from "../src/lib/orders/expiry";
import { releaseOrderStock } from "../src/lib/orders/stock";
import type { PaymentGateway } from "../src/lib/payments/razorpay";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:pw@localhost:5432/spn_test";
const pool = new Pool({ connectionString: url, max: 40 });
const db = drizzle(pool, { schema: s });

const address = { fullName: "Test", phone: "9999999999", line1: "1 Test St", city: "Chennai", state: "TN", pincode: "600001" };

let rzpCounter = 0;
const okGateway: PaymentGateway = { createOrder: async () => ({ id: `order_test_${++rzpCounter}` }) };
const failingGateway: PaymentGateway = {
  createOrder: async () => {
    throw new Error("razorpay is down");
  },
};

let profileId: string;
let variantA: string;
let variantB: string;

async function setup(stockA: number, stockB = 100) {
  await pool.query(
    "TRUNCATE webhook_events, payments, order_items, orders, product_variants, product_images, products, categories, addresses, profiles RESTART IDENTITY CASCADE",
  );
  const [p] = await db.insert(s.profiles).values({ clerkUserId: "u1", email: "t@example.com" }).returning();
  const [c] = await db.insert(s.categories).values({ slug: "c", name: "C" }).returning();
  const [prod] = await db.insert(s.products).values({ categoryId: c.id, slug: "p", name: "Prod" }).returning();
  const [prod2] = await db.insert(s.products).values({ categoryId: c.id, slug: "p2", name: "Prod 2" }).returning();
  const [a] = await db
    .insert(s.productVariants)
    .values({ productId: prod.id, sku: "A", label: "250 g", mrpPaise: 20000, pricePaise: 15000, stock: stockA })
    .returning();
  const [b] = await db
    .insert(s.productVariants)
    .values({ productId: prod2.id, sku: "B", label: "500 g", mrpPaise: 40000, pricePaise: 30000, stock: stockB })
    .returning();
  profileId = p.id;
  variantA = a.id;
  variantB = b.id;
}

const stockOf = async (id: string) =>
  (await db.select().from(s.productVariants).where(eq(s.productVariants.id, id)))[0].stock;
const orderOf = async (id: string) => (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0];
const paymentOf = async (orderId: string) =>
  (await db.select().from(s.payments).where(eq(s.payments.orderId, orderId)))[0];

const checkout = (lines: { variantId: string; quantity: number }[], opts: { ttlMinutes?: number; gw?: PaymentGateway } = {}) =>
  startCheckout(db, opts.gw ?? okGateway, { profileId, lines, shippingAddress: address, ttlMinutes: opts.ttlMinutes });

const capture = (rzpOrderId: string, amountPaise: number, payId = `pay_${rzpOrderId}`) =>
  applyCapturedPayment(db, { razorpayOrderId: rzpOrderId, razorpayPaymentId: payId, amountPaise });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
});
afterAll(() => pool.end());

describe("overselling protection", () => {
  beforeEach(() => setup(1));

  it("two simultaneous checkouts for the last unit: exactly one wins", async () => {
    const results = await Promise.allSettled([
      checkout([{ variantId: variantA, quantity: 1 }]),
      checkout([{ variantId: variantA, quantity: 1 }]),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const bad = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(bad[0].reason).toBeInstanceOf(OrderError);
    expect((bad[0].reason as OrderError).code).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(variantA)).toBe(0);
    expect(await db.select().from(s.orders)).toHaveLength(1);
  });

  it("25 simultaneous checkouts for 7 units: exactly 7 succeed, stock never negative", async () => {
    await db.update(s.productVariants).set({ stock: 7 }).where(eq(s.productVariants.id, variantA));
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => checkout([{ variantId: variantA, quantity: 1 }])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(7);
    expect(await stockOf(variantA)).toBe(0);
    expect(await db.select().from(s.orders)).toHaveLength(7);
  });

  it("mixed quantities: 6 checkouts of 3 against 10 units -> 3 win, 1 left", async () => {
    await db.update(s.productVariants).set({ stock: 10 }).where(eq(s.productVariants.id, variantA));
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => checkout([{ variantId: variantA, quantity: 3 }])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await stockOf(variantA)).toBe(1);
  });

  it("a cart that fails on its 2nd line rolls back the 1st line's stock and creates no order", async () => {
    await db.update(s.productVariants).set({ stock: 5 }).where(eq(s.productVariants.id, variantA));
    await db.update(s.productVariants).set({ stock: 1 }).where(eq(s.productVariants.id, variantB));
    await expect(
      checkout([{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 2 }]),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await stockOf(variantA)).toBe(5);
    expect(await stockOf(variantB)).toBe(1);
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await db.select().from(s.orderItems)).toHaveLength(0);
  });

  it("opposite line orders across concurrent checkouts do not deadlock", async () => {
    await db.update(s.productVariants).set({ stock: 100 }).where(eq(s.productVariants.id, variantA));
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        checkout(
          i % 2
            ? [{ variantId: variantA, quantity: 1 }, { variantId: variantB, quantity: 1 }]
            : [{ variantId: variantB, quantity: 1 }, { variantId: variantA, quantity: 1 }],
        ),
      ),
    );
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    expect(await stockOf(variantA)).toBe(70);
    expect(await stockOf(variantB)).toBe(70);
  });
});

describe("order contents", () => {
  beforeEach(() => setup(10));

  it("takes prices from the database, snapshots items, merges duplicate lines", async () => {
    const r = await checkout([
      { variantId: variantA, quantity: 2 },
      { variantId: variantA, quantity: 1 },
      { variantId: variantB, quantity: 1 },
    ]);
    const order = await orderOf(r.orderId);
    expect(order.status).toBe("pending_payment");
    expect(order.subtotalPaise).toBe(3 * 15000 + 30000);
    expect(order.totalPaise).toBe(order.subtotalPaise);
    expect(order.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(order.expiresAt!.getTime()).toBeLessThan(Date.now() + 31 * 60_000);
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, r.orderId));
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.sku === "A")).toMatchObject({ quantity: 3, unitPricePaise: 15000, productName: "Prod", variantLabel: "250 g" });
    expect(await stockOf(variantA)).toBe(7);
    expect((await paymentOf(r.orderId)).razorpayOrderId).toBe(r.razorpayOrderId);
  });

  it("rejects empty carts, bad quantities, unknown and inactive variants without touching stock", async () => {
    await expect(createPendingOrder(db, { profileId, lines: [], shippingAddress: address })).rejects.toMatchObject({ code: "EMPTY_CART" });
    for (const q of [0, -1, 1.5, 100]) {
      await expect(checkout([{ variantId: variantA, quantity: q }])).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
    }
    await expect(checkout([{ variantId: "00000000-0000-0000-0000-000000000000", quantity: 1 }])).rejects.toMatchObject({ code: "VARIANT_UNAVAILABLE" });
    await db.update(s.productVariants).set({ isActive: false }).where(eq(s.productVariants.id, variantA));
    await expect(checkout([{ variantId: variantA, quantity: 1 }])).rejects.toMatchObject({ code: "VARIANT_UNAVAILABLE" });
    expect(await stockOf(variantA)).toBe(10);
  });
});

describe("Razorpay failure", () => {
  beforeEach(() => setup(5));

  it("releases stock immediately and cancels the order", async () => {
    await expect(checkout([{ variantId: variantA, quantity: 2 }], { gw: failingGateway })).rejects.toMatchObject({ code: "PAYMENT_PROVIDER_ERROR" });
    expect(await stockOf(variantA)).toBe(5);
    const [order] = await db.select().from(s.orders);
    expect(order).toMatchObject({ status: "cancelled", stockReleased: true, cancelReason: "razorpay_order_failed" });
    expect(await db.select().from(s.payments)).toHaveLength(0);
  });
});

describe("stock release is idempotent", () => {
  beforeEach(() => setup(5));

  it("restores stock once even with 10 concurrent release calls", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 2 }]);
    expect(await stockOf(variantA)).toBe(3);
    const results = await Promise.all(Array.from({ length: 10 }, () => releaseOrderStock(db, r.orderId, { reason: "test" })));
    expect(results.filter((x) => x.released)).toHaveLength(1);
    expect(await stockOf(variantA)).toBe(5);
  });

  it("never releases a paid order", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 2 }]);
    await capture(r.razorpayOrderId, r.amountPaise);
    expect(await releaseOrderStock(db, r.orderId, { reason: "test" })).toEqual({ released: false, reason: "not_pending" });
    expect(await stockOf(variantA)).toBe(3);
    expect((await orderOf(r.orderId)).status).toBe("confirmed");
  });
});

describe("expiry cron", () => {
  beforeEach(() => setup(10));

  it("cancels only expired pending orders and restores their stock once", async () => {
    const expired = await checkout([{ variantId: variantA, quantity: 3 }], { ttlMinutes: -1 });
    const live = await checkout([{ variantId: variantA, quantity: 2 }]);
    const paid = await checkout([{ variantId: variantA, quantity: 1 }]);
    await capture(paid.razorpayOrderId, paid.amountPaise);
    expect(await stockOf(variantA)).toBe(4);

    expect(await expirePendingOrders(db)).toEqual({ examined: 1, released: 1 });
    expect(await stockOf(variantA)).toBe(7);
    expect(await orderOf(expired.orderId)).toMatchObject({ status: "cancelled", cancelReason: "expired", stockReleased: true });
    expect((await orderOf(live.orderId)).status).toBe("pending_payment");
    expect((await orderOf(paid.orderId)).status).toBe("confirmed");

    expect(await expirePendingOrders(db)).toEqual({ examined: 0, released: 0 });
    expect(await stockOf(variantA)).toBe(7);
  });

  it("two overlapping cron runs restore stock once", async () => {
    await checkout([{ variantId: variantA, quantity: 4 }], { ttlMinutes: -1 });
    await Promise.all([expirePendingOrders(db), expirePendingOrders(db), expirePendingOrders(db)]);
    expect(await stockOf(variantA)).toBe(10);
  });
});

describe("payments", () => {
  beforeEach(() => setup(5));

  it("on-time payment confirms the order; duplicate webhook delivery is a no-op", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 2 }]);
    const event = {
      eventId: "evt_1",
      eventType: "payment.captured",
      payload: { hello: "world" },
      payment: { razorpayOrderId: r.razorpayOrderId, razorpayPaymentId: "pay_1", amountPaise: r.amountPaise, method: "upi" },
    };
    const first = await processCapturedPaymentEvent(db, event);
    expect(first).toMatchObject({ duplicate: false, outcome: "confirmed" });
    const replay = await Promise.all([processCapturedPaymentEvent(db, event), processCapturedPaymentEvent(db, event)]);
    expect(replay).toEqual([{ duplicate: true }, { duplicate: true }]);

    expect((await orderOf(r.orderId)).status).toBe("confirmed");
    expect(await paymentOf(r.orderId)).toMatchObject({ status: "captured", razorpayPaymentId: "pay_1", method: "upi" });
    expect(await db.select().from(s.webhookEvents)).toHaveLength(1);
    expect(await stockOf(variantA)).toBe(3);
  });

  it("same payment delivered under a different event id is still idempotent", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 1 }]);
    expect((await capture(r.razorpayOrderId, r.amountPaise, "pay_x")).outcome).toBe("confirmed");
    expect((await capture(r.razorpayOrderId, r.amountPaise, "pay_x")).outcome).toBe("already_processed");
  });

  it("LATE payment, stock still available: re-reserves and confirms", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 2 }], { ttlMinutes: -1 });
    await expirePendingOrders(db);
    expect(await stockOf(variantA)).toBe(5);

    expect((await capture(r.razorpayOrderId, r.amountPaise)).outcome).toBe("confirmed_after_restock");
    expect(await orderOf(r.orderId)).toMatchObject({ status: "confirmed", stockReleased: false, cancelReason: null, attentionReason: null });
    expect((await paymentOf(r.orderId)).status).toBe("captured");
    expect(await stockOf(variantA)).toBe(3);
  });

  it("LATE payment, stock gone: flagged for refund, nothing silently accepted, no partial stock taken", async () => {
    const r = await checkout(
      [{ variantId: variantA, quantity: 2 }, { variantId: variantB, quantity: 1 }],
      { ttlMinutes: -1 },
    );
    await expirePendingOrders(db);
    // Someone else buys all remaining units of A while the payment is in flight.
    await db.update(s.productVariants).set({ stock: 1 }).where(eq(s.productVariants.id, variantA));
    const bBefore = await stockOf(variantB);

    expect((await capture(r.razorpayOrderId, r.amountPaise)).outcome).toBe("refund_required");
    expect(await orderOf(r.orderId)).toMatchObject({ status: "cancelled", attentionReason: "late_payment_no_stock" });
    expect(await paymentOf(r.orderId)).toMatchObject({ status: "refund_required", razorpayPaymentId: `pay_${r.razorpayOrderId}` });
    expect(await stockOf(variantA)).toBe(1);
    expect(await stockOf(variantB)).toBe(bBefore); // line B was rolled back by the savepoint
  });

  it("amount mismatch is never confirmed", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 1 }]);
    expect((await capture(r.razorpayOrderId, r.amountPaise - 1)).outcome).toBe("refund_required");
    expect(await orderOf(r.orderId)).toMatchObject({ status: "pending_payment", attentionReason: "payment_amount_mismatch" });
  });

  it("a second, different payment on a paid order is flagged without corrupting the first", async () => {
    const r = await checkout([{ variantId: variantA, quantity: 1 }]);
    await capture(r.razorpayOrderId, r.amountPaise, "pay_first");
    expect((await capture(r.razorpayOrderId, r.amountPaise, "pay_second")).outcome).toBe("refund_required");
    expect(await paymentOf(r.orderId)).toMatchObject({ status: "captured", razorpayPaymentId: "pay_first" });
    expect((await orderOf(r.orderId)).attentionReason).toBe("payment_on_non_pending_order: refund pay_second");
    expect((await orderOf(r.orderId)).status).toBe("confirmed");
  });

  it("payment racing the expiry cron never loses or double-counts stock (20 rounds)", async () => {
    for (let i = 0; i < 20; i++) {
      await setup(5);
      const r = await checkout([{ variantId: variantA, quantity: 2 }], { ttlMinutes: -1 });
      const [, res] = await Promise.all([expirePendingOrders(db), capture(r.razorpayOrderId, r.amountPaise)]);
      expect(["confirmed", "confirmed_after_restock"]).toContain(res.outcome);
      expect((await orderOf(r.orderId)).status).toBe("confirmed");
      expect((await paymentOf(r.orderId)).status).toBe("captured");
      expect(await stockOf(variantA)).toBe(3); // 5 - 2, whichever side won
    }
  });
});
