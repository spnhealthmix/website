import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import { startCheckout } from "../src/lib/orders/checkout";
import { expirePendingOrders } from "../src/lib/orders/expiry";
import type { PaymentGateway } from "../src/lib/payments/razorpay";
import { __test, verifyCheckoutSignature, verifyWebhookSignature } from "../src/lib/payments/signature";
import { handleRazorpayWebhook } from "../src/lib/payments/webhook";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:pw@localhost:5432/spn_test";
const pool = new Pool({ connectionString: url, max: 20 });
const db = drizzle(pool, { schema: s });
const SECRET = "whsec_test_secret";

let n = 0;
const gateway: PaymentGateway = { createOrder: async () => ({ id: `order_wh_${++n}` }) };
const address = { fullName: "T", phone: "9", line1: "1", city: "Chennai", state: "TN", pincode: "600001" };

let profileId: string;
let variantId: string;

async function setup(stock = 5) {
  await pool.query(
    "TRUNCATE webhook_events, payments, order_items, orders, product_variants, products, categories, profiles RESTART IDENTITY CASCADE",
  );
  const [p] = await db.insert(s.profiles).values({ clerkUserId: "u", email: "t@e.com" }).returning();
  const [c] = await db.insert(s.categories).values({ slug: "c", name: "C" }).returning();
  const [prod] = await db.insert(s.products).values({ categoryId: c.id, slug: "p", name: "P" }).returning();
  const [v] = await db
    .insert(s.productVariants)
    .values({ productId: prod.id, sku: "A", label: "250 g", mrpPaise: 20000, pricePaise: 15000, stock })
    .returning();
  profileId = p.id;
  variantId = v.id;
}

const deps = {
  webhookSecret: SECRET,
  withDb: <T,>(fn: (d: any) => Promise<T>) => fn(db),
  log: () => {},
};

async function webhookRequest(
  body: object | string,
  opts: { eventId?: string | null; secret?: string; signature?: string | null; method?: string } = {},
) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const sig = opts.signature === undefined ? await __test.hmacSha256Hex(opts.secret ?? SECRET, raw) : opts.signature;
  if (sig !== null) headers["x-razorpay-signature"] = sig;
  if (opts.eventId !== null) headers["x-razorpay-event-id"] = opts.eventId ?? `evt_${Math.random().toString(36).slice(2)}`;
  return new Request("https://spn.test/api/webhooks/razorpay", { method: opts.method ?? "POST", headers, body: opts.method === "GET" ? undefined : raw });
}

const captured = (orderId: string, amount: number, payId = "pay_1") => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: payId, order_id: orderId, amount, currency: "INR", method: "upi", status: "captured" } } },
});

const checkout = (qty = 1, ttlMinutes?: number) =>
  startCheckout(db, gateway, { profileId, lines: [{ variantId, quantity: qty }], shippingAddress: address, ttlMinutes });
const orderOf = async (id: string) => (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0];
const stock = async () => (await db.select().from(s.productVariants).where(eq(s.productVariants.id, variantId)))[0].stock;

beforeAll(() => migrate(db, { migrationsFolder: "./drizzle" }));
afterAll(() => pool.end());

describe("signature primitives", () => {
  it("webhook signature: accepts correct, rejects wrong/missing/other-length", async () => {
    const body = '{"a":1}';
    const good = await __test.hmacSha256Hex(SECRET, body);
    expect(await verifyWebhookSignature(body, good, SECRET)).toBe(true);
    expect(await verifyWebhookSignature(body + " ", good, SECRET)).toBe(false); // body tampered
    expect(await verifyWebhookSignature(body, good, "other")).toBe(false);
    expect(await verifyWebhookSignature(body, null, SECRET)).toBe(false);
    expect(await verifyWebhookSignature(body, "", SECRET)).toBe(false);
    expect(await verifyWebhookSignature(body, good.slice(0, -2), SECRET)).toBe(false);
    expect(await verifyWebhookSignature(body, good, "")).toBe(false); // unset secret never validates
  });

  it("checkout signature matches Razorpay's documented HMAC(order_id|payment_id)", async () => {
    // Independent computation with Node's crypto, not our helper.
    const { createHmac } = await import("node:crypto");
    const expected = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(await verifyCheckoutSignature({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_1", signature: expected }, "key_secret")).toBe(true);
    expect(await verifyCheckoutSignature({ razorpayOrderId: "order_1", razorpayPaymentId: "pay_2", signature: expected }, "key_secret")).toBe(false);
  });

  it("webhook signature matches an independent Node HMAC", async () => {
    const { createHmac } = await import("node:crypto");
    const body = '{"event":"payment.captured"}';
    expect(await verifyWebhookSignature(body, createHmac("sha256", SECRET).update(body).digest("hex"), SECRET)).toBe(true);
  });
});

describe("webhook endpoint", () => {
  beforeEach(() => setup(5));

  it("valid captured payment confirms the order", async () => {
    const r = await checkout(2);
    const res = await handleRazorpayWebhook(await webhookRequest(captured(r.razorpayOrderId, r.amountPaise)), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "confirmed" });
    expect((await orderOf(r.orderId)).status).toBe("confirmed");
  });

  it("rejects forged requests with 400 and changes nothing", async () => {
    const r = await checkout();
    const body = captured(r.razorpayOrderId, r.amountPaise);
    for (const opts of [{ signature: "deadbeef" }, { signature: null }, { secret: "attacker_secret" }]) {
      const res = await handleRazorpayWebhook(await webhookRequest(body, opts), deps);
      expect(res.status).toBe(400);
    }
    expect((await orderOf(r.orderId)).status).toBe("pending_payment");
    expect(await db.select().from(s.webhookEvents)).toHaveLength(0);
  });

  it("rejects a valid signature with a missing event id, bad JSON, wrong method, oversize body", async () => {
    const r = await checkout();
    expect((await handleRazorpayWebhook(await webhookRequest(captured(r.razorpayOrderId, r.amountPaise), { eventId: null }), deps)).status).toBe(400);
    expect((await handleRazorpayWebhook(await webhookRequest("not json{"), deps)).status).toBe(400);
    expect((await handleRazorpayWebhook(await webhookRequest({}, { method: "GET" }), deps)).status).toBe(405);
    expect((await handleRazorpayWebhook(await webhookRequest("x".repeat(300_000)), deps)).status).toBe(413);
  });

  it("malformed payment entity (wrong currency / non-integer amount) is a 400, not a crash", async () => {
    const r = await checkout();
    const bad = captured(r.razorpayOrderId, r.amountPaise) as any;
    bad.payload.payment.entity.currency = "USD";
    expect((await handleRazorpayWebhook(await webhookRequest(bad), deps)).status).toBe(400);
    const bad2 = captured(r.razorpayOrderId, 12.5);
    expect((await handleRazorpayWebhook(await webhookRequest(bad2), deps)).status).toBe(400);
    expect((await orderOf(r.orderId)).status).toBe("pending_payment");
  });

  it("same event delivered 5 times concurrently: processed once, others are duplicates", async () => {
    const r = await checkout();
    const evt = "evt_same";
    const results = await Promise.all(
      Array.from({ length: 5 }, async () =>
        (await handleRazorpayWebhook(await webhookRequest(captured(r.razorpayOrderId, r.amountPaise), { eventId: evt }), deps)).json(),
      ),
    );
    expect(results.filter((x: any) => x.status === "confirmed")).toHaveLength(1);
    expect(results.filter((x: any) => x.status === "duplicate")).toHaveLength(4);
    expect(await db.select().from(s.webhookEvents)).toHaveLength(1);
    expect(await stock()).toBe(4);
  });

  it("unknown Razorpay order -> 500 and NO event row, so Razorpay's retry is processed", async () => {
    const res = await handleRazorpayWebhook(await webhookRequest(captured("order_nope", 100), { eventId: "evt_unknown" }), deps);
    expect(res.status).toBe(500);
    expect(await db.select().from(s.webhookEvents)).toHaveLength(0);
  });

  it("database failure -> 500 and the event is not marked as seen (retry will work)", async () => {
    const r = await checkout();
    const brokenDeps = { ...deps, withDb: async () => { throw new Error("db down"); } } as any;
    const req = () => webhookRequest(captured(r.razorpayOrderId, r.amountPaise), { eventId: "evt_retry" });
    expect((await handleRazorpayWebhook(await req(), brokenDeps)).status).toBe(500);
    expect((await handleRazorpayWebhook(await req(), deps)).status).toBe(200); // the retry
    expect((await orderOf(r.orderId)).status).toBe("confirmed");
  });

  it("late payment through the webhook: re-reserves, and flags refund when stock is gone", async () => {
    const r1 = await checkout(2, -1);
    await expirePendingOrders(db);
    const ok = await handleRazorpayWebhook(await webhookRequest(captured(r1.razorpayOrderId, r1.amountPaise, "pay_late1")), deps);
    expect(await ok.json()).toEqual({ status: "confirmed_after_restock" });

    await setup(2);
    const r2 = await checkout(2, -1);
    await expirePendingOrders(db);
    await db.update(s.productVariants).set({ stock: 1 }).where(eq(s.productVariants.id, variantId));
    const bad = await handleRazorpayWebhook(await webhookRequest(captured(r2.razorpayOrderId, r2.amountPaise, "pay_late2")), deps);
    expect(await bad.json()).toEqual({ status: "refund_required" });
    expect((await orderOf(r2.orderId)).attentionReason).toBe("late_payment_no_stock");
  });

  it("payment.failed records the reason but keeps the order and its stock (customer can retry)", async () => {
    const r = await checkout(2);
    const failed = {
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_f", order_id: r.razorpayOrderId, amount: r.amountPaise, currency: "INR", error_description: "Card declined" } } },
    };
    const res = await handleRazorpayWebhook(await webhookRequest(failed), deps);
    expect(await res.json()).toEqual({ status: "recorded" });
    const [pay] = await db.select().from(s.payments);
    expect(pay).toMatchObject({ status: "created", failureReason: "Card declined" });
    expect((await orderOf(r.orderId)).status).toBe("pending_payment");
    expect(await stock()).toBe(3);

    // customer retries and pays
    const ok = await handleRazorpayWebhook(await webhookRequest(captured(r.razorpayOrderId, r.amountPaise, "pay_retry")), deps);
    expect(await ok.json()).toEqual({ status: "confirmed" });
  });

  it("unhandled events are acknowledged with 200 so Razorpay stops retrying", async () => {
    const res = await handleRazorpayWebhook(await webhookRequest({ event: "refund.processed", payload: {} }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ignored", event: "refund.processed" });
  });
});

describe("expiry grace period", () => {
  beforeEach(() => setup(5));

  it("an order that expired 2 minutes ago is spared with 5 min grace, taken with none", async () => {
    const r = await checkout(1, -2); // expired 2 minutes ago
    expect(await expirePendingOrders(db, { graceMinutes: 5 })).toEqual({ examined: 0, released: 0 });
    expect((await orderOf(r.orderId)).status).toBe("pending_payment");
    expect(await expirePendingOrders(db, { graceMinutes: 0 })).toEqual({ examined: 1, released: 1 });
  });
});
