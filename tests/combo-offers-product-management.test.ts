import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  comboOfferCreateSchema,
  comboOfferUpdateSchema,
  destinationUrlSchema,
  imageUrlSchema,
} from "../src/lib/combo-offers/validation";
import {
  createComboOffer,
  updateComboOffer,
  deleteComboOffer,
  getComboOffer,
  getComboOfferBySlug,
  listComboOffers,
  getActiveComboOffers,
  calculateSavingsAndDiscount,
} from "../src/lib/combo-offers/service";
import {
  FALLBACK_COMBO_DATA,
  fetchComboOffersData,
  fetchComboOfferBySlug,
  type StorefrontComboOffer,
} from "../src/lib/storefront/api";
import { ComboOffersView } from "../src/components/offers/combo-offers-view";
import { ComboOfferDetailView } from "../src/components/offers/combo-offer-detail-view";

// Mock the cart context for React rendering tests
vi.mock("@/context/cart-context", () => ({
  useCart: () => ({
    cart: { items: [] },
    addItem: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    isVariantMutating: () => false,
  }),
}));

describe("Product-Like Combo Offers Management - Comprehensive Suite", () => {
  describe("1. Schema & Validation Rules", () => {
    it("validates complete product-like combo offer payload", () => {
      const input = {
        name: "Festival Sweet Laddu Combo",
        slug: "festival-sweet-laddu-combo",
        shortDescription: "Box of 4 traditionally rolled sweet laddus",
        description: "Full description of nutritious handcrafted laddus",
        offerBadge: "Festive Pack",
        packageLabel: "4 Packs (1 kg total)",
        desktopImageUrl: "https://r2.dev/combo/desktop.jpg",
        mobileImageUrl: "https://r2.dev/combo/mobile.jpg",
        imageUrl: "https://r2.dev/combo/main.jpg",
        destinationUrl: "/combo-offers/festival-sweet-laddu-combo",
        pricePaise: 49900,
        mrpPaise: 69900,
        stock: 50,
        allowAddToCart: true,
        packageHighlights: [
          "Zero Refined Sugar",
          "Pure Cow Ghee",
          "Freshly Rolled Daily",
        ],
        includedItems: [
          { itemTitle: "Kadalai Urundai", quantity: 1, unit: "250 g", sortOrder: 0 },
          { itemTitle: "Ellu Urundai", quantity: 1, unit: "250 g", sortOrder: 1 },
          { itemTitle: "Rava Laddu", quantity: 1, unit: "250 g", sortOrder: 2 },
          { itemTitle: "Karuppu Kavuni Laddu", quantity: 1, unit: "250 g", sortOrder: 3 },
        ],
      };

      const parsed = comboOfferCreateSchema.parse(input);
      expect(parsed.name).toBe("Festival Sweet Laddu Combo");
      expect(parsed.slug).toBe("festival-sweet-laddu-combo");
      expect(parsed.offerBadge).toBe("Festive Pack");
      expect(parsed.packageLabel).toBe("4 Packs (1 kg total)");
      expect(parsed.pricePaise).toBe(49900);
      expect(parsed.mrpPaise).toBe(69900);
      expect(parsed.stock).toBe(50);
      expect(parsed.allowAddToCart).toBe(true);
      expect(parsed.packageHighlights).toHaveLength(3);
      expect(parsed.includedItems).toHaveLength(4);
      expect(parsed.includedItems[0].itemTitle).toBe("Kadalai Urundai");
      expect(parsed.includedItems[0].unit).toBe("250 g");
    });

    it("rejects when selling price is higher than MRP", () => {
      expect(() =>
        comboOfferCreateSchema.parse({
          name: "Invalid Pricing Combo",
          desktopImageUrl: "/d.jpg",
          mobileImageUrl: "/m.jpg",
          pricePaise: 99900,
          mrpPaise: 79900, // MRP is less than selling price
        }),
      ).toThrow("Selling price cannot exceed the original price / MRP.");

      expect(() =>
        comboOfferUpdateSchema.parse({
          pricePaise: 120000,
          mrpPaise: 99900,
        }),
      ).toThrow("Selling price cannot exceed the original price / MRP.");
    });

    it("accepts selling price equal to MRP (0% discount)", () => {
      const parsed = comboOfferCreateSchema.parse({
        name: "Regular Price Combo",
        desktopImageUrl: "/d.jpg",
        mobileImageUrl: "/m.jpg",
        pricePaise: 50000,
        mrpPaise: 50000,
      });
      expect(parsed.pricePaise).toBe(50000);
      expect(parsed.mrpPaise).toBe(50000);
    });

    it("accepts null/undefined MRP when no original price is advertised", () => {
      const parsed = comboOfferCreateSchema.parse({
        name: "Flat Price Combo",
        desktopImageUrl: "/d.jpg",
        mobileImageUrl: "/m.jpg",
        pricePaise: 35000,
      });
      expect(parsed.pricePaise).toBe(35000);
      expect(parsed.mrpPaise ?? null).toBeNull();
    });

    it("calculates accurate savings and discount percentage", () => {
      // 999 vs 1599 = 600 savings, 38% discount
      const res1 = calculateSavingsAndDiscount(99900, 159900);
      expect(res1.savingsPaise).toBe(60000);
      expect(res1.discountPercentage).toBe(38);

      // 499 vs 699 = 200 savings, 29% discount
      const res2 = calculateSavingsAndDiscount(49900, 69900);
      expect(res2.savingsPaise).toBe(20000);
      expect(res2.discountPercentage).toBe(29);

      // No MRP or MRP <= price
      const res3 = calculateSavingsAndDiscount(50000, null);
      expect(res3.savingsPaise).toBe(0);
      expect(res3.discountPercentage).toBe(0);
    });
  });

  describe("2. Database Service Operations", () => {
    let mockStore: any[];
    let mockItemsStore: any[];
    let auditLogs: any[];

    const createMockDb = () => {
      const makeQuery = (data: any[]) => {
        const p: any = Promise.resolve(data);
        p.orderBy = () => {
          const sorted = [...data];
          sorted.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          return makeQuery(sorted);
        };
        p.limit = (n: number) => makeQuery(data.slice(0, n));
        p.where = () => makeQuery(data);
        return p;
      };

      const db: any = {
        transaction: (fn: any) => fn(db),
        select: () => ({
          from: () => makeQuery([...mockStore]),
        }),
        insert: () => ({
          values: (data: any) => {
            if (data.action) {
              auditLogs.push(data);
              return Promise.resolve();
            }
            if (data.itemTitle) {
              mockItemsStore.push(data);
              return {
                returning: () => Promise.resolve([data]),
              };
            }
            const row = {
              id: `combo-${mockStore.length + 1}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            };
            mockStore.push(row);
            return {
              returning: () => Promise.resolve([row]),
              onConflictDoUpdate: () => ({
                returning: () => Promise.resolve([row]),
              }),
            };
          },
        }),
        update: () => ({
          set: (data: any) => ({
            where: () => {
              const target = mockStore[0] || {};
              Object.assign(target, data, { updatedAt: new Date() });
              return {
                returning: () => Promise.resolve([target]),
              };
            },
          }),
        }),
        delete: () => ({
          where: () => {
            mockStore = [];
            mockItemsStore = [];
            return Promise.resolve();
          },
        }),
      };
      return db;
    };

    beforeEach(() => {
      mockStore = [];
      mockItemsStore = [];
      auditLogs = [];
    });

    it("creates full combo offer with included products and calculates savings", async () => {
      const db = createMockDb();
      const offer = await createComboOffer(db as any, "admin-1", {
        name: "Family Combo Pack",
        slug: "family-combo-pack",
        pricePaise: 99900,
        mrpPaise: 159900,
        offerBadge: "Super Saver",
        packageLabel: "12 Items Pack",
        desktopImageUrl: "/d.jpg",
        mobileImageUrl: "/m.jpg",
        packageHighlights: ["Native Ingredients"],
        includedItems: [
          { itemTitle: "Sirudhaniya Sathu Maavu", quantity: 1, unit: "250 g", sortOrder: 0 },
          { itemTitle: "Sprouted Ragi Malt", quantity: 1, unit: "100 g", sortOrder: 1 },
        ],
      });

      expect(offer.name).toBe("Family Combo Pack");
      expect(offer.slug).toBe("family-combo-pack");
      expect(offer.savingsPaise).toBe(60000);
      expect(offer.discountPercentage).toBe(38);
      expect(offer.items).toHaveLength(2);
      expect(offer.items[0].itemTitle).toBe("Sirudhaniya Sathu Maavu");
    });
  });

  describe("3. Storefront API & Fallback Data", () => {
    it("returns all 4 canonical combo offers in fetchComboOffersData", async () => {
      const data = await fetchComboOffersData();
      expect(data).toBeDefined();

      // Check Family Combo Offer
      const family = data["family-combo-offer"];
      expect(family).toBeDefined();
      expect(family.name).toBe("Family Combo Offer");
      expect(family.offerBadge).toBe("Super Saver");
      expect(family.packageLabel).toBe("12-in-1 Pack (4.3 kg total)");
      expect(family.pricePaise).toBe(99900);
      expect(family.mrpPaise).toBe(159900);
      expect(family.savingsPaise).toBe(60000);
      expect(family.items).toHaveLength(12);

      // Check Sweet Laddus Combo
      const sweet = data["sweet-laddus-combo"];
      expect(sweet).toBeDefined();
      expect(sweet.name).toBe("Fast Moving Sweet Laddu's Combo");
      expect(sweet.pricePaise).toBe(49900);
      expect(sweet.items).toHaveLength(4);

      // Check Spicy Podi Combo
      const podi = data["spicy-podi-varieties-combo"];
      expect(podi).toBeDefined();
      expect(podi.name).toBe("Spicy Podi Varieties Combo");
      expect(podi.pricePaise).toBe(34900);
      expect(podi.items).toHaveLength(6);

      // Check Banana Chips
      const chips = data["nendram-banana-chips"];
      expect(chips).toBeDefined();
      expect(chips.name).toBe("Kerala Nendram Banana Chips");
      expect(chips.variants).toHaveLength(3); // 250g, 500g, 1kg
    });

    it("fetches single combo offer by slug with full details", async () => {
      const offer = await fetchComboOfferBySlug("family-combo-offer");
      expect(offer).not.toBeNull();
      expect(offer!.slug).toBe("family-combo-offer");
      expect(offer!.name).toBe("Family Combo Offer");
      expect(offer!.pricePaise).toBe(99900);
      expect(offer!.mrpPaise).toBe(159900);
      expect(offer!.items).toHaveLength(12);
      expect(offer!.items![0].itemTitle).toBe("Sirudhaniya Sathu Maavu");
      expect(offer!.items![0].unit).toBe("250 g");
    });

    it("returns null for non-existent combo slug", async () => {
      const missing = await fetchComboOfferBySlug("unknown-non-existent-combo");
      expect(missing).toBeNull();
    });
  });

  describe("4. Storefront UI Component Rendering", () => {
    it("renders ComboOffersView with all 4 offers, badges, pricing, and view details links", () => {
      const html = renderToStaticMarkup(
        React.createElement(ComboOffersView, { comboData: FALLBACK_COMBO_DATA }),
      );

      // Verify headings and badge tags
      expect(html).toContain("Exclusive Combo Offers");
      expect(html).toContain("Family Combo Offer");
      expect(html).toContain("Super Saver");
      expect(html).toContain("12-in-1 Pack");

      // Verify Sweet Laddus Combo
      expect(html).toContain("Fast Moving Sweet Laddu&#x27;s Combo");
      expect(html).toContain("Festive Pack");

      // Verify Spicy Podi Combo
      expect(html).toContain("Spicy Podi Varieties Combo");
      expect(html).toContain("Diwali Special");

      // Verify Kerala Banana Chips
      expect(html).toContain("Kerala Nendram Banana Chips");
      expect(html).toContain("Crispy &amp; Fresh");

      // Verify View Details links to /combo-offers/[slug]
      expect(html).toContain('href="/combo-offers/family-combo-offer"');
      expect(html).toContain('href="/combo-offers/sweet-laddus-combo"');
      expect(html).toContain('href="/combo-offers/spicy-podi-varieties-combo"');
      expect(html).toContain('href="/combo-offers/nendram-banana-chips"');
      expect(html).toContain("View Full Offer Details");

      // Verify Add to Cart buttons
      expect(html).toContain("Add to Cart");
    });

    it("renders ComboOfferDetailView with full product specifications, highlights, and included products", () => {
      const familyOffer = FALLBACK_COMBO_DATA["family-combo-offer"] as StorefrontComboOffer;

      const html = renderToStaticMarkup(
        React.createElement(ComboOfferDetailView, {
          combo: familyOffer,
          otherCombos: Object.values(FALLBACK_COMBO_DATA) as StorefrontComboOffer[],
        }),
      );

      // Title & badges
      expect(html).toContain("Family Combo Offer");
      expect(html).toContain("Super Saver");
      expect(html).toContain("38% OFF");

      // Pricing & savings
      expect(html).toContain("₹999");
      expect(html).toContain("₹1,599");
      expect(html).toContain("Save ₹600 (38%)");

      // Highlights
      expect(html).toContain("Traditional Health Mix");
      expect(html).toContain("Homemade Podi Varieties");
      expect(html).toContain("Nutrient-Dense Laddus");
      expect(html).toContain("Pure Native Ingredients");

      // What's Inside section
      expect(html).toContain("What&#x27;s Inside this Combo (12 Included Products)");
      expect(html).toContain("Sirudhaniya Sathu Maavu");
      expect(html).toContain("250 g");
      expect(html).toContain("Sprouted Ragi Choco Malt");
      expect(html).toContain("100 g");
      expect(html).toContain("Nattu Sakkarai (Country Sugar)");

      // Add to Cart
      expect(html).toContain("Add Combo to Cart — ₹999");

      // Breadcrumb link
      expect(html).toContain("Back to all Combo Offers");
    });
  });
});
