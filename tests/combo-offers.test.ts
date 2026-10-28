import { describe, expect, it, vi } from "vitest";
import { FALLBACK_COMBO_DATA } from "../src/lib/storefront/api";
import { computeCartSummary, toLineView } from "../src/lib/cart/cart";
import { cartAddSchema } from "../src/lib/customers/validation";

describe("Combo Offers - Product Catalog & Variant Verification", () => {
  it("contains all 4 promotional offers with verified IDs and attributes", () => {
    const slugs = Object.keys(FALLBACK_COMBO_DATA);
    expect(slugs).toEqual([
      "family-combo-offer",
      "sweet-laddus-combo",
      "spicy-podi-varieties-combo",
      "nendram-banana-chips",
    ]);
  });

  it("verifies Family Combo Offer details and pricing", () => {
    const familyCombo = FALLBACK_COMBO_DATA["family-combo-offer"];
    expect(familyCombo.id).toBe("6ea90443-e162-4567-b952-b2b47059f130");
    expect(familyCombo.name).toBe("Family Combo Offer");
    expect(familyCombo.variants).toHaveLength(1);

    const variant = familyCombo.variants[0];
    expect(variant.id).toBe("4c4eaa02-c941-4766-b187-dafd4568481e");
    expect(variant.sku).toBe("family-combo-12in1");
    expect(variant.pricePaise).toBe(99900); // ₹999
    expect(variant.mrpPaise).toBe(159900); // ₹1,599
    expect(variant.mrpPaise - variant.pricePaise).toBe(60000); // Save ₹600
    expect(variant.inStock).toBe(true);
  });

  it("verifies Sweet Laddus Combo details and pricing", () => {
    const sweetLaddus = FALLBACK_COMBO_DATA["sweet-laddus-combo"];
    expect(sweetLaddus.id).toBe("9cbb8e71-076f-4485-a3f0-27038ea05b2c");
    expect(sweetLaddus.name).toContain("Sweet Laddu");
    expect(sweetLaddus.variants).toHaveLength(1);

    const variant = sweetLaddus.variants[0];
    expect(variant.id).toBe("21c367bb-f839-4959-882e-1154b4a50181");
    expect(variant.sku).toBe("sweet-laddus-combo-1kg");
    expect(variant.pricePaise).toBe(49900); // ₹499
    expect(variant.mrpPaise).toBe(69900); // ₹699
    expect(variant.mrpPaise - variant.pricePaise).toBe(20000); // Save ₹200
  });

  it("verifies Spicy Podi Varieties Combo details and pricing", () => {
    const spicyPodi = FALLBACK_COMBO_DATA["spicy-podi-varieties-combo"];
    expect(spicyPodi.id).toBe("8a093489-a248-48cb-bb42-b80e82de96a1");
    expect(spicyPodi.name).toContain("Spicy Podi Varieties Combo");
    expect(spicyPodi.variants).toHaveLength(1);

    const variant = spicyPodi.variants[0];
    expect(variant.id).toBe("7dbf413a-cc17-495e-8744-f25c1ca03f71");
    expect(variant.sku).toBe("spicy-podi-combo-300g");
    expect(variant.pricePaise).toBe(34900); // ₹349
    expect(variant.mrpPaise).toBe(39900); // ₹399
    expect(variant.mrpPaise - variant.pricePaise).toBe(5000); // Save ₹50
  });

  it("verifies Nendram Banana Chips has 3 distinct pack sizes with accurate pricing", () => {
    const bananaChips = FALLBACK_COMBO_DATA["nendram-banana-chips"];
    expect(bananaChips.id).toBe("f5cb83cd-fadf-46b6-8c6b-9c6337e928f0");
    expect(bananaChips.variants).toHaveLength(3);

    const [v250, v500, v1kg] = bananaChips.variants;

    expect(v250.id).toBe("7edae54e-302f-4069-9d9a-bb782d2a5651");
    expect(v250.label).toBe("250 g");
    expect(v250.pricePaise).toBe(11900); // ₹119

    expect(v500.id).toBe("3c1c395a-bc06-4890-bc96-2ceb8de8436d");
    expect(v500.label).toBe("500 g");
    expect(v500.pricePaise).toBe(21900); // ₹219

    expect(v1kg.id).toBe("27f23ede-24a1-4bab-8c42-6b1b977e98af");
    expect(v1kg.label).toBe("1 kg");
    expect(v1kg.pricePaise).toBe(42900); // ₹429
  });

  it("ensures all variant IDs and SKUs across combos are unique", () => {
    const allVariants = Object.values(FALLBACK_COMBO_DATA).flatMap((c) => c.variants);
    const variantIds = allVariants.map((v) => v.id);
    const skus = allVariants.map((v) => v.sku);

    expect(new Set(variantIds).size).toBe(variantIds.length);
    expect(new Set(skus).size).toBe(skus.length);
  });
});

describe("Combo Offers - Cart & Checkout Summary Integration", () => {
  it("converts combo offer into a valid CartLineView with zero issues", () => {
    const familyCombo = FALLBACK_COMBO_DATA["family-combo-offer"];
    const variant = familyCombo.variants[0];

    const line = toLineView({
      variantId: variant.id,
      quantity: 2,
      sku: variant.sku,
      variantLabel: variant.label,
      pricePaise: variant.pricePaise,
      mrpPaise: variant.mrpPaise,
      stock: variant.stock,
      variantActive: true,
      productId: familyCombo.id,
      productName: familyCombo.name,
      productSlug: familyCombo.slug,
      productActive: true,
      imageKey: "hero1.jpeg",
    });

    expect(line.issue).toBeNull();
    expect(line.unitPricePaise).toBe(99900);
    expect(line.mrpPaise).toBe(159900);
    expect(line.lineTotalPaise).toBe(199800); // 2 * 99900
    expect(line.availableQuantity).toBe(variant.stock);
  });

  it("calculates accurate subtotal and savings when multiple combos are added", () => {
    const familyCombo = FALLBACK_COMBO_DATA["family-combo-offer"];
    const sweetLaddus = FALLBACK_COMBO_DATA["sweet-laddus-combo"];
    const chips500 = FALLBACK_COMBO_DATA["nendram-banana-chips"].variants[1];

    const line1 = toLineView({
      variantId: familyCombo.variants[0].id,
      quantity: 1,
      sku: familyCombo.variants[0].sku,
      variantLabel: familyCombo.variants[0].label,
      pricePaise: familyCombo.variants[0].pricePaise,
      mrpPaise: familyCombo.variants[0].mrpPaise,
      stock: 50,
      variantActive: true,
      productId: familyCombo.id,
      productName: familyCombo.name,
      productSlug: familyCombo.slug,
      productActive: true,
      imageKey: null,
    });

    const line2 = toLineView({
      variantId: sweetLaddus.variants[0].id,
      quantity: 1,
      sku: sweetLaddus.variants[0].sku,
      variantLabel: sweetLaddus.variants[0].label,
      pricePaise: sweetLaddus.variants[0].pricePaise,
      mrpPaise: sweetLaddus.variants[0].mrpPaise,
      stock: 50,
      variantActive: true,
      productId: sweetLaddus.id,
      productName: sweetLaddus.name,
      productSlug: sweetLaddus.slug,
      productActive: true,
      imageKey: null,
    });

    const line3 = toLineView({
      variantId: chips500.id,
      quantity: 2,
      sku: chips500.sku,
      variantLabel: chips500.label,
      pricePaise: chips500.pricePaise,
      mrpPaise: chips500.mrpPaise,
      stock: 100,
      variantActive: true,
      productId: FALLBACK_COMBO_DATA["nendram-banana-chips"].id,
      productName: "Nendram Banana Chips",
      productSlug: "nendram-banana-chips",
      productActive: true,
      imageKey: null,
    });

    const summary = computeCartSummary([line1, line2, line3]);

    // Subtotal = 99900 + 49900 + (2 * 21900) = 99900 + 49900 + 43800 = 193600 (₹1,936)
    expect(summary.subtotalPaise).toBe(193600);
    // Savings = (159900 - 99900) + (69900 - 49900) + 0 = 60000 + 20000 = 80000 (₹800)
    expect(summary.savingsPaise).toBe(80000);
    expect(summary.totalQuantity).toBe(4);
    expect(summary.lineCount).toBe(3);
    expect(summary.canCheckout).toBe(true);
    expect(summary.hasIssues).toBe(false);
  });

  it("flags OUT_OF_STOCK and disables checkout when combo item has 0 stock", () => {
    const podiCombo = FALLBACK_COMBO_DATA["spicy-podi-varieties-combo"];
    const line = toLineView({
      variantId: podiCombo.variants[0].id,
      quantity: 1,
      sku: podiCombo.variants[0].sku,
      variantLabel: podiCombo.variants[0].label,
      pricePaise: podiCombo.variants[0].pricePaise,
      mrpPaise: podiCombo.variants[0].mrpPaise,
      stock: 0, // out of stock
      variantActive: true,
      productId: podiCombo.id,
      productName: podiCombo.name,
      productSlug: podiCombo.slug,
      productActive: true,
      imageKey: null,
    });

    expect(line.issue).toBe("OUT_OF_STOCK");
    const summary = computeCartSummary([line]);
    expect(summary.canCheckout).toBe(false);
    expect(summary.hasIssues).toBe(true);
  });
});

describe("Combo Offers - Add to Cart Mutation & Origin Validation", () => {
  const allowedOrigins = ["https://www.spnhealthmix.com"];

  it("verifies that all combo variants match valid UUIDs accepted by cartAddSchema", () => {
    const allVariants = Object.values(FALLBACK_COMBO_DATA).flatMap((c) => c.variants);

    for (const v of allVariants) {
      const parsed = cartAddSchema.safeParse({ variantId: v.id, quantity: 1 });
      expect(parsed.success).toBe(true);
    }
  });

  it("allows Add to Cart from local development origin (http://localhost:3000)", async () => {
    const { postCartItem } = await import("../src/lib/api/customer-api");
    const req = new Request("http://localhost:3000/api/cart/items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        variantId: FALLBACK_COMBO_DATA["family-combo-offer"].variants[0].id,
        quantity: 1,
      }),
    });

    const mockDeps: any = {
      withDb: vi.fn(async () => {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
      authenticate: vi.fn(async () => null),
      allowedOrigins,
    };

    const res = await postCartItem(req, mockDeps);
    // Should NOT be 403 Forbidden
    expect(res.status).not.toBe(403);
    expect(mockDeps.withDb).toHaveBeenCalled();
  });

  it("strictly rejects Add to Cart from untrusted origin (https://evil.com) with 403 FORBIDDEN_ORIGIN", async () => {
    const { postCartItem } = await import("../src/lib/api/customer-api");
    const req = new Request("http://localhost:3000/api/cart/items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.com",
      },
      body: JSON.stringify({
        variantId: FALLBACK_COMBO_DATA["family-combo-offer"].variants[0].id,
        quantity: 1,
      }),
    });

    const mockDeps: any = {
      withDb: vi.fn(),
      authenticate: vi.fn(),
      allowedOrigins,
    };

    const res = await postCartItem(req, mockDeps);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(mockDeps.withDb).not.toHaveBeenCalled();
  });
});


