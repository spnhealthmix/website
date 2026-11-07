import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  destinationUrlSchema,
  imageUrlSchema,
  comboOfferCreateSchema,
  comboOfferUpdateSchema,
} from "../src/lib/combo-offers/validation";
import {
  extractR2Key,
  isImageReferenced,
  createComboOffer,
  updateComboOffer,
  deleteComboOffer,
  uploadComboOfferPoster,
  listComboOffers,
  getActiveComboOffers,
  calculateSavingsAndDiscount,
} from "../src/lib/combo-offers/service";
import { dispatchAdminRequest } from "../src/lib/api/admin-router";
import { publicComboOffers } from "../src/lib/api/public-api";
import { HeroSlider, HERO_SLIDES } from "../src/components/home/hero-slider";
import type { ObjectStorage } from "../src/lib/storage/storage";
import type { ApiDeps } from "../src/lib/api/customer-api";

describe("Combo Offers Management - Validation & Security", () => {
  describe("Destination URL Schema", () => {
    it("accepts default /combo-offers destination", () => {
      expect(destinationUrlSchema.parse("/combo-offers")).toBe("/combo-offers");
    });

    it("accepts internal routes and query strings", () => {
      expect(destinationUrlSchema.parse("/products/family-combo-offer")).toBe("/products/family-combo-offer");
      expect(destinationUrlSchema.parse("/shop?category=health-mix")).toBe("/shop?category=health-mix");
    });

    it("accepts valid http and https external URLs", () => {
      expect(destinationUrlSchema.parse("https://spnhealthmix.com/campaign")).toBe("https://spnhealthmix.com/campaign");
      expect(destinationUrlSchema.parse("http://example.com/offer")).toBe("http://example.com/offer");
    });

    it("strictly rejects javascript: and unsafe pseudo-protocols", () => {
      expect(() => destinationUrlSchema.parse("javascript:alert(document.cookie)")).toThrow();
      expect(() => destinationUrlSchema.parse("data:text/html,<script>alert(1)</script>")).toThrow();
      expect(() => destinationUrlSchema.parse("vbscript:msgbox(1)")).toThrow();
    });

    it("strictly rejects protocol-relative and backslash phishing paths", () => {
      expect(() => destinationUrlSchema.parse("//malicious-site.com")).toThrow();
      expect(() => destinationUrlSchema.parse("/\\malicious-site.com")).toThrow();
      expect(() => destinationUrlSchema.parse("\\\\server\\share")).toThrow();
    });

    it("rejects empty strings", () => {
      expect(() => destinationUrlSchema.parse("   ")).toThrow();
    });
  });

  describe("Image URL Schema", () => {
    it("accepts absolute R2 URLs and local static asset paths", () => {
      expect(imageUrlSchema.parse("https://pub-be0003e492864dc58b5e51e4a16feee5.r2.dev/combo-offers/posters/test.webp"))
        .toBe("https://pub-be0003e492864dc58b5e51e4a16feee5.r2.dev/combo-offers/posters/test.webp");
      expect(imageUrlSchema.parse("/hero1.jpeg")).toBe("/hero1.jpeg");
    });

    it("rejects javascript: and non-url schemes for image", () => {
      expect(() => imageUrlSchema.parse("javascript:exploit()")).toThrow();
      expect(() => imageUrlSchema.parse("//external-untrusted.com/image.jpg")).toThrow();
    });
  });

  describe("Combo Offer Create & Update Schemas", () => {
    it("validates valid combo offer create payload", () => {
      const validPayload = {
        name: "Diwali Special Family Combo",
        desktopImageUrl: "https://pub-be0003e492864dc58b5e51e4a16feee5.r2.dev/combo-offers/posters/desktop.jpg",
        mobileImageUrl: "https://pub-be0003e492864dc58b5e51e4a16feee5.r2.dev/combo-offers/posters/mobile.jpg",
        destinationUrl: "/combo-offers",
        displayOrder: 1,
        isActive: true,
      };

      const parsed = comboOfferCreateSchema.parse(validPayload);
      expect(parsed.name).toBe("Diwali Special Family Combo");
      expect(parsed.displayOrder).toBe(1);
      expect(parsed.destinationUrl).toBe("/combo-offers");
    });

    it("defaults destinationUrl to /combo-offers and displayOrder to 0", () => {
      const parsed = comboOfferCreateSchema.parse({
        name: "Winter Festive Offer",
        desktopImageUrl: "/desktop.jpg",
        mobileImageUrl: "/mobile.jpg",
      });

      expect(parsed.destinationUrl).toBe("/combo-offers");
      expect(parsed.displayOrder).toBe(0);
      expect(parsed.isActive).toBe(true);
    });

    it("requires name, desktopImageUrl, and mobileImageUrl on creation", () => {
      expect(() =>
        comboOfferCreateSchema.parse({
          desktopImageUrl: "/desktop.jpg",
          mobileImageUrl: "/mobile.jpg",
        }),
      ).toThrow();

      expect(() =>
        comboOfferCreateSchema.parse({
          name: "Test",
          mobileImageUrl: "/mobile.jpg",
        }),
      ).toThrow();

      expect(() =>
        comboOfferCreateSchema.parse({
          name: "Test",
          desktopImageUrl: "/desktop.jpg",
        }),
      ).toThrow();
    });

    it("rejects negative display order", () => {
      expect(() =>
        comboOfferCreateSchema.parse({
          name: "Test",
          desktopImageUrl: "/desktop.jpg",
          mobileImageUrl: "/mobile.jpg",
          displayOrder: -1,
        }),
      ).toThrow();
    });

    it("allows partial updates but rejects empty update payloads", () => {
      expect(comboOfferUpdateSchema.parse({ isActive: false })).toEqual({ isActive: false });
      expect(comboOfferUpdateSchema.parse({ displayOrder: 5 })).toEqual({ displayOrder: 5 });
      expect(() => comboOfferUpdateSchema.parse({})).toThrow();
    });

    it("validates product-like combo offer fields including badges, labels, and highlights", () => {
      const fullCombo = comboOfferCreateSchema.parse({
        name: "Festive Family Pack",
        slug: "festive-family-pack",
        shortDescription: "Wholesome festive combo",
        description: "Full description of festive combo",
        offerBadge: "Super Saver",
        packageLabel: "12-in-1 Pack",
        desktopImageUrl: "/desk.jpg",
        mobileImageUrl: "/mob.jpg",
        pricePaise: 99900,
        mrpPaise: 159900,
        stock: 45,
        allowAddToCart: true,
        packageHighlights: ["Native Ingredients", "No Preservatives"],
        includedItems: [
          { itemTitle: "Sathu Maavu", quantity: 1, unit: "250 g", sortOrder: 0 },
          { itemTitle: "Ragi Malt", quantity: 2, unit: "100 g", sortOrder: 1 },
        ],
      });

      expect(fullCombo.slug).toBe("festive-family-pack");
      expect(fullCombo.offerBadge).toBe("Super Saver");
      expect(fullCombo.packageLabel).toBe("12-in-1 Pack");
      expect(fullCombo.pricePaise).toBe(99900);
      expect(fullCombo.mrpPaise).toBe(159900);
      expect(fullCombo.stock).toBe(45);
      expect(fullCombo.allowAddToCart).toBe(true);
      expect(fullCombo.packageHighlights).toHaveLength(2);
      expect(fullCombo.includedItems).toHaveLength(2);
    });

    it("strictly rejects when selling price exceeds original price / MRP", () => {
      expect(() =>
        comboOfferCreateSchema.parse({
          name: "Invalid Pricing Combo",
          desktopImageUrl: "/desk.jpg",
          mobileImageUrl: "/mob.jpg",
          pricePaise: 120000,
          mrpPaise: 99900,
        }),
      ).toThrow("Selling price cannot exceed the original price / MRP.");

      expect(() =>
        comboOfferUpdateSchema.parse({
          pricePaise: 150000,
          mrpPaise: 120000,
        }),
      ).toThrow("Selling price cannot exceed the original price / MRP.");
    });

    it("calculates savings and discount percentage correctly", () => {
      const { savingsPaise, discountPercentage } = calculateSavingsAndDiscount(99900, 159900);
      expect(savingsPaise).toBe(60000);
      expect(discountPercentage).toBe(38);

      const noDiscount = calculateSavingsAndDiscount(50000, null);
      expect(noDiscount.savingsPaise).toBe(0);
      expect(noDiscount.discountPercentage).toBe(0);

      const equalPrice = calculateSavingsAndDiscount(50000, 50000);
      expect(equalPrice.savingsPaise).toBe(0);
      expect(equalPrice.discountPercentage).toBe(0);
    });
  });
});

describe("Cloudflare R2 Key Extraction & Storage Cleanup Behavior", () => {
  it("extracts R2 keys from full R2 URLs", () => {
    const key = extractR2Key("https://pub-be0003e492864dc58b5e51e4a16feee5.r2.dev/combo-offers/posters/banner-1.webp");
    expect(key).toBe("combo-offers/posters/banner-1.webp");
  });

  it("extracts R2 keys from relative paths and direct keys", () => {
    expect(extractR2Key("/combo-offers/posters/banner-2.jpg")).toBe("combo-offers/posters/banner-2.jpg");
    expect(extractR2Key("combo-offers/posters/banner-3.png")).toBe("combo-offers/posters/banner-3.png");
  });

  it("returns null for local static assets ensuring local assets are never deleted from storage", () => {
    expect(extractR2Key("/hero1.jpeg")).toBeNull();
    expect(extractR2Key("/hero2.jpeg")).toBeNull();
    expect(extractR2Key("/images/logo.png")).toBeNull();
    expect(extractR2Key(null)).toBeNull();
    expect(extractR2Key(undefined)).toBeNull();
  });

  it("uploads poster image and returns public URL and key", async () => {
    const putSpy = vi.fn().mockResolvedValue(undefined);
    const mockStorage: ObjectStorage = {
      put: putSpy,
      delete: vi.fn(),
    };

    // Valid 8-byte PNG header
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
    const result = await uploadComboOfferPoster(mockStorage, pngBytes, {
      imageBaseUrl: "https://cdn.spnhealthmix.com",
    });

    expect(result.key).toMatch(/^combo-offers\/posters\/[a-f0-9-]+\.png$/);
    expect(result.url).toBe(`https://cdn.spnhealthmix.com/${result.key}`);
    expect(putSpy).toHaveBeenCalledWith(
      result.key,
      pngBytes,
      expect.objectContaining({ contentType: "image/png" }),
    );
  });
});

describe("Combo Offers Service & Database Operations", () => {
  let mockStore: any[];
  let auditLogs: any[];
  let deletedR2Keys: string[];
  let mockStorage: ObjectStorage;

  const createMockDb = () => {
    const makeQuery = (data: any[]) => {
      const p: any = Promise.resolve(data);
      p.orderBy = () => {
        const sorted = [...data];
        sorted.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        return makeQuery(sorted);
      };
      p.limit = (n: number) => makeQuery(data.slice(0, n));
      p.where = () => {
        const activeOnly = data.filter((item) => item.isActive === true);
        const result = activeOnly.length > 0 && activeOnly.length < data.length ? activeOnly : data;
        return makeQuery(result);
      };
      return p;
    };

    const db: any = {
      transaction: (fn: any) => fn(db),
      select: () => ({
        from: () => {
          const copy = [...mockStore];
          copy.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
          return makeQuery(copy);
        },
      }),
      insert: () => ({
        values: (data: any) => {
          if (data.action) {
            auditLogs.push(data);
            return Promise.resolve();
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
          return Promise.resolve();
        },
      }),
    };
    return db;
  };

  beforeEach(() => {
    mockStore = [];
    auditLogs = [];
    deletedR2Keys = [];
    mockStorage = {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockImplementation(async (keys: string[]) => {
        deletedR2Keys.push(...keys);
      }),
    };
  });

  it("creates a combo offer and writes an audit log", async () => {
    const db = createMockDb() as any;

    const offer = await createComboOffer(db, "admin-user-1", {
      name: "Family Health Mix Combo",
      desktopImageUrl: "https://r2.spn.dev/combo-offers/posters/desk1.jpg",
      mobileImageUrl: "https://r2.spn.dev/combo-offers/posters/mob1.jpg",
      destinationUrl: "/combo-offers",
      displayOrder: 1,
      isActive: true,
    });

    expect(offer.id).toBe("combo-1");
    expect(offer.name).toBe("Family Health Mix Combo");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("combo_offer.created");
    expect(auditLogs[0].actorProfileId).toBe("admin-user-1");
  });

  it("filters active/inactive combo offers and sorts by displayOrder", async () => {
    mockStore = [
      {
        id: "1",
        name: "Offer B (Inactive)",
        displayOrder: 2,
        isActive: false,
        desktopImageUrl: "/d2.jpg",
        mobileImageUrl: "/m2.jpg",
        destinationUrl: "/combo-offers",
      },
      {
        id: "2",
        name: "Offer A (Active)",
        displayOrder: 1,
        isActive: true,
        desktopImageUrl: "/d1.jpg",
        mobileImageUrl: "/m1.jpg",
        destinationUrl: "/combo-offers",
      },
      {
        id: "3",
        name: "Offer C (Active)",
        displayOrder: 3,
        isActive: true,
        desktopImageUrl: "/d3.jpg",
        mobileImageUrl: "/m3.jpg",
        destinationUrl: "/combo-offers",
      },
    ];

    const db = createMockDb() as any;
    const active = await getActiveComboOffers(db);

    expect(active).toHaveLength(2);
    expect(active[0].name).toBe("Offer A (Active)");
    expect(active[1].name).toBe("Offer C (Active)");
  });

  it("updates a combo offer, writes audit log, and cleans up replaced R2 image", async () => {
    const db = createMockDb() as any;
    const target = {
      id: "combo-1",
      name: "Diwali Combo",
      desktopImageUrl: "https://r2.spn.dev/combo-offers/posters/old-desktop.jpg",
      mobileImageUrl: "https://r2.spn.dev/combo-offers/posters/old-mobile.jpg",
      destinationUrl: "/combo-offers",
      displayOrder: 0,
      isActive: true,
    };
    mockStore = [target];

    // Mock select so it returns [target] on query, and empty array for isImageReferenced
    db.select = () => ({
      from: () => {
        const queryResult: any = Promise.resolve([target]);
        queryResult.orderBy = () => Promise.resolve([target]);
        queryResult.where = () => {
          const whereResult: any = Promise.resolve([target]);
          whereResult.limit = () => Promise.resolve([]); // isImageReferenced check returns unreferenced
          whereResult.orderBy = () => Promise.resolve([]);
          return whereResult;
        };
        return queryResult;
      },
    });

    await updateComboOffer(db, mockStorage, "admin-user-1", "combo-1", {
      desktopImageUrl: "https://r2.spn.dev/combo-offers/posters/new-desktop.jpg",
    });

    expect(auditLogs.some((l) => l.action === "combo_offer.updated")).toBe(true);
    expect(deletedR2Keys).toContain("combo-offers/posters/old-desktop.jpg");
  });

  it("deletes a combo offer and cleans up its R2 images", async () => {
    const db = createMockDb() as any;
    const target = {
      id: "combo-1",
      name: "Old Combo",
      desktopImageUrl: "https://r2.spn.dev/combo-offers/posters/desk.jpg",
      mobileImageUrl: "https://r2.spn.dev/combo-offers/posters/mob.jpg",
      destinationUrl: "/combo-offers",
      displayOrder: 0,
      isActive: true,
    };
    mockStore = [target];

    db.select = () => ({
      from: () => {
        const queryResult: any = Promise.resolve([target]);
        queryResult.where = () => {
          const whereResult: any = Promise.resolve([target]);
          whereResult.limit = () => Promise.resolve([]); // isImageReferenced check returns unreferenced
          whereResult.orderBy = () => Promise.resolve([]);
          return whereResult;
        };
        return queryResult;
      },
    });

    await deleteComboOffer(db, mockStorage, "admin-user-1", "combo-1");

    expect(auditLogs.some((l) => l.action === "combo_offer.deleted")).toBe(true);
    expect(deletedR2Keys).toContain("combo-offers/posters/desk.jpg");
    expect(deletedR2Keys).toContain("combo-offers/posters/mob.jpg");
  });
});

describe("Admin Authentication, Authorization & Endpoint Dispatching", () => {
  const allowedOrigins = ["https://www.spnhealthmix.com"];

  const buildMockDeps = (role: "admin" | "customer" | null): ApiDeps => ({
    withDb: async (fn: any) => fn({} as any),
    authenticate: async () => {
      if (!role) return null;
      return { profileId: "user-123", role };
    },
    allowedOrigins,
    storage: {
      put: vi.fn(),
      delete: vi.fn(),
    },
    imageBaseUrl: "https://pub.r2.dev",
    gateway: { createOrder: vi.fn() },
    razorpayKeyId: "",
    razorpayKeySecret: "",
    logger: {} as any,
    requestId: "test-req-1",
    log: vi.fn(),
  });

  it("rejects unauthenticated requests with 401", async () => {
    const deps = buildMockDeps(null);
    const req = new Request("https://www.spnhealthmix.com/api/admin/combo-offers", {
      method: "GET",
    });

    const res = await dispatchAdminRequest(req, deps);
    expect(res?.status).toBe(401);
  });

  it("rejects non-admin customers with 403 Forbidden", async () => {
    const deps = buildMockDeps("customer");
    const req = new Request("https://www.spnhealthmix.com/api/admin/combo-offers", {
      method: "GET",
    });

    const res = await dispatchAdminRequest(req, deps);
    expect(res?.status).toBe(403);
  });

  it("rejects mutating requests with invalid origin (CSRF protection)", async () => {
    const deps = buildMockDeps("admin");
    const req = new Request("https://www.spnhealthmix.com/api/admin/combo-offers", {
      method: "POST",
      headers: {
        origin: "https://attacker.evil.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Attack" }),
    });

    const res = await dispatchAdminRequest(req, deps);
    expect(res?.status).toBe(403);
    const data = await res?.json();
    expect(data.error.code).toBe("FORBIDDEN_ORIGIN");
  });
});

describe("Public Endpoint Security", () => {
  it("returns only public fields and filters active offers", async () => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () =>
              Promise.resolve([
                {
                  id: "combo-1",
                  name: "Family Combo",
                  desktopImageUrl: "/desk.jpg",
                  mobileImageUrl: "/mob.jpg",
                  destinationUrl: "/combo-offers",
                  displayOrder: 1,
                  isActive: true,
                  internalSecret: "do-not-expose",
                },
              ]),
          }),
        }),
      }),
    };

    const req = new Request("https://www.spnhealthmix.com/api/catalogue/combo-offers", {
      method: "GET",
    });

    const publicDeps = {
      withDb: (fn: any) => fn(mockDb),
      imageBaseUrl: "https://r2.dev",
      requestId: "pub-req-1",
    };

    const res = await publicComboOffers(req, publicDeps as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.comboOffers).toHaveLength(1);
    expect(body.comboOffers[0]).toMatchObject({
      id: "combo-1",
      name: "Family Combo",
      desktopImageUrl: "/desk.jpg",
      mobileImageUrl: "/mob.jpg",
      destinationUrl: "/combo-offers",
      displayOrder: 1,
    });
    expect((body.comboOffers[0] as any).internalSecret).toBeUndefined();
  });
});

describe("Homepage Hero Slider - Dynamic Poster Rendering & States", () => {
  it("renders responsive picture tag with desktop source and mobile img", () => {
    const testSlides = [
      {
        id: "slide-1",
        desktopSrc: "https://r2.spn.dev/desktop-poster-1.webp",
        portraitSrc: "https://r2.spn.dev/mobile-poster-1.webp",
        alt: "Diwali Special Combo",
        href: "/combo-offers",
      },
    ];

    const html = renderToStaticMarkup(React.createElement<any>(HeroSlider, { slides: testSlides }));

    // Verify <source media="(min-width: 768px)"> with desktop source
    expect(html).toContain('media="(min-width: 768px)"');
    expect(html).toContain('srcSet="https://r2.spn.dev/desktop-poster-1.webp"');

    // Verify <img> with mobile portrait source
    expect(html).toContain('src="https://r2.spn.dev/mobile-poster-1.webp"');
    expect(html).toContain('alt="Diwali Special Combo"');

    // Verify whole poster is clickable with configured destination
    expect(html).toContain('href="/combo-offers"');
  });

  it("navigates to custom destination page configured for that poster", () => {
    const testSlides = [
      {
        id: "slide-custom",
        desktopSrc: "/desktop.jpg",
        portraitSrc: "/mobile.jpg",
        alt: "Special Podi Combo",
        href: "/products/spicy-podi-varieties-combo",
      },
    ];

    const html = renderToStaticMarkup(React.createElement<any>(HeroSlider, { slides: testSlides }));
    expect(html).toContain('href="/products/spicy-podi-varieties-combo"');
  });

  it("hides previous/next arrows and indicators when only 1 active poster exists", () => {
    const singleSlide = [
      {
        id: "single-1",
        desktopSrc: "/desktop.jpg",
        portraitSrc: "/mobile.jpg",
        alt: "Single Poster",
        href: "/combo-offers",
      },
    ];

    const html = renderToStaticMarkup(React.createElement<any>(HeroSlider, { slides: singleSlide }));

    // No navigation arrows
    expect(html).not.toContain("Previous promotional slide");
    expect(html).not.toContain("Next promotional slide");

    // No slide indicator dots container
    expect(html).not.toContain('aria-label="Choose promotional slide"');
  });

  it("displays previous/next navigation and dots when multiple posters exist", () => {
    const multipleSlides = [
      {
        id: "1",
        desktopSrc: "/desk1.jpg",
        portraitSrc: "/mob1.jpg",
        alt: "Slide 1",
        href: "/combo-offers",
      },
      {
        id: "2",
        desktopSrc: "/desk2.jpg",
        portraitSrc: "/mob2.jpg",
        alt: "Slide 2",
        href: "/combo-offers",
      },
    ];

    const html = renderToStaticMarkup(React.createElement<any>(HeroSlider, { slides: multipleSlides }));
    
    // Both navigation arrows present
    expect(html).toContain("Previous promotional slide");
    expect(html).toContain("Next promotional slide");

    // Slide indicator group present
    expect(html).toContain('aria-label="Choose promotional slide"');
  });

  it("cleanly falls back to default promotional posters when no active posters exist", () => {
    // 0 active posters passed
    const html = renderToStaticMarkup(React.createElement<any>(HeroSlider, { slides: [] }));

    // Fallback contains the original default slides without broken images or empty space
    expect(html).toContain("SPN Health Mix Diwali Special Family Combo Offer");
    expect(html).toContain("/hero1.jpeg");
    expect(html).toContain("/hero2.jpeg");
    expect(html).toContain("Previous promotional slide");
  });
});
