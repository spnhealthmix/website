import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as api from "../src/lib/api/customer-api";
import type { ApiDeps } from "../src/lib/api/customer-api";
import { handleClerkWebhook } from "../src/lib/customers/clerk-webhook";
import { ensureProfile } from "../src/lib/customers/profile";
import { normalizeIndianMobile } from "../src/lib/customers/validation";
import * as s from "../src/lib/db/schema";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";
import { expirePendingOrders } from "../src/lib/orders/expiry";
import type { PaymentGateway } from "../src/lib/payments/razorpay";
import { verifySvixSignature } from "../src/lib/payments/signature";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:pw@localhost:5432/spn_test";
const pool = new Pool({ connectionString: url, max: 30 });
const db = drizzle(pool, { schema: s });

const KEY_SECRET = "rzp_key_secret_test";
let rzpN = 0;
const gatewayCalls: { amountPaise: number; receipt: string }[] = [];
let gatewayFails = false;
const gateway: PaymentGateway = {
  createOrder: async (p) => {
    if (gatewayFails) throw new Error("razorpay down");
    gatewayCalls.push({ amountPaise: p.amountPaise, receipt: p.receipt });
    return { id: `order_cust_${++rzpN}` };
  },
};

// Test stand-in for Clerk: the "session" is the x-test-user header. Everything below the
// authenticate() seam (profile sync, ownership, checkout) is the real production code.
const deps: ApiDeps = {
  withDb: (fn) => fn(db),
  authenticate: async (req, d) => {
    const uid = req.headers.get("x-test-user");
    return uid ? ensureProfile(d, uid, async () => ({ email: `${uid}@example.com`, name: uid })) : null;
  },
  gateway,
  razorpayKeyId: "rzp_test_keyid",
  razorpayKeySecret: KEY_SECRET,
  allowedOrigins: ["https://spn.test"],
  log: () => {},
};

type Opts = { user?: string; body?: unknown; raw?: string; contentType?: string | null; headers?: Record<string, string> };
async function call(method: string, path: string, o: Opts = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.user) headers["x-test-user"] = o.user;
  let body: string | undefined;
  if (o.raw !== undefined) body = o.raw;
  else if (o.body !== undefined) body = JSON.stringify(o.body);
  if (body !== undefined && o.contentType !== null) headers["content-type"] = o.contentType ?? "application/json";
  const req = new Request("https://spn.test" + path, { method, headers, body });

  let m: RegExpMatchArray | null;
  let res: Response;
  if (path === "/api/me") res = await (method === "GET" ? api.getMe : api.patchMe)(req, deps);
  else if (path === "/api/me/addresses") res = await (method === "GET" ? api.getAddresses : api.postAddress)(req, deps);
  else if ((m = path.match(/^\/api\/me\/addresses\/([^/]+)\/default$/))) res = await api.postDefaultAddress(req, deps, m[1]);
  else if ((m = path.match(/^\/api\/me\/addresses\/([^/]+)$/))) res = await (method === "PATCH" ? api.patchAddress : api.removeAddress)(req, deps, m[1]);
  else if (path.startsWith("/api/me/orders?") || path === "/api/me/orders") res = await api.getOrders(req, deps);
  else if ((m = path.match(/^\/api\/me\/orders\/([^/]+)$/))) res = await api.getOrder(req, deps, m[1]);
  else if (path === "/api/checkout") res = await api.postCheckout(req, deps);
  else if (path === "/api/checkout/verify") res = await api.postCheckoutVerify(req, deps);
  else throw new Error("no route " + path);
  return { status: res.status, body: (await res.json()) as any, headers: res.headers };
}

const ADDR = { fullName: "Asha Raman", phone: "9876543210", line1: "12 Gandhi Street", city: "Chennai", state: "Tamil Nadu", pincode: "600017" };
let variantId: string;
let variant2Id: string;

async function setup() {
  await pool.query(
    "TRUNCATE webhook_events, payments, shipments, order_items, orders, product_variants, products, categories, addresses, profiles, site_settings RESTART IDENTITY CASCADE",
  );
  const [c] = await db.insert(s.categories).values({ slug: "c", name: "C" }).returning();
  const [p] = await db.insert(s.products).values({ categoryId: c.id, slug: "p", name: "Karuppu Kavuni Kanji Mix" }).returning();
  const [v] = await db.insert(s.productVariants).values({ productId: p.id, sku: "KK-250", label: "250 g", mrpPaise: 20000, pricePaise: 15000, stock: 10 }).returning();
  const [v2] = await db.insert(s.productVariants).values({ productId: p.id, sku: "KK-500", label: "500 g", mrpPaise: 40000, pricePaise: 30000, stock: 10 }).returning();
  variantId = v.id;
  variant2Id = v2.id;
  gatewayCalls.length = 0;
  gatewayFails = false;
}

const addAddress = async (user: string, over: object = {}) => {
  const r = await call("POST", "/api/me/addresses", { user, body: { ...ADDR, ...over } });
  expect(r.status).toBe(201);
  return r.body;
};
const checkout = (user: string, addressId: string, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  call("POST", "/api/checkout", { user, body: { addressId, items: [{ variantId, quantity: 2 }], ...over }, headers });
const stockOf = async (id = variantId) => (await db.select().from(s.productVariants).where(eq(s.productVariants.id, id)))[0].stock;
const sign = (orderId: string, payId: string, secret = KEY_SECRET) => createHmac("sha256", secret).update(`${orderId}|${payId}`).digest("hex");

beforeAll(() => migrate(db, { migrationsFolder: "./drizzle" }));
afterAll(() => pool.end());
beforeEach(setup);

/* -------------------------------------------------------------------------- */

describe("unauthenticated access", () => {
  const someId = "11111111-1111-4111-8111-111111111111";
  const endpoints: [string, string, unknown?][] = [
    ["GET", "/api/me"],
    ["PATCH", "/api/me", { name: "Hacker" }],
    ["GET", "/api/me/addresses"],
    ["POST", "/api/me/addresses", ADDR],
    ["PATCH", `/api/me/addresses/${someId}`, { city: "X" }],
    ["DELETE", `/api/me/addresses/${someId}`],
    ["POST", `/api/me/addresses/${someId}/default`],
    ["GET", "/api/me/orders"],
    ["GET", `/api/me/orders/${someId}`],
    ["POST", "/api/checkout", { addressId: someId, items: [{ variantId: someId, quantity: 1 }] }],
    ["POST", "/api/checkout/verify", { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s" }],
  ];

  it.each(endpoints)("%s %s -> 401 and no side effects", async (method, path, body) => {
    const r = await call(method, path, { body });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("UNAUTHENTICATED");
    expect(await db.select().from(s.addresses)).toHaveLength(0);
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await db.select().from(s.profiles)).toHaveLength(0);
  });

  it("a deleted account cannot authenticate even with a valid session", async () => {
    await call("GET", "/api/me", { user: "user_gone" });
    await db.update(s.profiles).set({ deletedAt: new Date() }).where(eq(s.profiles.clerkUserId, "user_gone"));
    expect((await call("GET", "/api/me", { user: "user_gone" })).status).toBe(401);
  });
});

describe("authenticated customer: profile", () => {
  it("creates the local profile on first request, once, even under concurrent first requests", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => call("GET", "/api/me", { user: "user_new" })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await db.select().from(s.profiles)).toHaveLength(1);
    expect(rs[0].body).toMatchObject({ email: "user_new@example.com", name: "user_new", phone: null });
    expect(rs[0].headers.get("cache-control")).toBe("private, no-store");
  });

  it("updates name and phone (normalised); phone can be cleared", async () => {
    const r = await call("PATCH", "/api/me", { user: "u1", body: { name: "  Asha   Raman ", phone: "+91 98765-43210" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: "Asha Raman", phone: "9876543210" });
    const cleared = await call("PATCH", "/api/me", { user: "u1", body: { phone: null } });
    expect(cleared.body.phone).toBeNull();
  });

  it("rejects invalid phones and fields the customer must not control (email, role, id)", async () => {
    for (const phone of ["12345", "5876543210", "98765432101", "abcdefghij"]) {
      expect((await call("PATCH", "/api/me", { user: "u1", body: { phone } })).status).toBe(422);
    }
    for (const body of [{ email: "x@y.com" }, { role: "admin" }, { id: "x" }, { clerkUserId: "user_other" }, {}]) {
      expect((await call("PATCH", "/api/me", { user: "u1", body })).status).toBe(422);
    }
    const me = await call("GET", "/api/me", { user: "u1" });
    expect(me.body.email).toBe("u1@example.com");
    expect((await db.select().from(s.profiles))[0].role).toBe("customer");
  });

  it("normalizeIndianMobile accepts common formats only", () => {
    for (const ok of ["9876543210", "+919876543210", "+91 98765 43210", "09876543210", "919876543210"]) expect(normalizeIndianMobile(ok)).toBe("9876543210");
    for (const bad of ["", "98765", "0123456789", "+1 9876543210", "98765432100"]) expect(normalizeIndianMobile(bad)).toBeNull();
  });
});

describe("addresses: validation", () => {
  it("normalises valid input (state casing, phone, whitespace)", async () => {
    const a = await addAddress("u1", { state: "tamil nadu", phone: "+91 98765 43210", fullName: "  Asha  Raman ", line1: "12   Gandhi\tStreet", pincode: "600 017", landmark: "" });
    expect(a).toMatchObject({ state: "Tamil Nadu", phone: "9876543210", fullName: "Asha Raman", line1: "12 Gandhi Street", pincode: "600017", landmark: null });
  });

  it.each([
    ["pincode", { pincode: "60001" }],
    ["pincode", { pincode: "000001" }],
    ["pincode", { pincode: "ABCDEF" }],
    ["phone", { phone: "1234567890" }],
    ["state", { state: "Atlantis" }],
    ["fullName", { fullName: "A" }],
    ["line1", { line1: "x" }],
    ["city", { city: "" }],
  ])("rejects a bad %s with a field-level 422", async (field, over) => {
    const r = await call("POST", "/api/me/addresses", { user: "u1", body: { ...ADDR, ...over } });
    expect(r.status).toBe(422);
    expect(Object.keys(r.body.error.fields)).toContain(field);
    expect(await db.select().from(s.addresses)).toHaveLength(0);
  });

  it("refuses attempts to set ownership/system fields from the body", async () => {
    const victim = await addAddress("victim");
    const profiles = await db.select().from(s.profiles);
    for (const extra of [{ profileId: profiles[0].id }, { id: victim.id }, { createdAt: "2000-01-01" }]) {
      expect((await call("POST", "/api/me/addresses", { user: "attacker", body: { ...ADDR, ...extra } })).status).toBe(422);
    }
    expect((await call("GET", "/api/me/addresses", { user: "attacker" })).body.addresses).toHaveLength(0);
  });

  it("rejects wrong content-type, bad JSON and foreign origins", async () => {
    expect((await call("POST", "/api/me/addresses", { user: "u1", raw: "a=b", contentType: "application/x-www-form-urlencoded" })).status).toBe(415);
    expect((await call("POST", "/api/me/addresses", { user: "u1", raw: JSON.stringify(ADDR), contentType: null })).status).toBe(415);
    expect((await call("POST", "/api/me/addresses", { user: "u1", raw: "{nope" })).status).toBe(400);
    expect((await call("POST", "/api/me/addresses", { user: "u1", body: ADDR, headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect((await call("POST", "/api/me/addresses", { user: "u1", body: ADDR, headers: { origin: "https://spn.test" } })).status).toBe(201);
    expect(await db.select().from(s.addresses)).toHaveLength(1);
  });

  it("enforces the 10-address limit", async () => {
    for (let i = 0; i < 10; i++) await addAddress("u1", { line1: `${i + 10} Some Road` });
    const r = await call("POST", "/api/me/addresses", { user: "u1", body: ADDR });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("ADDRESS_LIMIT_REACHED");
  });
});

describe("addresses: default handling", () => {
  const defaults = async (user: string) => (await call("GET", "/api/me/addresses", { user })).body.addresses.filter((a: any) => a.isDefault);

  it("first address becomes default; later ones don't; isDefault:true moves it", async () => {
    const a1 = await addAddress("u1");
    expect(a1.isDefault).toBe(true);
    const a2 = await addAddress("u1", { line1: "2 Second Street" });
    expect(a2.isDefault).toBe(false);
    const a3 = await addAddress("u1", { line1: "3 Third Street", isDefault: true });
    expect(a3.isDefault).toBe(true);
    const d = await defaults("u1");
    expect(d.map((x: any) => x.id)).toEqual([a3.id]);
  });

  it("POST .../default switches the default and leaves exactly one", async () => {
    const a1 = await addAddress("u1");
    const a2 = await addAddress("u1", { line1: "2 Second Street" });
    const r = await call("POST", `/api/me/addresses/${a2.id}/default`, { user: "u1" });
    expect(r.status).toBe(200);
    expect((await defaults("u1")).map((x: any) => x.id)).toEqual([a2.id]);
    expect((await call("POST", `/api/me/addresses/${a1.id}/default`, { user: "u1" })).status).toBe(200);
    expect((await defaults("u1")).map((x: any) => x.id)).toEqual([a1.id]);
  });

  it("isDefault:false on the current default is ignored (a default always exists)", async () => {
    const a1 = await addAddress("u1");
    const r = await call("PATCH", `/api/me/addresses/${a1.id}`, { user: "u1", body: { isDefault: false } });
    expect(r.status).toBe(200);
    expect(r.body.isDefault).toBe(true);
  });

  it("deleting the default promotes the most recent remaining address; deleting the last leaves none", async () => {
    const a1 = await addAddress("u1");
    const a2 = await addAddress("u1", { line1: "2 Second Street" });
    const a3 = await addAddress("u1", { line1: "3 Third Street" });
    expect((await call("DELETE", `/api/me/addresses/${a1.id}`, { user: "u1" })).status).toBe(200);
    expect((await defaults("u1")).map((x: any) => x.id)).toEqual([a3.id]);
    await call("DELETE", `/api/me/addresses/${a2.id}`, { user: "u1" }); // non-default: default unchanged
    expect((await defaults("u1")).map((x: any) => x.id)).toEqual([a3.id]);
    await call("DELETE", `/api/me/addresses/${a3.id}`, { user: "u1" });
    expect((await call("GET", "/api/me/addresses", { user: "u1" })).body.addresses).toHaveLength(0);
  });

  it("8 simultaneous 'make default' requests leave exactly one default", async () => {
    await addAddress("u1");
    const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => call("POST", "/api/me/addresses", { user: "u1", body: { ...ADDR, line1: `${i + 20} Parallel Road`, isDefault: true } })));
    expect(rs.every((r) => r.status === 201)).toBe(true);
    expect(await defaults("u1")).toHaveLength(1);
  });

  it("the database itself refuses two defaults for one customer (backstop)", async () => {
    await addAddress("u1");
    const [profile] = await db.select().from(s.profiles);
    await expect(
      db.insert(s.addresses).values({ profileId: profile.id, ...ADDR, isDefault: true }),
    ).rejects.toThrow();
  });

  it("each customer has their own default", async () => {
    const a = await addAddress("alice");
    const b = await addAddress("bob");
    expect(a.isDefault && b.isDefault).toBe(true);
  });
});

describe("customer A cannot reach customer B's data", () => {
  it("addresses: list, patch, delete and set-default of someone else's address are all 404 and change nothing", async () => {
    const mine = await addAddress("alice");
    const theirs = await addAddress("bob", { line1: "99 Bobs Lane", city: "Madurai" });

    const list = await call("GET", "/api/me/addresses", { user: "alice" });
    expect(list.body.addresses.map((a: any) => a.id)).toEqual([mine.id]);

    const patch = await call("PATCH", `/api/me/addresses/${theirs.id}`, { user: "alice", body: { city: "Hacked" } });
    const del = await call("DELETE", `/api/me/addresses/${theirs.id}`, { user: "alice" });
    const def = await call("POST", `/api/me/addresses/${theirs.id}/default`, { user: "alice" });
    for (const r of [patch, del, def]) {
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe("ADDRESS_NOT_FOUND");
    }
    const [row] = await db.select().from(s.addresses).where(eq(s.addresses.id, theirs.id));
    expect(row).toMatchObject({ city: "Madurai", isDefault: true });
    expect((await call("GET", "/api/me/addresses", { user: "bob" })).body.addresses).toHaveLength(1);
  });

  it("the 404 for someone else's address is identical to the 404 for a nonexistent one (no probing)", async () => {
    const theirs = await addAddress("bob");
    const a = await call("DELETE", `/api/me/addresses/${theirs.id}`, { user: "alice" });
    const b = await call("DELETE", "/api/me/addresses/22222222-2222-4222-8222-222222222222", { user: "alice" });
    const c = await call("DELETE", "/api/me/addresses/not-a-uuid", { user: "alice" });
    expect([a.status, b.status, c.status]).toEqual([404, 404, 404]);
    expect(a.body).toEqual(b.body);
    expect(b.body).toEqual(c.body);
  });

  it("orders: B cannot list, read, or verify-callback on A's order", async () => {
    const addr = await addAddress("alice");
    const co = await checkout("alice", addr.id);
    expect(co.status).toBe(201);

    expect((await call("GET", "/api/me/orders", { user: "bob" })).body.orders).toHaveLength(0);
    const read = await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "bob" });
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe("ORDER_NOT_FOUND");
    expect((await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "alice" })).status).toBe(200);

    const before = (await db.select().from(s.orders))[0].expiresAt!.getTime();
    const cb = await call("POST", "/api/checkout/verify", {
      user: "bob",
      body: { razorpay_order_id: co.body.razorpayOrderId, razorpay_payment_id: "pay_x", razorpay_signature: sign(co.body.razorpayOrderId, "pay_x") },
    });
    expect(cb.status).toBe(404); // even with a perfectly valid signature
    expect((await db.select().from(s.orders))[0].expiresAt!.getTime()).toBe(before);
  });
});

describe("checkout", () => {
  it("creates the order for the SESSION user from their own address; snapshot has no address id", async () => {
    const addr = await addAddress("alice", { label: "Home" });
    const r = await checkout("alice", addr.id);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ currency: "INR", amountPaise: 30000, razorpayKeyId: "rzp_test_keyid", replayed: false });
    expect(gatewayCalls).toEqual([{ amountPaise: 30000, receipt: r.body.orderNumber }]);

    const [order] = await db.select().from(s.orders);
    const [alice] = await db.select().from(s.profiles).where(eq(s.profiles.clerkUserId, "alice"));
    expect(order.profileId).toBe(alice.id);
    expect(order.shippingAddress).toEqual({ fullName: "Asha Raman", phone: "9876543210", line1: "12 Gandhi Street", line2: null, landmark: null, city: "Chennai", state: "Tamil Nadu", pincode: "600017" });
    expect(JSON.stringify(order.shippingAddress)).not.toContain(addr.id);
    expect(await stockOf()).toBe(8);
  });

  it("a customer id supplied by the browser is rejected, never trusted", async () => {
    const a = await addAddress("alice");
    const b = await addAddress("bob");
    const [bobProfile] = await db.select().from(s.profiles).where(eq(s.profiles.clerkUserId, "bob"));
    for (const extra of [{ profileId: bobProfile.id }, { customerId: bobProfile.id }, { userId: "bob" }, { clerkUserId: "bob" }]) {
      const r = await checkout("alice", a.id, extra);
      expect(r.status).toBe(422);
    }
    expect(await db.select().from(s.orders)).toHaveLength(0);
    void b;
  });

  it("using ANOTHER user's address id -> 404, no order, no stock taken, Razorpay never called", async () => {
    await addAddress("alice");
    const bobAddr = await addAddress("bob");
    const r = await checkout("alice", bobAddr.id);
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("ADDRESS_NOT_FOUND");
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf()).toBe(10);
    expect(gatewayCalls).toHaveLength(0);
  });

  it("deleted, invalid and malformed address ids are refused", async () => {
    const addr = await addAddress("alice");
    await call("DELETE", `/api/me/addresses/${addr.id}`, { user: "alice" });
    const deleted = await checkout("alice", addr.id);
    expect(deleted.status).toBe(404);
    const unknown = await checkout("alice", "33333333-3333-4333-8333-333333333333");
    expect(unknown.status).toBe(404);
    const malformed = await checkout("alice", "not-a-uuid");
    expect(malformed.status).toBe(422);
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf()).toBe(10);
  });

  it("the order's address stays exactly as it was when later edited or deleted", async () => {
    const addr = await addAddress("alice");
    const co = await checkout("alice", addr.id);
    const before = (await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "alice" })).body.shippingAddress;

    await call("PATCH", `/api/me/addresses/${addr.id}`, { user: "alice", body: { line1: "Totally New Road 5", city: "Delhi", state: "Delhi", pincode: "110001" } });
    expect((await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "alice" })).body.shippingAddress).toEqual(before);

    await call("DELETE", `/api/me/addresses/${addr.id}`, { user: "alice" });
    const after = await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "alice" });
    expect(after.body.shippingAddress).toEqual(before);
    expect(before.city).toBe("Chennai");
    expect(after.body.items[0]).toMatchObject({ productName: "Karuppu Kavuni Kanji Mix", variantLabel: "250 g", quantity: 2 });
  });

  it("validates the cart and reports stock problems without creating anything", async () => {
    const addr = await addAddress("alice");
    expect((await checkout("alice", addr.id, { items: [] })).status).toBe(422);
    expect((await checkout("alice", addr.id, { items: [{ variantId, quantity: 0 }] })).status).toBe(422);
    expect((await checkout("alice", addr.id, { items: [{ variantId, quantity: 1.5 }] })).status).toBe(422);
    const short = await checkout("alice", addr.id, { items: [{ variantId, quantity: 11 }] });
    expect(short.status).toBe(409);
    expect(short.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", variantId });
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf()).toBe(10);
  });

  it("applies the shipping rule from site_settings", async () => {
    await db.insert(s.siteSettings).values({ key: "shipping", value: { flatRatePaise: 4000, freeShippingAbovePaise: 50000 } });
    const addr = await addAddress("alice");
    const small = await checkout("alice", addr.id, { items: [{ variantId, quantity: 1 }] }); // 15000 + 4000
    expect(small.body.amountPaise).toBe(19000);
    const big = await checkout("alice", addr.id, { items: [{ variantId: variant2Id, quantity: 2 }] }); // 60000, free shipping
    expect(big.body.amountPaise).toBe(60000);
  });

  it("Razorpay failure -> 502, stock restored, order cancelled", async () => {
    const addr = await addAddress("alice");
    gatewayFails = true;
    const r = await checkout("alice", addr.id);
    expect(r.status).toBe(502);
    expect(await stockOf()).toBe(10);
    expect((await db.select().from(s.orders))[0]).toMatchObject({ status: "cancelled", cancelReason: "razorpay_order_failed" });
  });

  it("caps open unpaid orders per customer", async () => {
    const addr = await addAddress("alice");
    for (let i = 0; i < api.MAX_OPEN_PENDING_ORDERS; i++) expect((await checkout("alice", addr.id, { items: [{ variantId, quantity: 1 }] })).status).toBe(201);
    const r = await checkout("alice", addr.id, { items: [{ variantId, quantity: 1 }] });
    expect(r.status).toBe(429);
    expect(await stockOf()).toBe(7);
    const bobAddr = await addAddress("bob");
    expect((await checkout("bob", bobAddr.id, { items: [{ variantId, quantity: 1 }] })).status).toBe(201); // per customer
  });

  it("never exposes internal order fields to the customer", async () => {
    const addr = await addAddress("alice");
    const co = await checkout("alice", addr.id);
    await db.update(s.orders).set({ attentionReason: "late_payment_no_stock", adminNote: "call customer" });
    const one = (await call("GET", `/api/me/orders/${co.body.orderId}`, { user: "alice" })).body;
    const list = (await call("GET", "/api/me/orders", { user: "alice" })).body.orders[0];
    for (const o of [one, list]) {
      expect(Object.keys(o)).not.toContain("attentionReason");
      expect(Object.keys(o)).not.toContain("adminNote");
      expect(Object.keys(o)).not.toContain("profileId");
      expect(Object.keys(o)).not.toContain("idempotencyKey");
    }
  });
});

describe("checkout idempotency", () => {
  const KEY = "checkout-attempt-0001";

  it("repeating the same key returns the same Razorpay order and reserves stock once", async () => {
    const addr = await addAddress("alice");
    const first = await checkout("alice", addr.id, {}, { "idempotency-key": KEY });
    const second = await checkout("alice", addr.id, {}, { "idempotency-key": KEY });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ replayed: true, orderId: first.body.orderId, razorpayOrderId: first.body.razorpayOrderId });
    expect(await db.select().from(s.orders)).toHaveLength(1);
    expect(await stockOf()).toBe(8);
    expect(gatewayCalls).toHaveLength(1);
  });

  it("6 simultaneous requests with one key create exactly one order", async () => {
    const addr = await addAddress("alice");
    const rs = await Promise.all(Array.from({ length: 6 }, () => checkout("alice", addr.id, {}, { "idempotency-key": KEY })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of rs) expect([200, 201, 409]).toContain(r.status); // 409 = winner still setting up payment
    expect(await db.select().from(s.orders)).toHaveLength(1);
    expect(await stockOf()).toBe(8);
  });

  it("the same key from a different customer is a different checkout", async () => {
    const a = await addAddress("alice");
    const b = await addAddress("bob");
    expect((await checkout("alice", a.id, {}, { "idempotency-key": KEY })).status).toBe(201);
    expect((await checkout("bob", b.id, {}, { "idempotency-key": KEY })).status).toBe(201);
    expect(await db.select().from(s.orders)).toHaveLength(2);
  });

  it("malformed keys are rejected", async () => {
    const addr = await addAddress("alice");
    for (const k of ["short", "has spaces in it!", "x".repeat(101)]) {
      expect((await checkout("alice", addr.id, {}, { "idempotency-key": k })).status).toBe(422);
    }
  });
});

describe("browser callback verification (webhook stays authoritative)", () => {
  async function placed() {
    const addr = await addAddress("alice");
    const co = await checkout("alice", addr.id);
    return co.body as { orderId: string; razorpayOrderId: string; amountPaise: number };
  }
  const verify = (user: string, o: string, p: string, sig: string) =>
    call("POST", "/api/checkout/verify", { user, body: { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: sig } });

  it("valid signature: verified, and the order is marked confirmed immediately", async () => {
    const co = await placed();
    const r = await verify("alice", co.razorpayOrderId, "pay_1", sign(co.razorpayOrderId, "pay_1"));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ verified: true, status: "confirmed", awaitingConfirmation: false });
    const [order] = await db.select().from(s.orders);
    const [pay] = await db.select().from(s.payments);
    expect(order.status).toBe("confirmed");
    expect(pay).toMatchObject({ status: "captured", razorpayPaymentId: "pay_1" });
  });

  it("authorized but uncaptured payment retains pending status and extends hold", async () => {
    const co = await placed();
    (deps.gateway as any).fetchPayment = async () => ({
      id: "pay_auth",
      status: "authorized",
      amount: co.amountPaise,
      currency: "INR",
    });
    try {
      const r = await verify("alice", co.razorpayOrderId, "pay_auth", sign(co.razorpayOrderId, "pay_auth"));
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ verified: true, status: "pending_payment", awaitingConfirmation: true });
      const [order] = await db.select().from(s.orders);
      const [pay] = await db.select().from(s.payments);
      expect(order.status).toBe("pending_payment");
      expect(pay.status).toBe("created");
    } finally {
      delete (deps.gateway as any).fetchPayment;
    }
  });

  it("invalid signatures are rejected and change nothing", async () => {
    const co = await placed();
    const before = (await db.select().from(s.orders))[0].expiresAt!.getTime();
    const cases = [
      "deadbeef",
      sign(co.razorpayOrderId, "pay_1", "wrong_secret"), // signed with the wrong secret
      sign(co.razorpayOrderId, "pay_OTHER"), // valid signature, but for a different payment id
      sign("order_other", "pay_1"), // valid signature, but for a different order
      "",
    ];
    for (const sig of cases) {
      const r = await verify("alice", co.razorpayOrderId, "pay_1", sig);
      expect([400, 422]).toContain(r.status);
      if (sig) expect(r.body.error.code).toBe("INVALID_SIGNATURE");
    }
    expect((await db.select().from(s.orders))[0].expiresAt!.getTime()).toBe(before);
    expect((await db.select().from(s.orders))[0].status).toBe("pending_payment");
  });

  it("webhook arrival afterwards is idempotent", async () => {
    const co = await placed();
    const r = await verify("alice", co.razorpayOrderId, "pay_1", sign(co.razorpayOrderId, "pay_1"));
    expect(r.body).toMatchObject({ verified: true, status: "confirmed", awaitingConfirmation: false });

    // When webhook arrives later, applyCapturedPayment sees already_processed and does not error or duplicate
    const outcome = await applyCapturedPayment(db, { razorpayOrderId: co.razorpayOrderId, razorpayPaymentId: "pay_1", amountPaise: co.amountPaise });
    expect(outcome.outcome).toBe("already_processed");
    expect((await call("GET", `/api/me/orders/${co.orderId}`, { user: "alice" })).body.status).toBe("confirmed");

    const again = await verify("alice", co.razorpayOrderId, "pay_1", sign(co.razorpayOrderId, "pay_1"));
    expect(again.body).toMatchObject({ verified: true, status: "confirmed", awaitingConfirmation: false });
  });

  it("an order already cancelled stays cancelled (late-payment path belongs to the webhook)", async () => {
    const co = await placed();
    await db.update(s.orders).set({ expiresAt: new Date(Date.now() - 3600_000) });
    await expirePendingOrders(db);
    const r = await verify("alice", co.razorpayOrderId, "pay_1", sign(co.razorpayOrderId, "pay_1"));
    expect(r.body).toMatchObject({ status: "cancelled", awaitingConfirmation: false });
    expect(await stockOf()).toBe(10);
  });

  it("rejects malformed callback bodies", async () => {
    await placed();
    for (const body of [{}, { razorpay_order_id: "o" }, { razorpay_order_id: "o", razorpay_payment_id: "p", razorpay_signature: "s", extra: 1 }]) {
      expect((await call("POST", "/api/checkout/verify", { user: "alice", body })).status).toBe(422);
    }
  });

  it("unknown Razorpay order id -> 404", async () => {
    await placed();
    expect((await verify("alice", "order_unknown", "pay_1", sign("order_unknown", "pay_1"))).status).toBe(404);
  });
});

/* ------------------------------ Clerk webhook ------------------------------ */

describe("Clerk user sync webhook", () => {
  const SECRET_BYTES = "clerk-webhook-secret-bytes-0123456789";
  const SECRET = "whsec_" + Buffer.from(SECRET_BYTES).toString("base64");
  const wdeps = { secret: SECRET, withDb: <T,>(fn: (d: any) => Promise<T>) => fn(db), log: () => {} };

  const svixSign = (id: string, ts: string, body: string, secret = SECRET_BYTES) =>
    "v1," + createHmac("sha256", Buffer.from(secret)).update(`${id}.${ts}.${body}`).digest("base64");

  function hook(event: object, o: { id?: string; ts?: string; sig?: string; secret?: string } = {}) {
    const raw = JSON.stringify(event);
    const id = o.id ?? "msg_" + Math.random().toString(36).slice(2);
    const ts = o.ts ?? String(Math.floor(Date.now() / 1000));
    return new Request("https://spn.test/api/webhooks/clerk", {
      method: "POST",
      headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": o.sig ?? svixSign(id, ts, raw, o.secret), "content-type": "application/json" },
      body: raw,
    });
  }
  const userEvent = (type: string, id: string, email: string, first = "Asha", last = "Raman") => ({
    type,
    data: { id, first_name: first, last_name: last, primary_email_address_id: "em_1", email_addresses: [{ id: "em_0", email_address: "old@x.com" }, { id: "em_1", email_address: email }] },
  });

  it("verifies signatures against an independent HMAC; rejects forged, wrong-secret and stale requests", async () => {
    const good = hook(userEvent("user.created", "user_w1", "A@Example.com"));
    expect((await handleClerkWebhook(good, wdeps)).status).toBe(200);
    expect((await handleClerkWebhook(hook(userEvent("user.created", "user_w2", "b@x.com"), { sig: "v1,AAAA" }), wdeps)).status).toBe(400);
    expect((await handleClerkWebhook(hook(userEvent("user.created", "user_w3", "c@x.com"), { secret: "attacker" }), wdeps)).status).toBe(400);
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    expect((await handleClerkWebhook(hook(userEvent("user.created", "user_w4", "d@x.com"), { ts: stale }), wdeps)).status).toBe(400);
    const rows = await db.select().from(s.profiles);
    expect(rows.map((r) => r.clerkUserId)).toEqual(["user_w1"]);
    expect(rows[0]).toMatchObject({ email: "a@example.com", name: "Asha Raman" });
  });

  it("svix header with several signatures passes if any one is valid", async () => {
    const id = "msg_multi", ts = String(Math.floor(Date.now() / 1000)), raw = "{}";
    const header = `v1,bogus ${svixSign(id, ts, raw)} v2,other`;
    expect(await verifySvixSignature({ id, timestamp: ts, signatureHeader: header, rawBody: raw }, SECRET)).toBe(true);
    expect(await verifySvixSignature({ id, timestamp: ts, signatureHeader: "v1,bogus", rawBody: raw }, SECRET)).toBe(false);
    expect(await verifySvixSignature({ id, timestamp: ts, signatureHeader: header, rawBody: raw + " " }, SECRET)).toBe(false);
  });

  it("duplicate delivery is a no-op; user.updated refreshes email/name but never phone or role", async () => {
    await handleClerkWebhook(hook(userEvent("user.created", "user_w1", "a@x.com"), { id: "msg_1" }), wdeps);
    await db.update(s.profiles).set({ phone: "9876543210" });
    const dup = await handleClerkWebhook(hook(userEvent("user.created", "user_w1", "a@x.com"), { id: "msg_1" }), wdeps);
    expect(await dup.json()).toEqual({ status: "duplicate" });
    await handleClerkWebhook(hook(userEvent("user.updated", "user_w1", "new@x.com", "Asha", "R"), { id: "msg_2" }), wdeps);
    const [p] = await db.select().from(s.profiles);
    expect(p).toMatchObject({ email: "new@x.com", name: "Asha R", phone: "9876543210", role: "customer" });
    expect(await db.select().from(s.profiles)).toHaveLength(1);
  });

  it("webhook racing the lazy sync still yields one profile", async () => {
    await Promise.all([
      handleClerkWebhook(hook(userEvent("user.created", "user_race", "r@x.com")), wdeps),
      call("GET", "/api/me", { user: "user_race" }),
      handleClerkWebhook(hook(userEvent("user.updated", "user_race", "r2@x.com")), wdeps),
    ]);
    expect(await db.select().from(s.profiles)).toHaveLength(1);
  });

  it("user.deleted anonymises the profile, removes addresses, keeps orders and their address snapshot, and blocks sign-in", async () => {
    const addr = await addAddress("user_del");
    const co = await checkout("user_del", addr.id);
    await call("PATCH", "/api/me", { user: "user_del", body: { phone: "9876543210" } });

    const res = await handleClerkWebhook(hook({ type: "user.deleted", data: { id: "user_del", deleted: true } }), wdeps);
    expect(await res.json()).toEqual({ status: "deleted" });

    const [p] = await db.select().from(s.profiles);
    expect(p.deletedAt).not.toBeNull();
    expect(p).toMatchObject({ name: null, phone: null });
    expect(p.email).toMatch(/^deleted-.*@invalid\.local$/);
    expect(await db.select().from(s.addresses)).toHaveLength(0);
    const [order] = await db.select().from(s.orders).where(eq(s.orders.id, co.body.orderId));
    expect((order.shippingAddress as any).city).toBe("Chennai");

    expect((await call("GET", "/api/me", { user: "user_del" })).status).toBe(401);
    // an out-of-order user.updated arriving later must not resurrect the account
    await handleClerkWebhook(hook(userEvent("user.updated", "user_del", "back@x.com")), wdeps);
    expect((await db.select().from(s.profiles))[0].deletedAt).not.toBeNull();
    expect((await call("GET", "/api/me", { user: "user_del" })).status).toBe(401);
  });

  it("a user with no email is skipped, not crashed", async () => {
    const res = await handleClerkWebhook(hook({ type: "user.created", data: { id: "user_noemail", email_addresses: [] } }), wdeps);
    expect(await res.json()).toEqual({ status: "skipped_no_email" });
  });
});
