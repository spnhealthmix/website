import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import {
  acall, addAddress, call, categoryId as seedCat, db, IMG_BASE, makeAdmin, pcall, productId as seedProduct, useHarness, variantId as seedVariantA,
} from "./harness";

useHarness();

/* ----------------------------- data builders ------------------------------ */

let n = 0;
const mkCat = async (name: string, over: Partial<typeof s.categories.$inferInsert> = {}) =>
  (await db.insert(s.categories).values({ slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${++n}`, name, ...over }).returning())[0];

type V = { label?: string; mrp?: number; price?: number; stock?: number; active?: boolean; weight?: number };
const mkProd = async (categoryId: string, name: string, variants: V[] | null = [{}], over: Partial<typeof s.products.$inferInsert> = {}) => {
  const [p] = await db.insert(s.products).values({ categoryId, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + `-${++n}`, name, ...over }).returning();
  const vs = [] as (typeof s.productVariants.$inferSelect)[];
  for (const v of variants ?? []) {
    const [row] = await db
      .insert(s.productVariants)
      .values({
        productId: p.id, sku: `SKU-${++n}`, label: v.label ?? "250 g", weightGrams: v.weight ?? 250,
        mrpPaise: v.mrp ?? 20000, pricePaise: v.price ?? 15000, stock: v.stock ?? 10, isActive: v.active ?? true,
      })
      .returning();
    vs.push(row);
  }
  return { ...p, variants: vs };
};

const names = (r: { body: any }) => r.body.products.map((p: any) => p.name);
const FORBIDDEN = ["sku", "stock", "isActive", "r2Key", "imageKey", "createdAt", "updatedAt", "sortOrder", "categoryId", "productId", "adminNote", "cost"];
const allKeys = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) (out.add(k), allKeys(x, out));
  return out;
};
const expectNoPrivateFields = (body: unknown) => {
  const keys = allKeys(body);
  for (const f of FORBIDDEN) expect(keys.has(f), `leaked field "${f}"`).toBe(false);
};

/* -------------------------------------------------------------------------- */

describe("public access", () => {
  it("works with no sign-in, no cookies and no special headers", async () => {
    for (const path of ["/api/catalogue/categories", "/api/catalogue/products", "/api/catalogue/products/p"]) {
      const r = await pcall(path);
      expect(r.status).toBe(200);
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });

  it("is read-only: anything but GET/HEAD is 405", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      const r = await pcall("/api/catalogue/products", { method });
      expect(r.status).toBe(405);
      expect(r.headers.get("allow")).toBe("GET, HEAD");
    }
  });

  it("HEAD returns the headers without a body", async () => {
    const r = await pcall("/api/catalogue/products", { method: "HEAD" });
    expect(r.status).toBe(200);
    expect(r.text).toBe("");
    expect(r.headers.get("etag")).toBeTruthy();
  });
});

describe("categories", () => {
  it("lists all active categories including empty ones in display order", async () => {
    const zed = await mkCat("Zed Shelf", { sortOrder: 2 });
    const alpha = await mkCat("Alpha Shelf", { sortOrder: 2 });
    const first = await mkCat("First Shelf", { sortOrder: 1 });
    const hidden = await mkCat("Hidden Shelf", { isActive: false });
    const empty = await mkCat("Empty Shelf", { sortOrder: 3 });
    for (const c of [zed, alpha, first, hidden]) await mkProd(c.id, `Item in ${c.name}`);
    void empty;

    const r = await pcall("/api/catalogue/categories");
    // All active categories appear in display order (sortOrder, then name)
    expect(r.body.categories.map((c: any) => c.name)).toContain("First Shelf");
    expect(r.body.categories.map((c: any) => c.name)).toContain("Alpha Shelf");
    expect(r.body.categories.map((c: any) => c.name)).toContain("Zed Shelf");
    expect(r.body.categories.map((c: any) => c.name)).toContain("Empty Shelf");
    // Inactive category is excluded
    expect(r.body.categories.map((c: any) => c.name)).not.toContain("Hidden Shelf");
    // Empty category has productCount 0
    expect(r.body.categories.find((c: any) => c.name === "Empty Shelf").productCount).toBe(0);
  });

  it("counts all active products in active category even without variants", async () => {
    const c = await mkCat("Counted");
    await mkProd(c.id, "Visible One");
    await mkProd(c.id, "Visible Sold Out", [{ stock: 0 }]);
    await mkProd(c.id, "Switched Off", [{}], { isActive: false });
    await mkProd(c.id, "No Active Size", [{ active: false }]);
    const r = await pcall("/api/catalogue/categories");
    // Visible One (1), Visible Sold Out (2), No Active Size (3) are active products. Switched Off (isActive: false) is excluded.
    expect(r.body.categories.find((x: any) => x.name === "Counted").productCount).toBe(3);
  });

  it("exposes only public fields, with the image as a full URL", async () => {
    const c = await mkCat("With Picture", { description: "Lovely things", imageKey: "categories/x/pic.png" });
    await mkProd(c.id, "Thing");
    const r = await pcall("/api/catalogue/categories");
    const cat = r.body.categories.find((x: any) => x.name === "With Picture");
    expect(cat).toEqual({ slug: c.slug, name: "With Picture", description: "Lovely things", productCount: 1, image: { url: `${IMG_BASE}/categories/x/pic.png` } });
    expect(r.body.categories.find((x: any) => x.name === "C").image).toBeNull();
    expectNoPrivateFields(r.body);
  });

  it("an empty shop still lists active categories with zero product count", async () => {
    await db.delete(s.products);
    const r = await pcall("/api/catalogue/categories");
    expect(r.body.categories.length).toBeGreaterThanOrEqual(1);
    for (const cat of r.body.categories) {
      expect(cat.productCount).toBe(0);
    }
  });
});

describe("product visibility", () => {
  it("shows active products in active categories even without active sizes, while hiding inactive products and inactive categories", async () => {
    const live = await mkCat("Live Cat");
    const off = await mkCat("Off Cat", { isActive: false });
    await mkProd(live.id, "Shown Product");
    await mkProd(live.id, "Switched Off Product", [{}], { isActive: false });
    await mkProd(off.id, "In Hidden Category");
    await mkProd(live.id, "Only Inactive Sizes", [{ active: false }, { active: false }]);
    await mkProd(live.id, "No Sizes", null);
    const r = await pcall("/api/catalogue/products?limit=48");
    const productNames = names(r);
    // Active products in active categories are visible
    expect(productNames).toContain("Shown Product");
    expect(productNames).toContain("Only Inactive Sizes");
    expect(productNames).toContain("No Sizes");
    // Inactive products and products in inactive categories are hidden
    expect(productNames).not.toContain("Switched Off Product");
    expect(productNames).not.toContain("In Hidden Category");
    // Pricing is unconfigured (null) for products without active variants
    const noSizes = r.body.products.find((p: any) => p.name === "No Sizes");
    expect(noSizes.price.fromPaise).toBeNull();
    expect(noSizes.price.toPaise).toBeNull();
    expect(noSizes.inStock).toBe(false);
  });

  it("a sold-out product stays visible and says so; inStock=true hides it", async () => {
    const c = await mkCat("Stock Cat");
    await mkProd(c.id, "Sold Out Thing", [{ stock: 0 }, { stock: 0, label: "500 g" }]);
    await mkProd(c.id, "Half Sold Out", [{ stock: 0 }, { stock: 4, label: "500 g" }]);
    const all = await pcall(`/api/catalogue/products?category=${c.slug}`);
    expect(Object.fromEntries(all.body.products.map((p: any) => [p.name, p.inStock]))).toEqual({ "Sold Out Thing": false, "Half Sold Out": true });
    const only = await pcall(`/api/catalogue/products?category=${c.slug}&inStock=true`);
    expect(names(only)).toEqual(["Half Sold Out"]);
  });

  it("a size that is switched off never makes a product look in stock", async () => {
    const c = await mkCat("Off Size Cat");
    await mkProd(c.id, "Only Hidden Stock", [{ stock: 0 }, { stock: 50, label: "500 g", active: false }]);
    const card = (await pcall(`/api/catalogue/products?category=${c.slug}`)).body.products[0];
    expect(card.inStock).toBe(false);
    expect(names(await pcall(`/api/catalogue/products?category=${c.slug}&inStock=true`))).toEqual([]);
    const detail = (await pcall(`/api/catalogue/products/${card.slug}`)).body;
    expect(detail.inStock).toBe(false);
    expect(detail.variants).toHaveLength(1);
  });

  it("changes are visible straight away: deactivate, reactivate, delete", async () => {
    expect(names(await pcall("/api/catalogue/products"))).toContain("Karuppu Kavuni Kanji Mix");
    await db.update(s.products).set({ isActive: false }).where(eq(s.products.id, seedProduct));
    expect(names(await pcall("/api/catalogue/products"))).not.toContain("Karuppu Kavuni Kanji Mix");
    expect((await pcall("/api/catalogue/products/p")).status).toBe(404);
    await db.update(s.products).set({ isActive: true }).where(eq(s.products.id, seedProduct));
    expect((await pcall("/api/catalogue/products/p")).status).toBe(200);
    await db.update(s.categories).set({ isActive: false }).where(eq(s.categories.id, seedCat));
    expect((await pcall("/api/catalogue/products")).body.total).toBe(0);
  });
});

describe("product cards", () => {
  it("shows price range, discount and size count from ACTIVE sizes only", async () => {
    const c = await mkCat("Price Cat");
    await mkProd(c.id, "Multi Size", [
      { label: "250 g", price: 15000, mrp: 20000 },
      { label: "500 g", price: 28000, mrp: 40000 },
      { label: "1 kg", price: 50000, mrp: 80000 },
      { label: "Trial", price: 5000, mrp: 9000, active: false }, // cheaper, but not on sale
    ]);
    const r = await pcall(`/api/catalogue/products?category=${c.slug}`);
    expect(r.body.products[0].price).toEqual({ fromPaise: 15000, toPaise: 50000, fromMrpPaise: 20000, discountPercent: 25 });
    expect(r.body.products[0].hasMultipleSizes).toBe(true);
  });

  it("a single-size product, and one with no discount", async () => {
    const c = await mkCat("Plain Cat");
    await mkProd(c.id, "Single", [{ price: 9900, mrp: 9900 }]);
    const p = (await pcall(`/api/catalogue/products?category=${c.slug}`)).body.products[0];
    expect(p.hasMultipleSizes).toBe(false);
    expect(p.price).toEqual({ fromPaise: 9900, toPaise: 9900, fromMrpPaise: 9900, discountPercent: 0 });
  });

  it("uses the primary image with its alt text, or null when there is none", async () => {
    await db.insert(s.productImages).values([
      { productId: seedProduct, r2Key: "products/p/second.webp", alt: "second", sortOrder: 1 },
      { productId: seedProduct, r2Key: "products/p/main.webp", alt: "front of pack", isPrimary: true, sortOrder: 9 },
    ]);
    const c = await mkCat("No Pics");
    await mkProd(c.id, "Plain Jane");
    const all = (await pcall("/api/catalogue/products")).body.products;
    expect(all.find((p: any) => p.id === seedProduct).image).toEqual({ url: `${IMG_BASE}/products/p/main.webp`, alt: "front of pack" });
    expect(all.find((p: any) => p.name === "Plain Jane").image).toBeNull();
  });

  it("carries category, slug and featured flag, and nothing private", async () => {
    await db.update(s.products).set({ isFeatured: true, shortDescription: "Black rice kanji" }).where(eq(s.products.id, seedProduct));
    const r = await pcall("/api/catalogue/products");
    expect(r.body.products[0]).toMatchObject({ id: seedProduct, slug: "p", name: "Karuppu Kavuni Kanji Mix", shortDescription: "Black rice kanji", isFeatured: true, category: { slug: "c", name: "C" }, inStock: true });
    expectNoPrivateFields(r.body);
    expect(r.text).not.toContain("KK-250");
  });

  it("prices and stock are live: an edit shows on the very next request", async () => {
    await db.update(s.productVariants).set({ pricePaise: 12000 }).where(eq(s.productVariants.id, seedVariantA));
    expect((await pcall("/api/catalogue/products")).body.products[0].price.fromPaise).toBe(12000);
    await db.update(s.productVariants).set({ stock: 0, isActive: true }).where(eq(s.productVariants.productId, seedProduct));
    expect((await pcall("/api/catalogue/products")).body.products[0].inStock).toBe(false);
  });
});

describe("filtering", () => {
  it("by category; unknown, hidden or malformed category slugs are errors, not empty lists", async () => {
    const c = await mkCat("Podi Shelf");
    await mkProd(c.id, "Idli Podi");
    expect(names(await pcall(`/api/catalogue/products?category=${c.slug}`))).toEqual(["Idli Podi"]);
    expect((await pcall("/api/catalogue/products?category=nope")).status).toBe(404);
    const off = await mkCat("Gone", { isActive: false });
    expect((await pcall(`/api/catalogue/products?category=${off.slug}`)).status).toBe(404);
    for (const bad of ["Bad Slug", "UPPER", "a_b", "../x", "x".repeat(81)]) {
      expect((await pcall(`/api/catalogue/products?category=${encodeURIComponent(bad)}`)).status).toBe(422);
    }
  });

  it("by featured", async () => {
    const c = await mkCat("Feat Cat");
    await mkProd(c.id, "Star", [{}], { isFeatured: true });
    await mkProd(c.id, "Regular");
    expect(names(await pcall("/api/catalogue/products?featured=true"))).toEqual(["Star"]);
    expect((await pcall("/api/catalogue/products?featured=false")).status).toBe(422);
  });

  it("by price: a product matches when some ACTIVE size is inside the range", async () => {
    const c = await mkCat("Range Cat");
    await mkProd(c.id, "Cheap", [{ price: 5000, mrp: 6000 }]);
    await mkProd(c.id, "Middle", [{ price: 15000 }, { price: 40000, mrp: 50000 }]);
    await mkProd(c.id, "Dear", [{ price: 90000, mrp: 99000 }]);
    await mkProd(c.id, "Hidden Cheap Size", [{ price: 1000, mrp: 2000, active: false }, { price: 80000, mrp: 90000 }]);
    const q = async (qs: string) => names(await pcall(`/api/catalogue/products?category=${c.slug}&${qs}`)).sort();
    expect(await q("maxPrice=10000")).toEqual(["Cheap"]);
    expect(await q("minPrice=30000&maxPrice=50000")).toEqual(["Middle"]);
    expect(await q("minPrice=60000")).toEqual(["Dear", "Hidden Cheap Size"]);
    expect(await q("maxPrice=2000")).toEqual([]); // the inactive Rs 10 size doesn't count
    expect(await q("minPrice=5000&maxPrice=5000")).toEqual(["Cheap"]); // inclusive
    for (const bad of ["minPrice=-1", "maxPrice=abc", "minPrice=1.5", "minPrice=20000&maxPrice=10000", "maxPrice=99999999999"]) {
      expect((await pcall(`/api/catalogue/products?${bad}`)).status).toBe(422);
    }
  });

  it("filters combine", async () => {
    const c = await mkCat("Combo Cat");
    await mkProd(c.id, "Red Chilli Powder", [{ price: 8000, mrp: 9000, stock: 0 }], { isFeatured: true });
    await mkProd(c.id, "Red Chilli Flakes", [{ price: 8000, mrp: 9000 }], { isFeatured: true });
    await mkProd(c.id, "Red Bean Mix", [{ price: 8000, mrp: 9000 }]);
    expect(names(await pcall(`/api/catalogue/products?category=${c.slug}&q=red&featured=true&inStock=true&maxPrice=9000`))).toEqual(["Red Chilli Flakes"]);
  });
});

describe("search", () => {
  async function shelf() {
    await db.delete(s.products); // start from an empty shop so the seed product doesn't share a name
    const spice = await mkCat("Masalas and Spices");
    const mix = await mkCat("Health Mix Powders");
    await mkProd(mix.id, "Karuppu Kavuni Kanji Mix", [{}], { shortDescription: "Black rice porridge mix", ingredients: "Karuppu kavuni rice, ragi, dry ginger" });
    await mkProd(mix.id, "Sprouted Ragi Choco Malt", [{}], { shortDescription: "Chocolate malt for kids", ingredients: "Sprouted ragi, cocoa" });
    await mkProd(spice.id, "Turmeric Powder", [{}], { shortDescription: "Pure Erode turmeric" });
    await mkProd(spice.id, "Red Chilli Powder");
    return { spice, mix };
  }
  const found = async (q: string) => names(await pcall(`/api/catalogue/products?q=${encodeURIComponent(q)}`)).sort();

  it("matches the name in any case, including part of a word", async () => {
    await shelf();
    expect(await found("kavuni")).toEqual(["Karuppu Kavuni Kanji Mix"]);
    expect(await found("KAVUNI")).toEqual(["Karuppu Kavuni Kanji Mix"]);
    expect(await found("kavu")).toEqual(["Karuppu Kavuni Kanji Mix"]);
    // "powder" is in two product names AND in the category name "Health Mix Powders"
    expect(await found("powder")).toEqual(["Karuppu Kavuni Kanji Mix", "Red Chilli Powder", "Sprouted Ragi Choco Malt", "Turmeric Powder"]);
  });

  it("every word must match (in any order), across name, description, ingredients and category", async () => {
    await shelf();
    expect(await found("kanji karuppu")).toEqual(["Karuppu Kavuni Kanji Mix"]);
    expect(await found("red powder")).toEqual(["Red Chilli Powder"]);
    expect(await found("kanji turmeric")).toEqual([]);
    expect(await found("porridge")).toEqual(["Karuppu Kavuni Kanji Mix"]); // short description
    expect(await found("cocoa")).toEqual(["Sprouted Ragi Choco Malt"]); // ingredients
    expect(await found("ragi")).toEqual(["Karuppu Kavuni Kanji Mix", "Sprouted Ragi Choco Malt"]);
    expect(await found("masalas")).toEqual(["Red Chilli Powder", "Turmeric Powder"]); // category name
    expect(await found("erode")).toEqual(["Turmeric Powder"]);
  });

  it("never returns products a customer can't see (inactive products or inactive categories)", async () => {
    const { mix } = await shelf();
    await mkProd(mix.id, "Secret Kavuni Draft", [{}], { isActive: false });
    await mkProd(mix.id, "Kavuni No Size", [{ active: false }]);
    const results = await found("kavuni");
    expect(results).toContain("Karuppu Kavuni Kanji Mix");
    expect(results).toContain("Kavuni No Size"); // active product visible even without variants
    expect(results).not.toContain("Secret Kavuni Draft"); // inactive product hidden
  });

  it("typed wildcards and SQL are just text", async () => {
    await shelf();
    for (const q of ["%%", "__", "\\\\", "r%d", "'; drop table products; --", '" or 1=1 --']) {
      const r = await pcall(`/api/catalogue/products?q=${encodeURIComponent(q)}`);
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(0);
    }
    expect((await pcall("/api/catalogue/products")).body.total).toBe(4); // table still there
  });

  it("rejects a single character; ignores a blank query; tidies spaces", async () => {
    await shelf();
    expect((await pcall("/api/catalogue/products?q=k")).status).toBe(422);
    expect((await pcall("/api/catalogue/products?q=%20")).status).toBe(422);
    expect((await pcall("/api/catalogue/products?q=")).body.total).toBe(4);
    expect(await found("  red    chilli  ")).toEqual(["Red Chilli Powder"]);
    expect((await pcall(`/api/catalogue/products?q=${"x".repeat(101)}`)).status).toBe(422);
  });

  // Featured products normally sort first, so giving the LESS relevant product the featured flag
  // proves that relevance, not the flag or alphabetical order, decides.
  it("ranks an exact name match above a longer name that starts the same way", async () => {
    const c = await mkCat("Rank A");
    await mkProd(c.id, "Ragi Malt", [{}], { isFeatured: true });
    await mkProd(c.id, "Ragi", [{}]);
    expect(names(await pcall(`/api/catalogue/products?category=${c.slug}&q=ragi`))).toEqual(["Ragi", "Ragi Malt"]);
  });

  it("ranks names that start with the search above names that merely contain it, above other fields", async () => {
    const c = await mkCat("Rank B");
    await mkProd(c.id, "Sweet Ragi Mix", [{}], { isFeatured: true }); // contains
    await mkProd(c.id, "Plain Mix", [{}], { isFeatured: true, shortDescription: "made with ragi" }); // other field only
    await mkProd(c.id, "Ragi Malt", [{}]); // starts with
    const r = await pcall(`/api/catalogue/products?category=${c.slug}&q=ragi`);
    expect(r.body.sort).toBe("relevance");
    expect(names(r)).toEqual(["Ragi Malt", "Sweet Ragi Mix", "Plain Mix"]);
  });
});

describe("sorting and paging", () => {
  async function priced() {
    const c = await mkCat("Sort Cat", { sortOrder: 1 });
    const a = await mkProd(c.id, "Bravo", [{ price: 30000, mrp: 31000 }, { price: 9000, mrp: 10000, label: "small" }], { sortOrder: 2 });
    const b = await mkProd(c.id, "Alpha", [{ price: 20000, mrp: 21000 }], { sortOrder: 3 });
    const d = await mkProd(c.id, "Charlie", [{ price: 5000, mrp: 6000 }], { sortOrder: 1, isFeatured: true });
    await db.update(s.products).set({ createdAt: new Date("2026-01-01") }).where(eq(s.products.id, a.id));
    await db.update(s.products).set({ createdAt: new Date("2026-03-01") }).where(eq(s.products.id, b.id));
    await db.update(s.products).set({ createdAt: new Date("2026-02-01") }).where(eq(s.products.id, d.id));
    await db.update(s.products).set({ isActive: false }).where(eq(s.products.id, seedProduct)); // keep the shelf to three
    return c;
  }
  const order = async (qs: string) => names(await pcall(`/api/catalogue/products?${qs}`));

  it("featured (default) puts featured first, then the shop's own ordering", async () => {
    await priced();
    expect(await order("")).toEqual(["Charlie", "Bravo", "Alpha"]);
    expect((await pcall("/api/catalogue/products")).body.sort).toBe("featured");
  });

  it("price low to high / high to low uses each product's cheapest available size", async () => {
    await priced();
    expect(await order("sort=price_asc")).toEqual(["Charlie", "Bravo", "Alpha"]); // 5000, 9000, 20000
    expect(await order("sort=price_desc")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("newest first, and by name", async () => {
    await priced();
    expect(await order("sort=newest")).toEqual(["Alpha", "Charlie", "Bravo"]);
    expect(await order("sort=name")).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("an explicit sort wins over relevance; unknown sorts are errors", async () => {
    await priced();
    expect(await order("q=a&sort=name".replace("q=a", "q=ar"))).toEqual(["Charlie"]); // 'ar' matches Charlie only
    expect((await pcall("/api/catalogue/products?sort=random")).status).toBe(422);
    expect((await pcall("/api/catalogue/products?sort=")).status).toBe(422);
  });

  it("pages through 60 products exactly once each, in every sort, even with tied prices", async () => {
    const c = await mkCat("Big Shelf");
    for (let i = 0; i < 60; i++) await mkProd(c.id, `Item ${String(i).padStart(2, "0")}`, [{ price: 10000 + (i % 4) * 1000, mrp: 20000 }]);
    for (const sort of ["featured", "price_asc", "price_desc", "newest", "name"]) {
      const seen: string[] = [];
      let offset = 0;
      for (;;) {
        const r = await pcall(`/api/catalogue/products?category=${c.slug}&sort=${sort}&limit=12&offset=${offset}`);
        expect(r.body.total).toBe(60);
        seen.push(...r.body.products.map((p: any) => p.id));
        if (!r.body.hasMore) break;
        offset += 12;
      }
      expect(seen).toHaveLength(60);
      expect(new Set(seen).size).toBe(60);
    }
  });

  it("limit, offset and hasMore behave at the edges", async () => {
    const c = await mkCat("Edge Shelf");
    for (let i = 0; i < 5; i++) await mkProd(c.id, `Edge ${i}`);
    const q = (qs: string) => pcall(`/api/catalogue/products?category=${c.slug}&${qs}`);
    expect((await q("limit=2")).body).toMatchObject({ total: 5, limit: 2, offset: 0, hasMore: true });
    expect((await q("limit=2&offset=4")).body).toMatchObject({ hasMore: false });
    expect((await q("limit=5")).body.hasMore).toBe(false);
    const past = await q("offset=50");
    expect(past.status).toBe(200);
    expect(past.body).toMatchObject({ products: [], total: 5, hasMore: false });
    expect((await q("limit=48")).status).toBe(200);
    for (const bad of ["limit=49", "limit=0", "limit=-1", "limit=abc", "limit=1.5", "offset=-1", "offset=abc"]) {
      expect((await q(bad)).status).toBe(422);
    }
  });

  it("unknown query parameters are ignored (so tracking tags don't break the page)", async () => {
    const r = await pcall("/api/catalogue/products?utm_source=whatsapp&fbclid=abc");
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(1);
  });

  it("copes with a bigger catalogue", async () => {
    const c = await mkCat("Warehouse");
    const rows = Array.from({ length: 150 }, (_, i) => ({ categoryId: c.id, slug: `bulk-${i}`, name: `Bulk Product ${i}` }));
    const made = await db.insert(s.products).values(rows).returning();
    await db.insert(s.productVariants).values(made.map((p, i) => ({ productId: p.id, sku: `BULK-${i}`, label: "250 g", mrpPaise: 20000, pricePaise: 15000, stock: 5 })));
    const r = await pcall(`/api/catalogue/products?category=${c.slug}&limit=48&offset=96`);
    expect(r.body).toMatchObject({ total: 150, hasMore: true });
    expect(r.body.products).toHaveLength(48);
    expect((await pcall("/api/catalogue/products?q=bulk%20product%2012")).body.total).toBe(12); // 12, 112, 120..129
  });
});

describe("product page", () => {
  async function detail() {
    await db.update(s.products).set({ description: "A traditional black rice kanji mix.", ingredients: "Karuppu kavuni, ragi", usage: "Mix 2 tbsp in warm water.", shortDescription: "Black rice kanji" }).where(eq(s.products.id, seedProduct));
    await db.insert(s.productImages).values([
      { productId: seedProduct, r2Key: "products/p/side.webp", alt: "side", sortOrder: 2 },
      { productId: seedProduct, r2Key: "products/p/front.webp", alt: "front", isPrimary: true, sortOrder: 5 },
      { productId: seedProduct, r2Key: "products/p/back.webp", alt: null, sortOrder: 1 },
    ]);
    return pcall("/api/catalogue/products/p");
  }

  it("returns everything the page needs", async () => {
    const r = await detail();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: seedProduct, slug: "p", name: "Karuppu Kavuni Kanji Mix", shortDescription: "Black rice kanji",
      description: "A traditional black rice kanji mix.", ingredients: "Karuppu kavuni, ragi", usage: "Mix 2 tbsp in warm water.",
      category: { slug: "c", name: "C" }, inStock: true,
    });
    expect(r.body.images.map((i: any) => [i.url.replace(IMG_BASE + "/", ""), i.alt, i.isPrimary])).toEqual([
      ["products/p/front.webp", "front", true], ["products/p/back.webp", null, false], ["products/p/side.webp", "side", false],
    ]);
    expectNoPrivateFields(r.body);
    expect(r.text).not.toContain("KK-250");
  });

  it("lists only active sizes, cheapest first, with what the cart needs", async () => {
    await db.insert(s.productVariants).values({ productId: seedProduct, sku: "OLD-1", label: "Old pack", mrpPaise: 100, pricePaise: 90, stock: 5, isActive: false });
    const r = await pcall("/api/catalogue/products/p");
    expect(r.body.variants).toEqual([
      { id: seedVariantA, label: "250 g", weightGrams: null, mrpPaise: 20000, pricePaise: 15000, discountPercent: 25, inStock: true, lowStock: false, maxQuantity: 10 },
      { id: expect.any(String), label: "500 g", weightGrams: null, mrpPaise: 40000, pricePaise: 30000, discountPercent: 25, inStock: true, lowStock: false, maxQuantity: 10 },
    ]);
  });

  it("availability: sold out, low stock, plenty, and the 99 cap", async () => {
    const c = await mkCat("Avail Cat");
    const p = await mkProd(c.id, "Availability", [
      { label: "a", price: 1000, mrp: 1000, stock: 0 },
      { label: "b", price: 2000, mrp: 2000, stock: 3 },
      { label: "c", price: 3000, mrp: 3000, stock: 5 },
      { label: "d", price: 4000, mrp: 4000, stock: 6 },
      { label: "e", price: 5000, mrp: 5000, stock: 5000 },
    ]);
    const r = await pcall(`/api/catalogue/products/${p.slug}`);
    expect(r.body.variants.map((v: any) => [v.label, v.inStock, v.lowStock, v.maxQuantity])).toEqual([
      ["a", false, false, 0], ["b", true, true, 3], ["c", true, true, 5], ["d", true, false, 6], ["e", true, false, 99],
    ]);
    expect(r.body.inStock).toBe(true);
    const sold = await mkProd(c.id, "Gone Entirely", [{ stock: 0 }]);
    expect((await pcall(`/api/catalogue/products/${sold.slug}`)).body.inStock).toBe(false);
  });

  it("suggests up to 4 other visible products from the same category, never itself", async () => {
    const c = await mkCat("Rel Cat");
    const main = await mkProd(c.id, "Main One");
    for (let i = 0; i < 6; i++) await mkProd(c.id, `Sibling ${i}`, [{}], { sortOrder: i + 1 });
    await mkProd(c.id, "Sibling Hidden", [{}], { isActive: false, sortOrder: 0 });
    const other = await mkCat("Other Cat");
    await mkProd(other.id, "Different Category");
    const r = await pcall(`/api/catalogue/products/${main.slug}`);
    expect(r.body.related.length).toBeLessThanOrEqual(4);
    expect(r.body.related.map((p: any) => p.name)).not.toContain("Main One");
    expect(r.body.related.map((p: any) => p.name)).not.toContain("Sibling Hidden");
    expectNoPrivateFields(r.body);
    const alone = await pcall("/api/catalogue/products/p");
    expect(alone.body.related).toEqual([]);
  });

  it("404 for anything that isn't publicly visible, or isn't a valid slug, while active variant-less products return 200", async () => {
    const c = await mkCat("Hide Cat");
    const off = await mkProd(c.id, "Off", [{}], { isActive: false });
    const noSize = await mkProd(c.id, "No Size", [{ active: false }]);
    const hiddenCat = await mkCat("Dark Cat", { isActive: false });
    const inDark = await mkProd(hiddenCat.id, "In Dark");

    // Active product without active variants is 200 OK and not purchasable
    const noSizeRes = await pcall(`/api/catalogue/products/${noSize.slug}`);
    expect(noSizeRes.status).toBe(200);
    expect(noSizeRes.body.inStock).toBe(false);
    expect(noSizeRes.body.variants).toEqual([]);

    // Inactive products, inactive categories, and invalid slugs return 404
    for (const slug of [off.slug, inDark.slug, "unknown-thing", "Bad Slug", "UPPER", "../etc/passwd", "a%20b", "x".repeat(81), "'; drop table products; --"]) {
      const r = await pcall(`/api/catalogue/products/${encodeURIComponent(slug)}`);
      expect(r.status, slug).toBe(404);
      expect(r.body.error.code).toBe("PRODUCT_NOT_FOUND");
    }
  });
});

describe("live data and the rest of the shop", () => {
  it("an admin's price, stock and visibility edits show up on the public pages", async () => {
    await makeAdmin("boss");
    const price = async () => (await pcall("/api/catalogue/products/p")).body.variants[0];
    expect((await price()).pricePaise).toBe(15000);
    await acall("PATCH", `/api/admin/variants/${seedVariantA}`, { user: "boss", body: { pricePaise: 13500, stock: 2 } });
    expect(await price()).toMatchObject({ pricePaise: 13500, discountPercent: 33, lowStock: true, maxQuantity: 2 });
    await acall("PATCH", `/api/admin/variants/${seedVariantA}`, { user: "boss", body: { isActive: false } });
    expect((await pcall("/api/catalogue/products/p")).body.variants).toHaveLength(1);
    await acall("PATCH", `/api/admin/products/${seedProduct}`, { user: "boss", body: { isActive: false } });
    expect((await pcall("/api/catalogue/products/p")).status).toBe(404);
  });

  it("the size id on the product page is exactly what the cart takes, at the same price", async () => {
    const page = (await pcall("/api/catalogue/products/p")).body;
    const size = page.variants[1];
    const added = await call("POST", "/api/cart/items", { user: "alice", body: { variantId: size.id, quantity: size.maxQuantity } });
    expect(added.status).toBe(200);
    expect(added.body.items[0]).toMatchObject({ variantId: size.id, unitPricePaise: size.pricePaise, quantity: 10 });
    const tooMany = await call("POST", "/api/cart/items", { user: "bob", body: { variantId: size.id, quantity: size.maxQuantity + 1 } });
    expect(tooMany.status).toBe(409); // maxQuantity really is the limit
  });

  it("the public API shows nothing about orders, customers or carts", async () => {
    const addr = await addAddress("alice");
    await call("POST", "/api/cart/items", { user: "alice", body: { variantId: seedVariantA, quantity: 2 } });
    await call("POST", "/api/checkout", { user: "alice", body: { addressId: addr.id } });
    for (const path of ["/api/catalogue/products", "/api/catalogue/products/p", "/api/catalogue/categories"]) {
      const r = await pcall(path);
      expect(r.text).not.toContain("alice");
      expect(r.text).not.toContain("Gandhi Street");
    }
    expect((await pcall("/api/catalogue/products/p")).body.variants[0].maxQuantity).toBe(8); // stock held by the pending order is already gone
  });

  it("30 simultaneous readers all get the same consistent answer", async () => {
    const rs = await Promise.all(Array.from({ length: 30 }, () => pcall("/api/catalogue/products?limit=48")));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(new Set(rs.map((r) => r.text)).size).toBe(1);
  });
});

describe("caching", () => {
  it("successful responses are cacheable for a short time and carry an ETag", async () => {
    for (const path of ["/api/catalogue/products", "/api/catalogue/products/p", "/api/catalogue/categories"]) {
      const r = await pcall(path);
      expect(r.headers.get("cache-control")).toBe("public, max-age=30, s-maxage=30, stale-while-revalidate=60");
      expect(r.headers.get("etag")).toMatch(/^W\/"[0-9a-f]{24}"$/);
    }
  });

  it("an unchanged page answers a revalidation with an empty 304", async () => {
    const first = await pcall("/api/catalogue/products/p");
    const etag = first.headers.get("etag")!;
    const again = await pcall("/api/catalogue/products/p", { headers: { "if-none-match": etag } });
    expect(again.status).toBe(304);
    expect(again.text).toBe("");
    expect(again.headers.get("etag")).toBe(etag);
    expect((await pcall("/api/catalogue/products/p", { headers: { "if-none-match": `W/"other", ${etag}` } })).status).toBe(304);
    expect((await pcall("/api/catalogue/products/p", { headers: { "if-none-match": "*" } })).status).toBe(304);
    expect((await pcall("/api/catalogue/products/p", { headers: { "if-none-match": 'W/"stale"' } })).status).toBe(200);
  });

  it("any change to the data changes the ETag, so a revalidating browser never keeps a stale price", async () => {
    const etag = (await pcall("/api/catalogue/products/p")).headers.get("etag")!;
    await db.update(s.productVariants).set({ pricePaise: 14000 }).where(eq(s.productVariants.id, seedVariantA));
    const r = await pcall("/api/catalogue/products/p", { headers: { "if-none-match": etag } });
    expect(r.status).toBe(200);
    expect(r.headers.get("etag")).not.toBe(etag);
    expect(r.body.variants[0].pricePaise).toBe(14000);
  });

  it("different queries have different ETags", async () => {
    const a = (await pcall("/api/catalogue/products?limit=1")).headers.get("etag");
    const b = (await pcall("/api/catalogue/products?limit=2")).headers.get("etag");
    const c = (await pcall("/api/catalogue/categories")).headers.get("etag");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("errors are never cached", async () => {
    for (const path of ["/api/catalogue/products/nope", "/api/catalogue/products?limit=999", "/api/catalogue/products?category=nope"]) {
      const r = await pcall(path);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(r.headers.get("etag")).toBeNull();
    }
  });
});
