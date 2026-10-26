import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";
import { IMAGE_MAX_BYTES } from "../src/lib/storage/storage";
import {
  acall, addAddress, call, categoryId as seedCategoryId, checkout, db, deps, fillCart, GIF, IMG_BASE, JPEG, makeAdmin, memStore, PNG,
  productId as seedProductId, SVG, stockOf, uploadForm, useHarness, variant2Id, variantId, WEBP,
} from "./harness";

useHarness();

const SOME = "11111111-1111-4111-8111-111111111111";
const audit = async (action?: string) => (await db.select().from(s.adminAuditLog)).filter((a) => !action || a.action === action);
const admin = async () => {
  await makeAdmin("boss");
};

const mkCategory = (body: object) => acall("POST", "/api/admin/categories", { user: "boss", body });
const mkProduct = (body: object) => acall("POST", "/api/admin/products", { user: "boss", body: { categoryId: seedCategoryId, ...body } });
const mkVariant = (pid: string, body: object) =>
  acall("POST", `/api/admin/products/${pid}/variants`, { user: "boss", body: { sku: "NEW-1", label: "100 g", mrpPaise: 10000, pricePaise: 8000, stock: 5, ...body } });
const upload = (pid: string, bytes: Uint8Array, opts: Parameters<typeof uploadForm>[1] = {}) =>
  acall("POST", `/api/admin/products/${pid}/images`, { user: "boss", form: uploadForm(bytes, opts) });
const imagesOf = async (pid: string) => db.select().from(s.productImages).where(eq(s.productImages.productId, pid));
const variantRow = async (id: string) => (await db.select().from(s.productVariants).where(eq(s.productVariants.id, id)))[0];

/* -------------------------------------------------------------------------- */

describe("catalogue admin access control", () => {
  const endpoints: [string, string, unknown?][] = [
    ["GET", "/api/admin/categories"],
    ["POST", "/api/admin/categories", { name: "Hacked" }],
    ["GET", `/api/admin/categories/${SOME}`],
    ["PATCH", `/api/admin/categories/${SOME}`, { name: "Hacked" }],
    ["DELETE", `/api/admin/categories/${SOME}`],
    ["POST", `/api/admin/categories/${SOME}/image`],
    ["DELETE", `/api/admin/categories/${SOME}/image`],
    ["GET", "/api/admin/products"],
    ["POST", "/api/admin/products", { name: "Hacked", categoryId: SOME }],
    ["GET", `/api/admin/products/${SOME}`],
    ["PATCH", `/api/admin/products/${SOME}`, { name: "Hacked" }],
    ["DELETE", `/api/admin/products/${SOME}`],
    ["POST", `/api/admin/products/${SOME}/variants`, { sku: "X1", label: "x", mrpPaise: 1, pricePaise: 1 }],
    ["POST", `/api/admin/products/${SOME}/images`],
    ["PATCH", `/api/admin/variants/${SOME}`, { pricePaise: 1 }],
    ["DELETE", `/api/admin/variants/${SOME}`],
    ["PATCH", `/api/admin/images/${SOME}`, { alt: "x" }],
    ["DELETE", `/api/admin/images/${SOME}`],
  ];
  it.each(endpoints)("signed out: %s %s -> 401", async (method, path, body) => {
    expect((await acall(method, path, { body })).status).toBe(401);
  });
  it.each(endpoints)("customer (not admin): %s %s -> 403", async (method, path, body) => {
    expect((await acall(method, path, { user: "alice", body })).status).toBe(403);
  });

  it("a customer cannot change prices, products or images, even for real ids", async () => {
    await admin();
    const before = await variantRow(variantId);
    expect((await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "alice", body: { pricePaise: 1 } })).status).toBe(403);
    expect((await acall("DELETE", `/api/admin/products/${seedProductId}`, { user: "alice" })).status).toBe(403);
    expect((await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "alice", form: uploadForm(PNG()) })).status).toBe(403);
    expect((await variantRow(variantId)).pricePaise).toBe(before.pricePaise);
    expect(memStore.objects.size).toBe(0);
    expect(await audit()).toHaveLength(0);
  });

  it("uploads and edits must come from our own site (Origin), and missing storage config is a clear 503", async () => {
    await admin();
    const f = () => uploadForm(PNG());
    expect((await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "boss", form: f(), origin: null })).status).toBe(403);
    expect((await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "boss", form: f(), origin: "https://evil.example" })).status).toBe(403);
    expect(memStore.objects.size).toBe(0);
    const saved = deps.storage;
    (deps as any).storage = undefined;
    try {
      const r = await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "boss", form: f() });
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe("STORAGE_NOT_CONFIGURED");
    } finally {
      (deps as any).storage = saved;
    }
  });
});

describe("categories", () => {
  it("creates with an automatic URL slug and sensible defaults", async () => {
    await admin();
    const r = await mkCategory({ name: "Health Mix Powders" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: "Health Mix Powders", slug: "health-mix-powders", isActive: true, sortOrder: 0, productCount: 0, imageKey: null, imageUrl: null });
    expect((await mkCategory({ name: "Masalas & Powders" })).body.slug).toBe("masalas-and-powders");
    expect((await mkCategory({ name: "Thokku", description: " Tomato \n  and more ", sortOrder: 5, isActive: false })).body).toMatchObject({ slug: "thokku", description: "Tomato and more", sortOrder: 5, isActive: false });
  });

  it("same name again gets the next free slug; an explicit duplicate slug is refused", async () => {
    await admin();
    expect((await mkCategory({ name: "Snacks" })).body.slug).toBe("snacks");
    expect((await mkCategory({ name: "Snacks" })).body.slug).toBe("snacks-2");
    expect((await mkCategory({ name: "Snacks" })).body.slug).toBe("snacks-3");
    expect((await mkCategory({ name: "Other", slug: "custom-slug" })).body.slug).toBe("custom-slug");
    const dup = await mkCategory({ name: "Another", slug: "custom-slug" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("SLUG_TAKEN");
  });

  it("slug and field validation", async () => {
    await admin();
    for (const body of [{ name: "A" }, { name: "" }, {}, { name: "Ok Name", slug: "Bad Slug!" }, { name: "Ok Name", slug: "-lead" }, { name: "Ok Name", slug: "a" }, { name: "Ok Name", sortOrder: -1 }, { name: "Ok Name", isActive: "yes" }, { name: "Ok Name", imageKey: "evil/key.png" }, { name: "Ok Name", extra: 1 }]) {
      expect((await mkCategory(body)).status).toBe(422);
    }
    const tamil = await mkCategory({ name: "சிற்றுண்டி" }); // no Latin letters: can't make a slug
    expect(tamil.status).toBe(422);
    expect(tamil.body.error.fields.slug).toBeDefined();
    expect((await mkCategory({ name: "சிற்றுண்டி", slug: "sirrundi" })).status).toBe(201);
  });

  it("6 simultaneous creates of the same name all succeed with distinct slugs", async () => {
    await admin();
    const rs = await Promise.all(Array.from({ length: 6 }, () => mkCategory({ name: "Parallel Cat" })));
    expect(rs.every((r) => r.status === 201)).toBe(true);
    expect(new Set(rs.map((r) => r.body.slug)).size).toBe(6);
  });

  it("6 simultaneous creates of the same explicit slug: one wins, five get 409", async () => {
    await admin();
    const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => mkCategory({ name: `Race ${i}`, slug: "race-slug" })));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(5);
  });

  it("lists everything (including inactive) with product counts, in display order", async () => {
    await admin();
    await mkCategory({ name: "Zed", sortOrder: 1, isActive: false });
    await mkCategory({ name: "Alpha", sortOrder: 2 });
    const r = await acall("GET", "/api/admin/categories", { user: "boss" });
    expect(r.body.categories.map((c: any) => c.slug)).toEqual(["c", "zed", "alpha"]);
    expect(r.body.categories[0].productCount).toBe(1);
    expect(r.body.categories.find((c: any) => c.slug === "zed").isActive).toBe(false);
  });

  it("reads one; unknown or malformed ids are 404", async () => {
    await admin();
    expect((await acall("GET", `/api/admin/categories/${seedCategoryId}`, { user: "boss" })).body).toMatchObject({ slug: "c", productCount: 1 });
    expect((await acall("GET", `/api/admin/categories/${SOME}`, { user: "boss" })).status).toBe(404);
    expect((await acall("GET", "/api/admin/categories/nope", { user: "boss" })).status).toBe(404);
  });

  it("updates fields and records exactly what changed", async () => {
    await admin();
    const r = await acall("PATCH", `/api/admin/categories/${seedCategoryId}`, { user: "boss", body: { name: "Renamed", sortOrder: 9, isActive: false, description: "New text" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: "Renamed", sortOrder: 9, isActive: false, description: "New text", slug: "c" });
    const [a] = await audit("category.updated");
    expect((a.details as any).changes).toEqual({ name: { from: "C", to: "Renamed" }, sortOrder: { from: 0, to: 9 }, isActive: { from: true, to: false }, description: { from: null, to: "New text" } });
  });

  it("slug changes must stay unique; empty, unknown and image fields are rejected", async () => {
    await admin();
    const other = (await mkCategory({ name: "Other Cat" })).body;
    await mkCategory({ name: "Taken", slug: "taken-slug" });
    expect((await acall("PATCH", `/api/admin/categories/${other.id}`, { user: "boss", body: { slug: "taken-slug" } })).status).toBe(409);
    expect((await acall("PATCH", `/api/admin/categories/${other.id}`, { user: "boss", body: { slug: "other-cat-new" } })).body.slug).toBe("other-cat-new");
    for (const body of [{}, { imageKey: "x/y.png" }, { id: SOME }, { name: "" }]) {
      expect((await acall("PATCH", `/api/admin/categories/${other.id}`, { user: "boss", body })).status).toBe(422);
    }
    expect((await acall("PATCH", `/api/admin/categories/${SOME}`, { user: "boss", body: { name: "Nope" } })).status).toBe(404);
  });

  it("deactivating a category doesn't touch its products", async () => {
    await admin();
    await acall("PATCH", `/api/admin/categories/${seedCategoryId}`, { user: "boss", body: { isActive: false } });
    expect((await db.select().from(s.products))[0].isActive).toBe(true);
  });

  it("deletes an empty category; refuses one that still has products", async () => {
    await admin();
    const empty = (await mkCategory({ name: "Empty One" })).body;
    expect((await acall("DELETE", `/api/admin/categories/${empty.id}`, { user: "boss" })).status).toBe(200);
    expect((await acall("GET", `/api/admin/categories/${empty.id}`, { user: "boss" })).status).toBe(404);
    const blocked = await acall("DELETE", `/api/admin/categories/${seedCategoryId}`, { user: "boss" });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe("CATEGORY_NOT_EMPTY");
    expect(await db.select().from(s.categories).where(eq(s.categories.id, seedCategoryId))).toHaveLength(1);
    expect((await acall("DELETE", `/api/admin/categories/${SOME}`, { user: "boss" })).status).toBe(404);
  });
});

describe("products", () => {
  it("creates a product with defaults and an automatic slug", async () => {
    await admin();
    const r = await mkProduct({ name: "Nendram Raw Banana Powder (Nuts Mixed)" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ slug: "nendram-raw-banana-powder-nuts-mixed", isActive: true, isFeatured: false, variants: [], images: [], category: { slug: "c" } });
  });

  it("stores all the descriptive fields; descriptions keep their line breaks", async () => {
    await admin();
    const r = await mkProduct({
      name: "Karuppu Kavuni Kanji Mix", shortDescription: "Black rice  kanji", isFeatured: true, sortOrder: 3,
      description: "  Line one\r\nLine two\n\n\n\nLine three  ", ingredients: "Karuppu kavuni, ragi", usage: "Mix 2 tbsp in warm water",
    });
    expect(r.body).toMatchObject({ shortDescription: "Black rice kanji", isFeatured: true, sortOrder: 3, ingredients: "Karuppu kavuni, ragi", usage: "Mix 2 tbsp in warm water" });
    expect(r.body.description).toBe("Line one\nLine two\n\nLine three");
  });

  it("validation: category must exist, enums and sizes are enforced, unknown fields refused", async () => {
    await admin();
    const bad = await mkProduct({ name: "Ok Name", categoryId: SOME });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.categoryId).toBeDefined();
    for (const body of [{ name: "A" }, {}, { name: "Ok Name", categoryId: "nope" }, { name: "Ok Name", description: "x".repeat(5001) }, { name: "Ok Name", slug: "Bad Slug" }, { name: "Ok Name", id: SOME }, { name: "Ok Name", isActive: 1 }]) {
      expect((await mkProduct(body)).status).toBe(422);
    }
    expect(await db.select().from(s.products)).toHaveLength(1);
  });

  it("repeated names get -2, -3 slugs; explicit duplicate slugs are 409", async () => {
    await admin();
    expect((await mkProduct({ name: "Idli Podi" })).body.slug).toBe("idli-podi");
    expect((await mkProduct({ name: "Idli Podi" })).body.slug).toBe("idli-podi-2");
    expect((await mkProduct({ name: "Different", slug: "idli-podi" })).status).toBe(409);
  });

  it("detail returns category, variants (cheapest first) and images with URLs; 404 for unknown", async () => {
    await admin();
    await upload(seedProductId, PNG());
    const r = await acall("GET", `/api/admin/products/${seedProductId}`, { user: "boss" });
    expect(r.status).toBe(200);
    expect(r.body.variants.map((v: any) => v.sku)).toEqual(["KK-250", "KK-500"]);
    expect(r.body.images[0].url).toBe(`${IMG_BASE}/${r.body.images[0].key}`);
    expect(r.body.category).toMatchObject({ id: seedCategoryId });
    expect((await acall("GET", `/api/admin/products/${SOME}`, { user: "boss" })).status).toBe(404);
    expect((await acall("GET", "/api/admin/products/nope", { user: "boss" })).status).toBe(404);
  });

  it("lists with summary data and filters by search, category and active state", async () => {
    await admin();
    const cat2 = (await mkCategory({ name: "Podi" })).body;
    const idli = (await mkProduct({ name: "Idli Podi", categoryId: cat2.id })).body;
    await mkVariant(idli.id, { sku: "IDLI-100", pricePaise: 6000, mrpPaise: 7000, stock: 4 });
    await mkVariant(idli.id, { sku: "IDLI-200", pricePaise: 11000, mrpPaise: 12000, stock: 6, isActive: false });
    await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { isActive: false } });
    await upload(idli.id, JPEG());

    const all = await acall("GET", "/api/admin/products", { user: "boss" });
    expect(all.body.total).toBe(2);
    const row = all.body.products.find((p: any) => p.id === idli.id);
    expect(row).toMatchObject({ variantCount: 2, minPricePaise: 6000, maxPricePaise: 6000, totalStock: 10, category: { slug: "podi" } }); // price range counts active variants only
    expect(row.imageUrl).toMatch(new RegExp(`^${IMG_BASE}/products/${idli.id}/`));

    const ids = async (qs: string) => (await acall("GET", `/api/admin/products?${qs}`, { user: "boss" })).body.products.map((p: any) => p.id);
    expect(await ids("q=idli")).toEqual([idli.id]);
    expect(await ids("q=IDLI-200")).toEqual([idli.id]); // by SKU
    expect(await ids(`categoryId=${cat2.id}`)).toEqual([idli.id]);
    expect(await ids("active=false")).toEqual([seedProductId]);
    expect(await ids("active=true")).toEqual([idli.id]);
    expect(await ids("q=%25")).toEqual([]); // wildcard characters are literal
    expect((await acall("GET", "/api/admin/products?active=maybe", { user: "boss" })).status).toBe(422);
    expect((await acall("GET", "/api/admin/products?limit=1", { user: "boss" })).body.products).toHaveLength(1);
  });

  it("updates a product, moves it between categories, and audits the changes", async () => {
    await admin();
    const cat2 = (await mkCategory({ name: "Moved To" })).body;
    const r = await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { name: "New Name", categoryId: cat2.id, isFeatured: true, description: "Now described" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: "New Name", isFeatured: true, description: "Now described", category: { id: cat2.id } });
    const [a] = await audit("product.updated");
    expect(Object.keys((a.details as any).changes).sort()).toEqual(["categoryId", "description", "isFeatured", "name"]);
    expect((await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { categoryId: SOME } })).status).toBe(422);
    expect((await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: {} })).status).toBe(422);
    expect((await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { slug: "x" } })).status).toBe(422);
    expect((await acall("PATCH", `/api/admin/products/${SOME}`, { user: "boss", body: { name: "Nope" } })).status).toBe(404);
  });

  it("slug changes must stay unique", async () => {
    await admin();
    const other = (await mkProduct({ name: "Other Product" })).body;
    await mkProduct({ name: "Taken Product", slug: "taken-product" });
    expect((await acall("PATCH", `/api/admin/products/${other.id}`, { user: "boss", body: { slug: "taken-product" } })).status).toBe(409);
    expect((await acall("PATCH", `/api/admin/products/${other.id}`, { user: "boss", body: { slug: "fresh-slug" } })).body.slug).toBe("fresh-slug");
  });

  it("deactivating a product immediately makes it unavailable in customers' carts and checkout; reactivating restores it", async () => {
    await admin();
    await fillCart("alice", [{ variantId, quantity: 2 }]);
    await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { isActive: false } });
    const cart = await call("GET", "/api/cart", { user: "alice" });
    expect(cart.body.items[0].issue).toBe("UNAVAILABLE");
    expect(cart.body.summary.canCheckout).toBe(false);
    const addr = await addAddress("alice");
    expect((await call("POST", "/api/checkout", { user: "alice", body: { addressId: addr.id } })).status).toBe(409);
    await acall("PATCH", `/api/admin/products/${seedProductId}`, { user: "boss", body: { isActive: true } });
    expect((await call("GET", "/api/cart", { user: "alice" })).body.items[0].issue).toBeNull();
  });

  it("deletes a never-ordered product with its variants, images and cart lines, and removes its image files", async () => {
    await admin();
    await upload(seedProductId, PNG());
    await upload(seedProductId, JPEG());
    await fillCart("alice", [{ variantId, quantity: 1 }]);
    const keys = (await imagesOf(seedProductId)).map((i) => i.r2Key);
    expect(memStore.objects.size).toBe(2);

    const r = await acall("DELETE", `/api/admin/products/${seedProductId}`, { user: "boss" });
    expect(r.status).toBe(200);
    expect(await db.select().from(s.products)).toHaveLength(0);
    expect(await db.select().from(s.productVariants)).toHaveLength(0);
    expect(await db.select().from(s.productImages)).toHaveLength(0);
    expect(await db.select().from(s.cartItems)).toHaveLength(0);
    expect(memStore.objects.size).toBe(0);
    expect(memStore.deleted.sort()).toEqual(keys.sort());
    expect((await call("GET", "/api/cart", { user: "alice" })).body.items).toEqual([]);
    expect(await audit("product.deleted")).toHaveLength(1);
  });

  it("refuses to delete a product that has been ordered, and changes nothing", async () => {
    await admin();
    await upload(seedProductId, PNG());
    const addr = await addAddress("alice");
    await checkout("alice", addr.id);
    const r = await acall("DELETE", `/api/admin/products/${seedProductId}`, { user: "boss" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("PRODUCT_HAS_ORDERS");
    expect(await db.select().from(s.products)).toHaveLength(1);
    expect(await db.select().from(s.productVariants)).toHaveLength(2);
    expect(memStore.objects.size).toBe(1);
    expect((await acall("DELETE", `/api/admin/products/${SOME}`, { user: "boss" })).status).toBe(404);
  });

  it("a storage failure while cleaning up after a delete does not fail the delete", async () => {
    await admin();
    await upload(seedProductId, PNG());
    memStore.failDelete = true;
    const logged: unknown[] = [];
    const saved = deps.log;
    (deps as any).log = (m: string, e: unknown) => logged.push([m, e]);
    try {
      expect((await acall("DELETE", `/api/admin/products/${seedProductId}`, { user: "boss" })).status).toBe(200);
    } finally {
      (deps as any).log = saved;
    }
    expect(await db.select().from(s.products)).toHaveLength(0);
    expect(logged).toHaveLength(1); // orphan was reported, not hidden
  });
});

describe("variants: price, MRP and stock", () => {
  it("creates a variant (SKU normalised, stock defaults to 0) that is immediately purchasable", async () => {
    await admin();
    const r = await mkVariant(seedProductId, { sku: " sp-100g ", label: "100  g", weightGrams: 100, stock: undefined });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ sku: "SP-100G", label: "100 g", weightGrams: 100, mrpPaise: 10000, pricePaise: 8000, stock: 0, isActive: true });
    const r2 = await mkVariant(seedProductId, { sku: "SP-200G", stock: 25 });
    await call("POST", "/api/cart/items", { user: "alice", body: { variantId: r2.body.id, quantity: 3 } });
    expect((await call("GET", "/api/cart", { user: "alice" })).body.summary.subtotalPaise).toBe(24000);
  });

  it("SKUs are unique, case-insensitively", async () => {
    await admin();
    expect((await mkVariant(seedProductId, { sku: "dup-1" })).status).toBe(201);
    const dup = await mkVariant(seedProductId, { sku: "DUP-1" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("SKU_TAKEN");
    expect((await mkVariant(seedProductId, { sku: "kk-250" })).status).toBe(409); // same as a seeded one
  });

  it("rejects bad money, quantities and fields", async () => {
    await admin();
    const bad: object[] = [
      { pricePaise: 12000, mrpPaise: 10000 }, // selling price above MRP
      { pricePaise: 0 }, { pricePaise: -1 }, { pricePaise: 80.5 }, { pricePaise: "80" }, { mrpPaise: 0 }, { mrpPaise: 10_000_001 },
      { stock: -1 }, { stock: 1.5 }, { stock: 1_000_001 }, { label: "" }, { label: "x".repeat(41) }, { sku: "a" }, { sku: "bad sku!" },
      { weightGrams: 0 }, { weightGrams: 1.5 }, { isActive: "true" }, { productId: SOME }, { extra: 1 },
    ];
    for (const b of bad) expect((await mkVariant(seedProductId, { sku: "OK-1", ...b })).status).toBe(422);
    expect(await db.select().from(s.productVariants)).toHaveLength(2);
    expect((await mkVariant(SOME, {})).status).toBe(404);
  });

  it("updates price, MRP, label, active flag and SKU, and audits before/after", async () => {
    await admin();
    const r = await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { pricePaise: 14000, mrpPaise: 21000, label: "250 g pack", isActive: false } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ pricePaise: 14000, mrpPaise: 21000, label: "250 g pack", isActive: false });
    const [a] = await audit("variant.updated");
    expect((a.details as any).changes).toEqual({ pricePaise: { from: 15000, to: 14000 }, mrpPaise: { from: 20000, to: 21000 }, label: { from: "250 g", to: "250 g pack" }, isActive: { from: true, to: false } });
  });

  it("price must stay at or below MRP across updates, judged on the combined result", async () => {
    await admin();
    const url = `/api/admin/variants/${variantId}`; // price 15000, MRP 20000
    expect((await acall("PATCH", url, { user: "boss", body: { mrpPaise: 14000 } })).status).toBe(422); // MRP below existing price
    expect((await acall("PATCH", url, { user: "boss", body: { pricePaise: 20001 } })).status).toBe(422); // price above existing MRP
    expect((await acall("PATCH", url, { user: "boss", body: { mrpPaise: 14000, pricePaise: 13000 } })).status).toBe(200); // both together is fine
    expect((await acall("PATCH", url, { user: "boss", body: { pricePaise: 14000 } })).status).toBe(200); // equal is fine
    const v = await variantRow(variantId);
    expect([v.mrpPaise, v.pricePaise]).toEqual([14000, 14000]);
  });

  it("price edits show up in customers' carts at once, but never rewrite existing orders", async () => {
    await admin();
    const addr = await addAddress("alice");
    const co = (await checkout("alice", addr.id)).body; // 2 x 15000
    await fillCart("bob", [{ variantId, quantity: 1 }]);
    await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { pricePaise: 12000 } });
    expect((await call("GET", "/api/cart", { user: "bob" })).body.items[0].unitPricePaise).toBe(12000);
    const order = await db.select().from(s.orders).where(eq(s.orders.id, co.orderId));
    expect(order[0].totalPaise).toBe(30000);
    expect((await db.select().from(s.orderItems))[0].unitPricePaise).toBe(15000);
  });

  it("stock: set an exact count (stocktake)", async () => {
    await admin();
    const r = await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { stock: 42 } });
    expect(r.body.stock).toBe(42);
    expect((await variantRow(variantId)).stock).toBe(42);
    for (const body of [{ stock: -1 }, { stock: 1.5 }, { stock: "5" }, { stock: 1_000_001 }]) {
      expect((await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body })).status).toBe(422);
    }
  });

  it("stock: add or remove relative to now; can never go below zero", async () => {
    await admin();
    const url = `/api/admin/variants/${variantId}`; // stock 10
    expect((await acall("PATCH", url, { user: "boss", body: { stockDelta: 15 } })).body.stock).toBe(25);
    expect((await acall("PATCH", url, { user: "boss", body: { stockDelta: -25 } })).body.stock).toBe(0);
    const under = await acall("PATCH", url, { user: "boss", body: { stockDelta: -1 } });
    expect(under.status).toBe(409);
    expect(under.body.error.code).toBe("STOCK_WOULD_GO_NEGATIVE");
    expect((await variantRow(variantId)).stock).toBe(0);
    for (const body of [{ stockDelta: 0 }, { stockDelta: 1.5 }, { stockDelta: "3" }, { stock: 5, stockDelta: 1 }]) {
      expect((await acall("PATCH", url, { user: "boss", body })).status).toBe(422);
    }
    const [a] = (await audit("variant.updated")).slice(-1);
    expect((a.details as any).stockDelta).toBeDefined();
  });

  it("20 simultaneous +1 stock adjustments are all counted", async () => {
    await admin();
    const rs = await Promise.all(Array.from({ length: 20 }, () => acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { stockDelta: 1 } })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect((await variantRow(variantId)).stock).toBe(30);
  });

  it("goods received while customers are buying: no sale and no delivery is lost", async () => {
    await admin();
    const buyers = ["b1", "b2", "b3", "b4", "b5"];
    const addrs: Record<string, string> = {};
    for (const u of buyers) {
      addrs[u] = (await addAddress(u)).id;
      await fillCart(u, [{ variantId, quantity: 1 }]);
    }
    const results = await Promise.all([
      ...buyers.map((u) => call("POST", "/api/checkout", { user: u, body: { addressId: addrs[u] } })),
      ...Array.from({ length: 5 }, () => acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { stockDelta: 2 } })),
    ]);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect(await stockOf()).toBe(10 - 5 + 10);
  });

  it("deleting a never-ordered variant removes it from carts; an ordered one can't be deleted", async () => {
    await admin();
    await fillCart("bob", [{ variantId: variant2Id, quantity: 1 }]);
    expect((await acall("DELETE", `/api/admin/variants/${variant2Id}`, { user: "boss" })).status).toBe(200);
    expect((await call("GET", "/api/cart", { user: "bob" })).body.items).toEqual([]);
    expect((await acall("DELETE", `/api/admin/variants/${variant2Id}`, { user: "boss" })).status).toBe(404);

    const addr = await addAddress("alice");
    await checkout("alice", addr.id);
    const r = await acall("DELETE", `/api/admin/variants/${variantId}`, { user: "boss" });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("VARIANT_HAS_ORDERS");
    expect(await variantRow(variantId)).toBeDefined();
    expect((await acall("PATCH", `/api/admin/variants/${SOME}`, { user: "boss", body: { stock: 1 } })).status).toBe(404);
  });
});

describe("product images (Cloudflare R2)", () => {
  it("uploads PNG, JPEG and WebP with server-generated keys, a public URL, and cache-friendly headers", async () => {
    await admin();
    for (const [bytes, ext, type] of [[PNG(), "png", "image/png"], [JPEG(), "jpg", "image/jpeg"], [WEBP(), "webp", "image/webp"]] as const) {
      const r = await upload(seedProductId, bytes, { filename: "whatever.bin", type: "application/octet-stream" });
      expect(r.status).toBe(201);
      expect(r.body.key).toMatch(new RegExp(`^products/${seedProductId}/[0-9a-f-]{36}\\.${ext}$`));
      expect(r.body.url).toBe(`${IMG_BASE}/${r.body.key}`);
      const obj = memStore.objects.get(r.body.key)!;
      expect(obj.contentType).toBe(type);
      expect(obj.cacheControl).toBe("public, max-age=31536000, immutable");
      expect(obj.bytes.length).toBe(bytes.length);
    }
    expect(await imagesOf(seedProductId)).toHaveLength(3);
    expect(await audit("image.added")).toHaveLength(3);
  });

  it("the first image is primary; later ones aren't unless asked, and exactly one is ever primary", async () => {
    await admin();
    const a = await upload(seedProductId, PNG(), { fields: { alt: "front of pack" } });
    const b = await upload(seedProductId, JPEG());
    expect([a.body.isPrimary, b.body.isPrimary]).toEqual([true, false]);
    expect(a.body.alt).toBe("front of pack");
    const c = await upload(seedProductId, WEBP(), { fields: { primary: "true" } });
    expect(c.body.isPrimary).toBe(true);
    const rows = await imagesOf(seedProductId);
    expect(rows.filter((r) => r.isPrimary).map((r) => r.id)).toEqual([c.body.id]);
    expect(rows.map((r) => r.sortOrder).sort()).toEqual([0, 1, 2]);
  });

  it("the filename and the client's Content-Type are ignored: the key is random and the type comes from the bytes", async () => {
    await admin();
    const r = await upload(seedProductId, PNG(), { filename: "../../etc/passwd.svg", type: "image/svg+xml" });
    expect(r.status).toBe(201);
    expect(r.body.key).not.toContain("passwd");
    expect(r.body.key).not.toContain("..");
    expect(r.body.key.endsWith(".png")).toBe(true);
    expect(memStore.objects.get(r.body.key)!.contentType).toBe("image/png");
  });

  it("refuses anything that isn't a real JPEG/PNG/WebP (SVG, GIF, text, HTML), whatever it claims to be", async () => {
    await admin();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const [bytes, type, filename] of [[SVG(), "image/svg+xml", "x.svg"], [SVG(), "image/png", "x.png"], [GIF(), "image/gif", "x.gif"], [html, "image/png", "x.png"], [exe, "image/jpeg", "x.jpg"], [new Uint8Array([0xff, 0xd8]), "image/jpeg", "short.jpg"]] as const) {
      const r = await upload(seedProductId, bytes, { type, filename });
      expect(r.status).toBe(415);
      expect(r.body.error.code).toBe("UNSUPPORTED_IMAGE");
    }
    expect(memStore.objects.size).toBe(0);
    expect(await imagesOf(seedProductId)).toHaveLength(0);
  });

  it("refuses empty files, oversize files, a missing file, and non-multipart requests", async () => {
    await admin();
    expect((await upload(seedProductId, new Uint8Array(0))).status).toBe(422);
    const big = new Uint8Array(IMAGE_MAX_BYTES + 1);
    big.set(PNG().subarray(0, 8));
    expect((await upload(seedProductId, big)).status).toBe(413);
    const exactly = new Uint8Array(IMAGE_MAX_BYTES);
    exactly.set(PNG().subarray(0, 8));
    expect((await upload(seedProductId, exactly)).status).toBe(201); // the limit itself is allowed

    const noFile = new FormData();
    noFile.append("alt", "x");
    expect((await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "boss", form: noFile })).status).toBe(422);
    expect((await acall("POST", `/api/admin/products/${seedProductId}/images`, { user: "boss", body: { file: "x" } })).status).toBe(415);
    expect((await upload(seedProductId, PNG(), { fields: { alt: "x".repeat(151) } })).status).toBe(422);
    expect((await upload(SOME, PNG())).status).toBe(404);
    expect((await upload("nope", PNG())).status).toBe(404);
    expect(memStore.objects.size).toBe(1);
  });

  it("allows at most 10 images per product and leaves no stray file behind when refusing", async () => {
    await admin();
    for (let i = 0; i < 10; i++) expect((await upload(seedProductId, PNG())).status).toBe(201);
    const r = await upload(seedProductId, PNG());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("IMAGE_LIMIT");
    expect(memStore.objects.size).toBe(10);
  });

  it("12 simultaneous uploads against the 10-image limit: exactly 10 stored, no orphans, one primary", async () => {
    await admin();
    const rs = await Promise.all(Array.from({ length: 12 }, () => upload(seedProductId, PNG())));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(10);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(2);
    const rows = await imagesOf(seedProductId);
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => r.isPrimary)).toHaveLength(1);
    expect([...memStore.objects.keys()].sort()).toEqual(rows.map((r) => r.r2Key).sort()); // storage and database agree exactly
  });

  it("a storage outage is a clean 502: nothing recorded", async () => {
    await admin();
    memStore.failPut = true;
    const r = await upload(seedProductId, PNG());
    expect(r.status).toBe(502);
    expect(r.body.error.code).toBe("STORAGE_ERROR");
    expect(await imagesOf(seedProductId)).toHaveLength(0);
    expect(await audit()).toHaveLength(0);
  });

  it("if recording fails after the file was stored, the file is removed again", async () => {
    await admin();
    memStore.onPut = async () => {
      await db.delete(s.products).where(eq(s.products.id, seedProductId)); // product vanishes mid-upload
    };
    const r = await upload(seedProductId, PNG());
    expect(r.status).toBe(404);
    expect(memStore.objects.size).toBe(0);
    expect(memStore.deleted).toHaveLength(1);
  });

  it("edits alt text, sort order and the primary image; a primary can't be 'unset'", async () => {
    await admin();
    const a = (await upload(seedProductId, PNG())).body;
    const b = (await upload(seedProductId, JPEG())).body;
    const r = await acall("PATCH", `/api/admin/images/${b.id}`, { user: "boss", body: { alt: "  side  view ", sortOrder: 7, isPrimary: true } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ alt: "side view", sortOrder: 7, isPrimary: true });
    expect((await imagesOf(seedProductId)).find((i) => i.id === a.id)!.isPrimary).toBe(false);
    for (const body of [{}, { isPrimary: false }, { r2Key: "evil/key.png" }, { productId: SOME }, { sortOrder: -1 }]) {
      expect((await acall("PATCH", `/api/admin/images/${a.id}`, { user: "boss", body })).status).toBe(422);
    }
    expect((await acall("PATCH", `/api/admin/images/${SOME}`, { user: "boss", body: { alt: "x" } })).status).toBe(404);
    expect((await acall("PATCH", "/api/admin/images/nope", { user: "boss", body: { alt: "x" } })).status).toBe(404);
  });

  it("8 simultaneous 'make primary' requests on different images leave exactly one primary", async () => {
    await admin();
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push((await upload(seedProductId, PNG())).body.id);
    const rs = await Promise.all(ids.map((id) => acall("PATCH", `/api/admin/images/${id}`, { user: "boss", body: { isPrimary: true } })));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect((await imagesOf(seedProductId)).filter((i) => i.isPrimary)).toHaveLength(1);
  });

  it("the database itself refuses a second primary image for one product (backstop)", async () => {
    await admin();
    await upload(seedProductId, PNG());
    await expect(db.insert(s.productImages).values({ productId: seedProductId, r2Key: "x/y.png", isPrimary: true })).rejects.toThrow();
  });

  it("deleting an image removes the record and the file; deleting the primary promotes the next one", async () => {
    await admin();
    const a = (await upload(seedProductId, PNG())).body;
    const b = (await upload(seedProductId, JPEG())).body;
    const r = await acall("DELETE", `/api/admin/images/${a.id}`, { user: "boss" });
    expect(r.status).toBe(200);
    expect(memStore.objects.has(a.key)).toBe(false);
    expect(memStore.objects.has(b.key)).toBe(true);
    const rows = await imagesOf(seedProductId);
    expect(rows.map((i) => [i.id, i.isPrimary])).toEqual([[b.id, true]]);
    expect((await acall("DELETE", `/api/admin/images/${b.id}`, { user: "boss" })).status).toBe(200); // last one
    expect(await imagesOf(seedProductId)).toHaveLength(0);
    expect((await acall("DELETE", `/api/admin/images/${a.id}`, { user: "boss" })).status).toBe(404);
  });

  it("a storage failure while deleting an image still deletes the record (and reports the orphan)", async () => {
    await admin();
    const a = (await upload(seedProductId, PNG())).body;
    memStore.failDelete = true;
    const logged: unknown[] = [];
    const saved = deps.log;
    (deps as any).log = (m: string, e: unknown) => logged.push([m, e]);
    try {
      expect((await acall("DELETE", `/api/admin/images/${a.id}`, { user: "boss" })).status).toBe(200);
    } finally {
      (deps as any).log = saved;
    }
    expect(await imagesOf(seedProductId)).toHaveLength(0);
    expect(logged).toHaveLength(1);
  });

  it("the primary image is what customers' carts show", async () => {
    await admin();
    await upload(seedProductId, PNG());
    const second = (await upload(seedProductId, JPEG(), { fields: { primary: "true" } })).body;
    await fillCart("alice", [{ variantId, quantity: 1 }]);
    expect((await call("GET", "/api/cart", { user: "alice" })).body.items[0].imageKey).toBe(second.key);
  });
});

describe("category images", () => {
  it("sets, replaces (removing the old file) and removes a category image", async () => {
    await admin();
    const set1 = await acall("POST", `/api/admin/categories/${seedCategoryId}/image`, { user: "boss", form: uploadForm(PNG()) });
    expect(set1.status).toBe(200);
    expect(set1.body.imageKey).toMatch(new RegExp(`^categories/${seedCategoryId}/[0-9a-f-]{36}\\.png$`));
    expect(set1.body.imageUrl).toBe(`${IMG_BASE}/${set1.body.imageKey}`);
    expect((await acall("GET", `/api/admin/categories/${seedCategoryId}`, { user: "boss" })).body.imageUrl).toBe(set1.body.imageUrl);

    const set2 = await acall("POST", `/api/admin/categories/${seedCategoryId}/image`, { user: "boss", form: uploadForm(WEBP()) });
    expect(set2.status).toBe(200);
    expect(memStore.objects.has(set1.body.imageKey)).toBe(false);
    expect(memStore.objects.has(set2.body.imageKey)).toBe(true);
    expect(memStore.objects.size).toBe(1);

    expect((await acall("DELETE", `/api/admin/categories/${seedCategoryId}/image`, { user: "boss" })).status).toBe(200);
    expect(memStore.objects.size).toBe(0);
    expect((await acall("GET", `/api/admin/categories/${seedCategoryId}`, { user: "boss" })).body.imageKey).toBeNull();
    expect((await acall("DELETE", `/api/admin/categories/${seedCategoryId}/image`, { user: "boss" })).status).toBe(200); // idempotent
  });

  it("applies the same file checks, and 404s for unknown categories", async () => {
    await admin();
    const url = `/api/admin/categories/${seedCategoryId}/image`;
    expect((await acall("POST", url, { user: "boss", form: uploadForm(SVG(), { type: "image/png" }) })).status).toBe(415);
    expect((await acall("POST", url, { user: "boss", form: uploadForm(new Uint8Array(0)) })).status).toBe(422);
    expect((await acall("POST", `/api/admin/categories/${SOME}/image`, { user: "boss", form: uploadForm(PNG()) })).status).toBe(404);
    expect(memStore.objects.size).toBe(0);
    memStore.failPut = true;
    expect((await acall("POST", url, { user: "boss", form: uploadForm(PNG()) })).status).toBe(502);
  });

  it("deleting a category removes its image file", async () => {
    await admin();
    const cat = (await mkCategory({ name: "With Picture" })).body;
    await acall("POST", `/api/admin/categories/${cat.id}/image`, { user: "boss", form: uploadForm(PNG()) });
    expect(memStore.objects.size).toBe(1);
    expect((await acall("DELETE", `/api/admin/categories/${cat.id}`, { user: "boss" })).status).toBe(200);
    expect(memStore.objects.size).toBe(0);
  });
});

describe("audit trail for catalogue changes", () => {
  it("records who changed what for categories, products, variants and images", async () => {
    await admin();
    const cat = (await mkCategory({ name: "Audited" })).body;
    const prod = (await mkProduct({ name: "Audited Product", categoryId: cat.id })).body;
    const v = (await mkVariant(prod.id, { sku: "AUD-1" })).body;
    await acall("PATCH", `/api/admin/variants/${v.id}`, { user: "boss", body: { pricePaise: 7000, stockDelta: 3 } });
    const img = (await upload(prod.id, PNG())).body;
    await acall("DELETE", `/api/admin/images/${img.id}`, { user: "boss" });
    expect((await audit()).map((a) => a.action).sort()).toEqual(["category.created", "image.added", "image.deleted", "product.created", "variant.created", "variant.updated"]);
    expect((await audit()).every((a) => a.actorProfileId !== null)).toBe(true);
  });

  it("failed or rejected changes leave no audit entry", async () => {
    await admin();
    await mkCategory({ name: "A" });
    await mkVariant(seedProductId, { sku: "KK-250" });
    await acall("PATCH", `/api/admin/variants/${variantId}`, { user: "boss", body: { stockDelta: -999 } });
    await upload(seedProductId, SVG());
    await acall("DELETE", `/api/admin/categories/${seedCategoryId}`, { user: "boss" });
    expect(await audit()).toHaveLength(0);
  });
});
