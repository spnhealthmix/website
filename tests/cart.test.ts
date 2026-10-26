import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { computeCartSummary, toLineView } from "../src/lib/cart/cart";
import * as s from "../src/lib/db/schema";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";
import { expirePendingOrders } from "../src/lib/orders/expiry";
import {
  addAddress, call, checkout, db, fillCart, gatewayCalls, KEY_SECRET, productId, rawCheckout, stockOf, useHarness, variant2Id, variantId,
} from "./harness";

useHarness();

const add = (user: string, vId: string, quantity: unknown, extra: object = {}) =>
  call("POST", "/api/cart/items", { user, body: { variantId: vId, quantity, ...extra } });
const put = (user: string, vId: string, quantity: unknown, extra: object = {}) =>
  call("PUT", `/api/cart/items/${vId}`, { user, body: { quantity, ...extra } });
const view = (user: string) => call("GET", "/api/cart", { user });
const rowsOf = async () => db.select().from(s.cartItems);
const setVariant = (id: string, v: Partial<typeof s.productVariants.$inferInsert>) => db.update(s.productVariants).set(v).where(eq(s.productVariants.id, id));

describe("unauthenticated access (guest cart)", () => {
  it("GET /api/cart -> 200 and returns empty cart without requiring sign-in", async () => {
    const r = await call("GET", "/api/cart");
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
    expect(r.body.summary).toMatchObject({ totalQuantity: 0, subtotalPaise: 0 });
    expect(await db.select().from(s.carts)).toHaveLength(0);
    expect(await rowsOf()).toHaveLength(0);
  });

  it("POST /api/cart/items -> 200, sets guest cookie, and creates nothing in carts table", async () => {
    const r = await call("POST", "/api/cart/items", { body: { variantId, quantity: 1 } });
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].variantId).toBe(variantId);
    expect(r.headers.get("set-cookie")).toContain("spn_guest_cart=");
    expect(await db.select().from(s.carts)).toHaveLength(0);
  });
});

describe("reading the cart", () => {
  it("a new customer gets an empty cart, and merely looking creates nothing", async () => {
    const r = await view("alice");
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
    expect(r.body.summary).toEqual({ lineCount: 0, totalQuantity: 0, subtotalPaise: 0, savingsPaise: 0, hasIssues: false, canCheckout: false });
    expect(await db.select().from(s.carts)).toHaveLength(0);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("product details, prices and the subtotal all come from the database", async () => {
    await db.insert(s.productImages).values([
      { productId, r2Key: "products/kk/02.webp", sortOrder: 2 },
      { productId, r2Key: "products/kk/main.webp", isPrimary: true, sortOrder: 5 },
    ]);
    await add("alice", variantId, 2);
    const r = await add("alice", variant2Id, 1);
    expect(r.body.items).toHaveLength(2);
    expect(r.body.items[0]).toMatchObject({
      variantId, productName: "Karuppu Kavuni Kanji Mix", productSlug: "p", variantLabel: "250 g", sku: "KK-250",
      imageKey: "products/kk/main.webp", quantity: 2, unitPricePaise: 15000, mrpPaise: 20000, lineTotalPaise: 30000, issue: null,
    });
    expect(r.body.summary).toEqual({ lineCount: 2, totalQuantity: 3, subtotalPaise: 60000, savingsPaise: 2 * 5000 + 10000, hasIssues: false, canCheckout: true });
  });

  it("the cart summary knows nothing about shipping, offers or the final total", async () => {
    await db.insert(s.siteSettings).values({ key: "shipping", value: { flatRatePaise: 4000, freeShippingAbovePaise: null } });
    const r = await add("alice", variantId, 1);
    expect(Object.keys(r.body.summary).sort()).toEqual(["canCheckout", "hasIssues", "lineCount", "savingsPaise", "subtotalPaise", "totalQuantity"]);
    expect(r.body.summary.subtotalPaise).toBe(15000); // no shipping added
  });

  it("stores only variant + quantity: the table has no price, name or stock columns", async () => {
    const cols = await db.execute(`select column_name from information_schema.columns where table_name = 'cart_items' order by 1` as any);
    const names = (cols as any).rows.map((c: any) => c.column_name);
    expect(names).toEqual(["cart_id", "created_at", "id", "quantity", "updated_at", "variant_id"]);
  });
});

describe("adding items", () => {
  it("never accepts price, MRP, stock or product data from the client", async () => {
    for (const extra of [{ pricePaise: 1 }, { price: 1 }, { mrpPaise: 1 }, { stock: 999 }, { productName: "Free" }, { unitPricePaise: 1 }, { cartId: "x" }, { profileId: "x" }]) {
      const r = await add("alice", variantId, 1, extra);
      expect(r.status).toBe(422);
    }
    expect(await rowsOf()).toHaveLength(0);
    const ok = await add("alice", variantId, 1);
    expect(ok.body.items[0].unitPricePaise).toBe(15000);
  });

  it("adding the same variant repeatedly merges into one line", async () => {
    await add("alice", variantId, 1);
    await add("alice", variantId, 2);
    const r = await add("alice", variantId, 3);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].quantity).toBe(6);
    expect(await rowsOf()).toHaveLength(1);
    await add("alice", variant2Id, 1);
    expect((await rowsOf())).toHaveLength(2); // a different variant is its own line
  });

  it("the database itself refuses two lines for one variant (backstop)", async () => {
    await add("alice", variantId, 1);
    const [cart] = await db.select().from(s.carts);
    await expect(db.insert(s.cartItems).values({ cartId: cart.id, variantId, quantity: 1 })).rejects.toThrow();
  });

  it("adding to a cart does NOT reserve or change stock", async () => {
    await add("alice", variantId, 10);
    await add("bob", variantId, 10); // both can hold all 10: nothing is reserved
    expect(await stockOf()).toBe(10);
    expect((await view("alice")).body.items[0].issue).toBeNull();
    expect((await view("bob")).body.items[0].issue).toBeNull();
  });

  it("rejects more than the current stock (409, with how many are available) and changes nothing", async () => {
    await add("alice", variantId, 4);
    const r = await add("alice", variantId, 7); // 4 + 7 = 11 > 10
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", variantId, availableQuantity: 10 });
    expect((await view("alice")).body.items[0].quantity).toBe(4);
    await setVariant(variant2Id, { stock: 0 });
    expect((await add("alice", variant2Id, 1)).body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", availableQuantity: 0 });
  });

  it.each([0, -1, -100, 1.5, 0.1, "3", "", null, true, [], {}, 100, 1e9])("rejects invalid quantity %j", async (q) => {
    const r = await add("alice", variantId, q);
    expect([422]).toContain(r.status);
    expect(await rowsOf()).toHaveLength(0);
    const r2 = await put("alice", variantId, q);
    expect(r2.status).toBe(422);
    expect(await rowsOf()).toHaveLength(0);
  });

  it("rejects a missing quantity, missing variantId, malformed ids and non-JSON bodies", async () => {
    expect((await call("POST", "/api/cart/items", { user: "alice", body: { variantId } })).status).toBe(422);
    expect((await call("POST", "/api/cart/items", { user: "alice", body: { quantity: 1 } })).status).toBe(422);
    expect((await call("POST", "/api/cart/items", { user: "alice", body: { variantId: "nope", quantity: 1 } })).status).toBe(422);
    expect((await call("POST", "/api/cart/items", { user: "alice", raw: "{bad" })).status).toBe(400);
    expect((await call("POST", "/api/cart/items", { user: "alice", raw: "variantId=x", contentType: "application/x-www-form-urlencoded" })).status).toBe(415);
    expect((await call("POST", "/api/cart/items", { user: "alice", body: { variantId, quantity: 1 }, headers: { origin: "https://evil.example" } })).status).toBe(403);
    expect(await rowsOf()).toHaveLength(0);
  });

  it("enforces the per-line maximum when quantities accumulate", async () => {
    await setVariant(variantId, { stock: 500 });
    await add("alice", variantId, 60);
    const r = await add("alice", variantId, 60);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("QUANTITY_LIMIT");
    expect((await view("alice")).body.items[0].quantity).toBe(60);
  });

  it("limits the number of distinct lines", async () => {
    const extra = Array.from({ length: 50 }, (_, i) => ({ productId, sku: `X-${i}`, label: `v${i}`, mrpPaise: 100, pricePaise: 100, stock: 5 }));
    const made = await db.insert(s.productVariants).values(extra).returning();
    for (const v of made.slice(0, 50)) expect((await add("alice", v.id, 1)).status).toBe(200);
    const r = await add("alice", variantId, 1);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("CART_LINE_LIMIT");
    expect((await add("alice", made[0].id, 1)).status).toBe(200); // existing lines can still change
  });
});

describe("updating quantity (PUT sets an exact amount)", () => {
  it("sets the quantity, can raise and lower it, and is idempotent", async () => {
    await add("alice", variantId, 2);
    expect((await put("alice", variantId, 5)).body.items[0].quantity).toBe(5);
    expect((await put("alice", variantId, 5)).body.items[0].quantity).toBe(5); // retry: no change
    expect((await put("alice", variantId, 5)).body.items[0].quantity).toBe(5);
    expect((await put("alice", variantId, 1)).body.items[0].quantity).toBe(1);
    expect(await rowsOf()).toHaveLength(1);
  });

  it("creates the line when it isn't there yet", async () => {
    const r = await put("alice", variant2Id, 3);
    expect(r.status).toBe(200);
    expect(r.body.items[0]).toMatchObject({ variantId: variant2Id, quantity: 3 });
  });

  it("cannot be set above stock, and zero is not a way to delete", async () => {
    await add("alice", variantId, 2);
    const over = await put("alice", variantId, 11);
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect((await put("alice", variantId, 0)).status).toBe(422);
    expect((await view("alice")).body.items[0].quantity).toBe(2);
  });

  it("a malformed or unknown variant id is 'unavailable', never a 500", async () => {
    expect((await put("alice", "not-a-uuid", 1)).body.error.code).toBe("VARIANT_UNAVAILABLE");
    expect((await put("alice", "44444444-4444-4444-8444-444444444444", 1)).body.error.code).toBe("VARIANT_UNAVAILABLE");
    expect((await add("alice", "44444444-4444-4444-8444-444444444444", 1)).status).toBe(409);
  });
});

describe("removing and clearing", () => {
  it("DELETE removes just that line; repeating it is harmless", async () => {
    await add("alice", variantId, 1);
    await add("alice", variant2Id, 1);
    const r = await call("DELETE", `/api/cart/items/${variantId}`, { user: "alice" });
    expect(r.body.items.map((i: any) => i.variantId)).toEqual([variant2Id]);
    expect((await call("DELETE", `/api/cart/items/${variantId}`, { user: "alice" })).status).toBe(200);
    expect((await call("DELETE", "/api/cart/items/garbage", { user: "alice" })).status).toBe(200);
    expect((await view("alice")).body.items).toHaveLength(1);
  });

  it("DELETE /api/cart clears everything; clearing an empty or nonexistent cart is fine", async () => {
    await add("alice", variantId, 1);
    await add("alice", variant2Id, 2);
    const r = await call("DELETE", "/api/cart", { user: "alice" });
    expect(r.body.items).toEqual([]);
    expect(r.body.summary.canCheckout).toBe(false);
    expect((await call("DELETE", "/api/cart", { user: "alice" })).status).toBe(200);
    expect((await call("DELETE", "/api/cart", { user: "never-had-a-cart" })).status).toBe(200);
    expect(await rowsOf()).toHaveLength(0);
  });

  it("clearing the cart does not touch stock", async () => {
    await add("alice", variantId, 4);
    await call("DELETE", "/api/cart", { user: "alice" });
    expect(await stockOf()).toBe(10);
  });
});

describe("deleted and inactive products and variants", () => {
  it("an inactive variant is flagged, excluded from the subtotal, and can't be added or changed, only removed", async () => {
    await add("alice", variantId, 2);
    await add("alice", variant2Id, 1);
    await setVariant(variantId, { isActive: false });

    const r = await view("alice");
    expect(r.status).toBe(200);
    expect(r.body.items[0]).toMatchObject({ variantId, issue: "UNAVAILABLE", availableQuantity: 0 });
    expect(r.body.summary).toMatchObject({ subtotalPaise: 30000, hasIssues: true, canCheckout: false });

    expect((await add("alice", variantId, 1)).body.error.code).toBe("VARIANT_UNAVAILABLE");
    expect((await put("alice", variantId, 1)).body.error.code).toBe("VARIANT_UNAVAILABLE");
    expect((await call("DELETE", `/api/cart/items/${variantId}`, { user: "alice" })).body.items).toHaveLength(1);
  });

  it("an inactive PRODUCT makes all of its variants unavailable", async () => {
    await add("alice", variantId, 1);
    await add("alice", variant2Id, 1);
    await db.update(s.products).set({ isActive: false }).where(eq(s.products.id, productId));
    const r = await view("alice");
    expect(r.body.items.map((i: any) => i.issue)).toEqual(["UNAVAILABLE", "UNAVAILABLE"]);
    expect(r.body.summary).toMatchObject({ subtotalPaise: 0, canCheckout: false });
    expect((await add("alice", variantId, 1)).status).toBe(409);
  });

  it("reactivating brings the line back to normal (the cart never lost it)", async () => {
    await add("alice", variantId, 2);
    await setVariant(variantId, { isActive: false });
    await setVariant(variantId, { isActive: true });
    const r = await view("alice");
    expect(r.body.items[0]).toMatchObject({ quantity: 2, issue: null });
    expect(r.body.summary.canCheckout).toBe(true);
  });

  it("a hard-deleted variant simply drops out of the cart: no error, others unaffected", async () => {
    await add("alice", variantId, 1);
    await add("alice", variant2Id, 1);
    await db.delete(s.productVariants).where(eq(s.productVariants.id, variantId));
    const r = await view("alice");
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.variantId)).toEqual([variant2Id]);
  });

  it("a hard-deleted PRODUCT removes its lines the same way", async () => {
    await add("alice", variantId, 1);
    await db.delete(s.products).where(eq(s.products.id, productId));
    expect((await view("alice")).body.items).toEqual([]);
    expect(await rowsOf()).toHaveLength(0);
  });
});

describe("changes after an item was added", () => {
  it("price changes show up immediately: the cart never shows the old price", async () => {
    await add("alice", variantId, 2);
    expect((await view("alice")).body.summary.subtotalPaise).toBe(30000);

    await setVariant(variantId, { pricePaise: 17500, mrpPaise: 25000 });
    const r = await view("alice");
    expect(r.body.items[0]).toMatchObject({ unitPricePaise: 17500, mrpPaise: 25000, lineTotalPaise: 35000 });
    expect(r.body.summary).toMatchObject({ subtotalPaise: 35000, savingsPaise: 15000 });

    await setVariant(variantId, { pricePaise: 12000 });
    expect((await view("alice")).body.summary.subtotalPaise).toBe(24000);
  });

  it("stock changes show as issues without altering the cart, and recover on restock", async () => {
    await add("alice", variantId, 5);

    await setVariant(variantId, { stock: 3 });
    let r = await view("alice");
    expect(r.body.items[0]).toMatchObject({ quantity: 5, issue: "INSUFFICIENT_STOCK", availableQuantity: 3 });
    expect(r.body.summary).toMatchObject({ subtotalPaise: 0, canCheckout: false, hasIssues: true });

    await setVariant(variantId, { stock: 0 });
    r = await view("alice");
    expect(r.body.items[0]).toMatchObject({ issue: "OUT_OF_STOCK", availableQuantity: 0 });

    expect((await rowsOf())[0].quantity).toBe(5); // reading never rewrites the cart

    await setVariant(variantId, { stock: 20 });
    r = await view("alice");
    expect(r.body.items[0]).toMatchObject({ quantity: 5, issue: null });
    expect(r.body.summary.canCheckout).toBe(true);
  });

  it("the customer can fix a short line by lowering it to what's available", async () => {
    await add("alice", variantId, 5);
    await setVariant(variantId, { stock: 3 });
    expect((await put("alice", variantId, 4)).status).toBe(409);
    const r = await put("alice", variantId, 3);
    expect(r.body.items[0].issue).toBeNull();
  });

  it("pure functions: summary excludes lines with issues; line views derive issues correctly", () => {
    const base = { variantId: "v", quantity: 2, sku: "S", variantLabel: "l", pricePaise: 100, mrpPaise: 150, stock: 5, variantActive: true, productId: "p", productName: "n", productSlug: "n", productActive: true, imageKey: null };
    expect(toLineView(base).issue).toBeNull();
    expect(toLineView({ ...base, stock: 1 }).issue).toBe("INSUFFICIENT_STOCK");
    expect(toLineView({ ...base, stock: 0 }).issue).toBe("OUT_OF_STOCK");
    expect(toLineView({ ...base, variantActive: false }).issue).toBe("UNAVAILABLE");
    expect(toLineView({ ...base, productActive: false, stock: 0 }).issue).toBe("UNAVAILABLE");
    expect(toLineView({ ...base, stock: 100000 }).availableQuantity).toBe(99);
    const sum = computeCartSummary([toLineView(base), toLineView({ ...base, variantId: "w", stock: 0 })]);
    expect(sum).toMatchObject({ lineCount: 2, totalQuantity: 4, subtotalPaise: 200, savingsPaise: 100, hasIssues: true, canCheckout: false });
  });
});

describe("customer isolation", () => {
  it("each customer sees only their own cart; one customer's changes never touch another's", async () => {
    await add("alice", variantId, 3);
    await add("bob", variant2Id, 1);

    expect((await view("alice")).body.items.map((i: any) => [i.variantId, i.quantity])).toEqual([[variantId, 3]]);
    expect((await view("bob")).body.items.map((i: any) => [i.variantId, i.quantity])).toEqual([[variant2Id, 1]]);

    // Bob acts on the very variant Alice has in her cart
    await call("DELETE", `/api/cart/items/${variantId}`, { user: "bob" });
    await put("bob", variantId, 9);
    await add("bob", variantId, 1);
    expect((await view("alice")).body.items[0].quantity).toBe(3);

    await call("DELETE", "/api/cart", { user: "bob" });
    expect((await view("alice")).body.items).toHaveLength(1);
    expect((await view("bob")).body.items).toEqual([]);

    expect(await db.select().from(s.carts)).toHaveLength(2);
  });

  it("there is no cart identifier anywhere to tamper with", async () => {
    const r = await add("alice", variantId, 1);
    const text = JSON.stringify(r.body);
    const [cart] = await db.select().from(s.carts);
    expect(text).not.toContain(cart.id);
    expect(Object.keys(r.body)).toEqual(["items", "summary"]);
    for (const extra of [{ cartId: cart.id }, { profileId: cart.profileId }]) {
      expect((await add("bob", variantId, 1, extra)).status).toBe(422);
    }
    expect((await view("bob")).body.items).toEqual([]);
  });

  it("customers have exactly one cart each, even under simultaneous first requests", async () => {
    await setVariant(variantId, { stock: 100 }); // plenty, so only cart creation is under test
    const rs = await Promise.all(Array.from({ length: 12 }, () => add("alice", variantId, 1)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await db.select().from(s.carts)).toHaveLength(1);
  });
});

describe("simultaneous cart updates", () => {
  it("10 simultaneous +1 adds of one variant all count (none lost) and make one line", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => add("alice", variantId, 1)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const rows = await rowsOf();
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(10);
  });

  it("with stock 10, 25 simultaneous +1 adds: exactly 10 succeed, the rest are 409, quantity never exceeds stock", async () => {
    const rs = await Promise.all(Array.from({ length: 25 }, () => add("alice", variantId, 1)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(10);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(15);
    expect((await rowsOf())[0].quantity).toBe(10);
    expect(await stockOf()).toBe(10); // still nothing reserved
  });

  it("simultaneous adds of different variants by one customer all land", async () => {
    const made = await db.insert(s.productVariants).values(Array.from({ length: 8 }, (_, i) => ({ productId, sku: `P-${i}`, label: `p${i}`, mrpPaise: 100, pricePaise: 100, stock: 5 }))).returning();
    const rs = await Promise.all(made.map((v) => add("alice", v.id, 2)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(await rowsOf()).toHaveLength(8);
  });

  it("racing PUTs end at one of the requested values, never a blend, and always one line", async () => {
    const rs = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((q) => put("alice", variantId, q)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    const rows = await rowsOf();
    expect(rows).toHaveLength(1);
    expect([1, 2, 3, 4, 5, 6, 7, 8]).toContain(rows[0].quantity);
  });

  it("remove racing add leaves the cart consistent (0 or 1 line, never a duplicate or error)", async () => {
    await add("alice", variantId, 1);
    const rs = await Promise.all([
      ...Array.from({ length: 5 }, () => add("alice", variantId, 1)),
      ...Array.from({ length: 5 }, () => call("DELETE", `/api/cart/items/${variantId}`, { user: "alice" })),
    ]);
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect((await rowsOf()).length).toBeLessThanOrEqual(1);
  });

  it("retrying the same PUT 10 times at once is safe (idempotent)", async () => {
    const rs = await Promise.all(Array.from({ length: 10 }, () => put("alice", variantId, 4)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect((await rowsOf())[0].quantity).toBe(4);
  });
});

describe("checkout from the cart", () => {
  it("an empty cart cannot be checked out: 422, no order, no stock change, Razorpay not called", async () => {
    const addr = await addAddress("alice");
    const r = await rawCheckout("alice", addr.id);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("EMPTY_CART");
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf()).toBe(10);
    expect(gatewayCalls).toHaveLength(0);

    await add("alice", variantId, 1);
    await call("DELETE", "/api/cart", { user: "alice" });
    expect((await rawCheckout("alice", addr.id)).body.error.code).toBe("EMPTY_CART"); // emptied again
  });

  it("another customer's cart is never used (bob's checkout with an empty cart ignores alice's)", async () => {
    await add("alice", variantId, 5);
    const bobAddr = await addAddress("bob");
    expect((await rawCheckout("bob", bobAddr.id)).body.error.code).toBe("EMPTY_CART");
    expect(await db.select().from(s.orders)).toHaveLength(0);
  });

  it("buys exactly what is in the cart, at current database prices; shipping is added by the ORDER, not the cart", async () => {
    await db.insert(s.siteSettings).values({ key: "shipping", value: { flatRatePaise: 4000, freeShippingAbovePaise: null } });
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 2 }, { variantId: variant2Id, quantity: 1 }]);
    const cartSubtotal = (await view("alice")).body.summary.subtotalPaise;
    expect(cartSubtotal).toBe(60000);

    const r = await rawCheckout("alice", addr.id);
    expect(r.status).toBe(201);
    expect(r.body.amountPaise).toBe(64000); // 60000 + 4000 shipping
    const [order] = await db.select().from(s.orders);
    expect(order).toMatchObject({ subtotalPaise: 60000, shippingPaise: 4000, totalPaise: 64000 });
    expect(await stockOf()).toBe(8);
    expect(await stockOf(variant2Id)).toBe(9);
  });

  it("price changed after the customer saw the cart: expectedSubtotalPaise catches it, nothing is created", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 2 }]);
    const seen = (await view("alice")).body.summary.subtotalPaise; // 30000
    await setVariant(variantId, { pricePaise: 16000 });

    const r = await rawCheckout("alice", addr.id, { expectedSubtotalPaise: seen });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: "PRICE_CHANGED", currentSubtotalPaise: 32000 });
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf()).toBe(10); // the stock taken inside the failed transaction was rolled back
    expect(gatewayCalls).toHaveLength(0);

    const ok = await rawCheckout("alice", addr.id, { expectedSubtotalPaise: 32000 }); // customer accepted the new price
    expect(ok.status).toBe(201);
    expect(ok.body.amountPaise).toBe(32000);
  });

  it("without expectedSubtotalPaise the order still uses the CURRENT price, never an old one", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 1 }]);
    await setVariant(variantId, { pricePaise: 9900 });
    const r = await rawCheckout("alice", addr.id);
    expect(r.body.amountPaise).toBe(9900);
    expect((await db.select().from(s.orderItems))[0].unitPricePaise).toBe(9900);
  });

  it("an item that became inactive blocks checkout (409) and leaves cart and stock untouched", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 1 }, { variantId: variant2Id, quantity: 1 }]);
    await setVariant(variantId, { isActive: false });
    const r = await rawCheckout("alice", addr.id);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: "VARIANT_UNAVAILABLE", variantId });
    expect(await db.select().from(s.orders)).toHaveLength(0);
    expect(await stockOf(variant2Id)).toBe(10);
    expect(await rowsOf()).toHaveLength(2);
  });

  it("starting checkout leaves the cart intact; it empties only when payment is confirmed", async () => {
    const addr = await addAddress("alice");
    const co = (await checkout("alice", addr.id, { items: [{ variantId, quantity: 2 }, { variantId: variant2Id, quantity: 1 }] })).body;
    expect((await view("alice")).body.items).toHaveLength(2); // still there while unpaid

    await applyCapturedPayment(db, { razorpayOrderId: co.razorpayOrderId, razorpayPaymentId: "pay_1", amountPaise: co.amountPaise });
    expect((await view("alice")).body.items).toEqual([]); // paid -> consumed
  });

  it("only what was bought leaves the cart if it changed after checkout started", async () => {
    const addr = await addAddress("alice");
    const co = (await checkout("alice", addr.id, { items: [{ variantId, quantity: 2 }] })).body;
    await add("alice", variantId, 3); // now 5 in the cart
    await add("alice", variant2Id, 1); // plus something unrelated
    await applyCapturedPayment(db, { razorpayOrderId: co.razorpayOrderId, razorpayPaymentId: "pay_1", amountPaise: co.amountPaise });
    const r = await view("alice");
    expect(r.body.items.map((i: any) => [i.variantId, i.quantity]).sort()).toEqual([[variantId, 3], [variant2Id, 1]].sort());
    // and the paid order is unaffected by later cart edits
    expect((await db.select().from(s.orderItems))[0]).toMatchObject({ quantity: 2 });
  });

  it("an expired or abandoned checkout leaves the cart as it was, so the customer can retry", async () => {
    const addr = await addAddress("alice");
    await checkout("alice", addr.id, { items: [{ variantId, quantity: 2 }] });
    await db.update(s.orders).set({ expiresAt: new Date(Date.now() - 3600_000) });
    await expirePendingOrders(db);
    expect((await view("alice")).body.items[0].quantity).toBe(2);
    expect(await stockOf()).toBe(10);
  });

  it("a paid order for one customer never touches another customer's cart", async () => {
    const aAddr = await addAddress("alice");
    await add("bob", variantId, 4);
    const co = (await checkout("alice", aAddr.id, { items: [{ variantId, quantity: 2 }] })).body;
    await applyCapturedPayment(db, { razorpayOrderId: co.razorpayOrderId, razorpayPaymentId: "pay_1", amountPaise: co.amountPaise });
    expect((await view("bob")).body.items[0].quantity).toBe(4);
  });

  it("successful verified checkout callback clears the server-side cart immediately", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 2 }, { variantId: variant2Id, quantity: 1 }]);
    expect((await view("alice")).body.items).toHaveLength(2);

    const co = (await rawCheckout("alice", addr.id)).body;
    expect((await view("alice")).body.items).toHaveLength(2); // still there while pending

    const sig = createHmac("sha256", KEY_SECRET).update(`${co.razorpayOrderId}|pay_test_cb_1`).digest("hex");
    const verifyRes = await call("POST", "/api/checkout/verify", {
      user: "alice",
      body: {
        razorpay_order_id: co.razorpayOrderId,
        razorpay_payment_id: "pay_test_cb_1",
        razorpay_signature: sig,
      },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(true);

    const cartAfter = await view("alice");
    expect(cartAfter.body.items).toEqual([]);
    expect(cartAfter.body.summary.totalQuantity).toBe(0);
  });

  it("failed or cancelled checkout verification leaves the cart intact", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 2 }]);
    const co = (await rawCheckout("alice", addr.id)).body;

    const verifyRes = await call("POST", "/api/checkout/verify", {
      user: "alice",
      body: {
        razorpay_order_id: co.razorpayOrderId,
        razorpay_payment_id: "pay_bad",
        razorpay_signature: "invalid_signature",
      },
    });
    expect(verifyRes.status).toBe(400);

    const cartAfter = await view("alice");
    expect(cartAfter.body.items).toHaveLength(1);
    expect(cartAfter.body.items[0].quantity).toBe(2);
  });

  it("verifying checkout only consumes purchased items, preserving unrelated items in the cart", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 2 }, { variantId: variant2Id, quantity: 1 }]);

    // Checkout only variantId
    const co = (await rawCheckout("alice", addr.id, { items: [{ variantId, quantity: 2 }] })).body;

    const sig = createHmac("sha256", KEY_SECRET).update(`${co.razorpayOrderId}|pay_unrelated_1`).digest("hex");
    const verifyRes = await call("POST", "/api/checkout/verify", {
      user: "alice",
      body: {
        razorpay_order_id: co.razorpayOrderId,
        razorpay_payment_id: "pay_unrelated_1",
        razorpay_signature: sig,
      },
    });
    expect(verifyRes.status).toBe(200);

    // Only variantId was consumed; variant2Id remains in cart
    const cartAfter = await view("alice");
    expect(cartAfter.body.items).toHaveLength(1);
    expect(cartAfter.body.items[0].variantId).toBe(variant2Id);
    expect(cartAfter.body.items[0].quantity).toBe(1);
  });

  it("retrying verified callback is idempotent and does not corrupt cart or order", async () => {
    const addr = await addAddress("alice");
    await fillCart("alice", [{ variantId, quantity: 1 }]);
    const co = (await rawCheckout("alice", addr.id)).body;

    const sig = createHmac("sha256", KEY_SECRET).update(`${co.razorpayOrderId}|pay_retry_1`).digest("hex");
    const payload = {
      razorpay_order_id: co.razorpayOrderId,
      razorpay_payment_id: "pay_retry_1",
      razorpay_signature: sig,
    };

    const first = await call("POST", "/api/checkout/verify", { user: "alice", body: payload });
    expect(first.status).toBe(200);
    expect(first.body.verified).toBe(true);
    expect((await view("alice")).body.items).toEqual([]);

    // Replay / retry
    const second = await call("POST", "/api/checkout/verify", { user: "alice", body: payload });
    expect(second.status).toBe(200);
    expect(second.body.verified).toBe(true);
    expect((await view("alice")).body.items).toEqual([]);
  });
});

