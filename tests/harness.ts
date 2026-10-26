/**
 * Shared test harness: real Postgres, real handlers. The only stand-in is the Clerk session,
 * replaced by an `x-test-user` header at the authenticate() seam. Everything below that seam
 * (profile sync, ownership, cart, checkout) is production code.
 */
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import * as api from "../src/lib/api/customer-api";
import type { ApiDeps } from "../src/lib/api/customer-api";
import { dispatchAdminRequest } from "../src/lib/api/admin-router";
import { publicCategories, publicProduct, publicProducts, type PublicDeps } from "../src/lib/api/public-api";
import { ensureProfile } from "../src/lib/customers/profile";
import * as s from "../src/lib/db/schema";
import type { PaymentGateway } from "../src/lib/payments/razorpay";
import type { ObjectStorage } from "../src/lib/storage/storage";

const rawUrl = process.env.TEST_DATABASE_URL ?? "postgres://postgres:pw@localhost:5432/spn_test";
const url = rawUrl;
export const pool = new Pool({ connectionString: url, max: 20 });
export const db = drizzle(pool, { schema: s });

export const KEY_SECRET = "rzp_key_secret_test";
let rzpN = 0;
export const gatewayCalls: { amountPaise: number; receipt: string }[] = [];
let gatewayFails = false;
export const setGatewayFails = (v: boolean) => {
  gatewayFails = v;
};
const gateway: PaymentGateway = {
  createOrder: async (p) => {
    if (gatewayFails) throw new Error("razorpay down");
    gatewayCalls.push({ amountPaise: p.amountPaise, receipt: p.receipt });
    return { id: `order_cust_${++rzpN}` };
  },
};

export const IMG_BASE = "https://img.spn.test";

type StoredObject = { bytes: Uint8Array; contentType?: string; cacheControl?: string };
export type MemStoreType = ObjectStorage & {
  objects: Map<string, StoredObject>;
  deleted: string[];
  failPut: boolean;
  failDelete: boolean;
  onPut?: (() => Promise<void>) | null;
  reset(): void;
};

export const memStore: MemStoreType = {
  objects: new Map<string, StoredObject>(),
  deleted: [],
  failPut: false,
  failDelete: false,
  onPut: null,
  reset() {
    this.objects.clear();
    this.deleted = [];
    this.failPut = false;
    this.failDelete = false;
    this.onPut = null;
  },
  async put(key: string, bytes: Uint8Array, opts?: { contentType?: string; cacheControl?: string }) {
    if (this.failPut) throw new Error("storage down");
    this.objects.set(key, { bytes, contentType: opts?.contentType, cacheControl: opts?.cacheControl });
    if (this.onPut) await this.onPut();
  },
  async delete(keys: string[]) {
    if (this.failDelete) throw new Error("delete failed");
    for (const k of keys) {
      this.objects.delete(k);
      this.deleted.push(k);
    }
  },
};

export const deps: ApiDeps = {
  withDb: (fn) => fn(db),
  authenticate: async (req, d) => {
    const uid = req.headers.get("x-test-user");
    return uid ? ensureProfile(d, uid, async () => ({ email: `${uid}@example.com`, name: uid })) : null;
  },
  gateway,
  razorpayKeyId: "rzp_test_keyid",
  razorpayKeySecret: KEY_SECRET,
  allowedOrigins: ["https://spn.test"],
  storage: memStore,
  imageBaseUrl: IMG_BASE,
  log: () => {},
};

export type Opts = { user?: string; body?: unknown; raw?: string; contentType?: string | null; headers?: Record<string, string> };

export async function call(method: string, path: string, o: Opts = {}) {
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
  else if (path === "/api/cart") res = await (method === "GET" ? api.getCartH : api.deleteCart)(req, deps);
  else if (path === "/api/cart/coupon") res = await api.postCartCoupon(req, deps);
  else if (path === "/api/cart/items") res = await api.postCartItem(req, deps);
  else if ((m = path.match(/^\/api\/cart\/items\/([^/]+)$/))) res = await (method === "PUT" ? api.putCartItem : api.deleteCartItem)(req, deps, m[1]);
  else if (path === "/api/checkout") res = await api.postCheckout(req, deps);
  else if (path === "/api/checkout/verify") res = await api.postCheckoutVerify(req, deps);
  else if (path === "/api/shipping/quote") res = await api.postShippingQuote(req, deps);
  else throw new Error("no route " + path);
  return { status: res.status, body: (await res.json()) as any, headers: res.headers };
}


export type AOpts = {
  user?: string;
  body?: unknown;
  form?: FormData;
  origin?: string | null;
  headers?: Record<string, string>;
};

export async function acall(method: string, path: string, o: AOpts = {}) {
  const headers: Record<string, string> = { ...(o.headers ?? {}) };
  if (o.user) headers["x-test-user"] = o.user;
  if (o.origin === undefined) headers["origin"] = "https://spn.test";
  else if (o.origin !== null) headers["origin"] = o.origin;

  let body: any;
  if (o.form) {
    body = o.form;
  } else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    headers["content-type"] = "application/json";
  }

  const req = new Request("https://spn.test" + path, { method, headers, body });
  const res = await dispatchAdminRequest(req, deps);
  if (!res) throw new Error("no admin route " + path);
  return { status: res.status, body: (await res.json()) as any, headers: res.headers };
}

export const publicDeps: PublicDeps = {
  withDb: (fn) => fn(db),
  imageBaseUrl: IMG_BASE,
  log: () => {},
};

export async function pcall(path: string, o: { method?: string; headers?: Record<string, string> } = {}) {
  const method = o.method ?? "GET";
  const req = new Request("https://spn.test" + path, { method, headers: o.headers });
  let res: Response;
  const parsed = new URL("https://spn.test" + path);
  const p = parsed.pathname;

  if (p === "/api/catalogue/categories") {
    res = await publicCategories(req, publicDeps);
  } else if (p === "/api/catalogue/products") {
    res = await publicProducts(req, publicDeps);
  } else if (p.startsWith("/api/catalogue/products/")) {
    const slug = decodeURIComponent(p.slice("/api/catalogue/products/".length));
    res = await publicProduct(req, publicDeps, slug);
  } else {
    throw new Error("no public route " + path);
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, body, text, headers: res.headers };
}

export async function makeAdmin(user: string) {
  await ensureProfile(db, user, async () => ({ email: `${user}@example.com`, name: user }));
  await db.update(s.profiles).set({ role: "admin" }).where(eq(s.profiles.clerkUserId, user));
}

export async function profileIdOf(user: string) {
  const [p] = await db.select({ id: s.profiles.id }).from(s.profiles).where(eq(s.profiles.clerkUserId, user));
  return p?.id;
}

export const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
export const JPEG = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 0, 96, 0, 96, 0, 0]);
export const WEBP = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 36, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 32]);
export const GIF = () => new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 128, 0, 0, 0, 0, 0]);
export const SVG = () => new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>");

export function uploadForm(
  bytes: Uint8Array,
  opts: { fields?: Record<string, string>; filename?: string; type?: string } = {},
) {
  const fd = new FormData();
  const blob = new Blob([bytes as unknown as BlobPart], { type: opts.type ?? "image/png" });
  fd.append("file", blob, opts.filename ?? "image.png");
  if (opts.fields) {
    for (const [k, v] of Object.entries(opts.fields)) {
      fd.append(k, v);
    }
  }
  return fd;
}

export const ADDR = { fullName: "Asha Raman", phone: "9876543210", line1: "12 Gandhi Street", city: "Chennai", state: "Tamil Nadu", pincode: "600017" };

// Catalogue ids for the current test (assigned in setup()).
export let categoryId: string;
export let productId: string;
export let variantId: string; // 250 g, Rs 150, MRP Rs 200, stock 10
export let variant2Id: string; // 500 g, Rs 300, MRP Rs 400, stock 10

export async function setup() {
  await pool.query(
    "TRUNCATE webhook_events, payments, shipment_tracking_events, shipments, order_items, orders, cart_items, carts, product_variants, products, categories, addresses, profiles, site_settings, admin_audit_log, product_images, offers, coupons RESTART IDENTITY CASCADE",
  );
  memStore.reset();

  const [c] = await db.insert(s.categories).values({ slug: "c", name: "C" }).returning();
  const [p] = await db.insert(s.products).values({ categoryId: c.id, slug: "p", name: "Karuppu Kavuni Kanji Mix" }).returning();
  const [v] = await db.insert(s.productVariants).values({ productId: p.id, sku: "KK-250", label: "250 g", mrpPaise: 20000, pricePaise: 15000, stock: 10 }).returning();
  const [v2] = await db.insert(s.productVariants).values({ productId: p.id, sku: "KK-500", label: "500 g", mrpPaise: 40000, pricePaise: 30000, stock: 10 }).returning();
  categoryId = c.id;
  productId = p.id;
  variantId = v.id;
  variant2Id = v2.id;
  gatewayCalls.length = 0;
  gatewayFails = false;
}

/** Call at the top level of a test file. */
export function useHarness() {
  beforeAll(() => migrate(db, { migrationsFolder: "./drizzle" }));
  afterAll(() => pool.end());
  beforeEach(setup);
}

export const addAddress = async (user: string, over: object = {}) => {
  const r = await call("POST", "/api/me/addresses", { user, body: { ...ADDR, ...over } });
  expect(r.status).toBe(201);
  return r.body;
};

/** Replace the customer's cart contents through the real cart API. */
export const fillCart = async (user: string, items: { variantId: string; quantity: number }[]) => {
  expect((await call("DELETE", "/api/cart", { user })).status).toBe(200);
  for (const it of items) expect((await call("POST", "/api/cart/items", { user, body: it })).status).toBe(200);
};

export const rawCheckout = (user: string, addressId: string, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  call("POST", "/api/checkout", { user, body: { addressId, ...over }, headers });

/** Fill the cart (default: 2 x variant A), then check out. */
export const checkout = async (user: string, addressId: string, over: Record<string, unknown> = {}, headers: Record<string, string> = {}) => {
  const { items = [{ variantId, quantity: 2 }], ...rest } = over as { items?: { variantId: string; quantity: number }[] };
  await fillCart(user, items);
  return rawCheckout(user, addressId, rest, headers);
};

export const stockOf = async (id = variantId) => (await db.select().from(s.productVariants).where(eq(s.productVariants.id, id)))[0].stock;
export const sign = (orderId: string, payId: string, secret = KEY_SECRET) => createHmac("sha256", secret).update(`${orderId}|${payId}`).digest("hex");
