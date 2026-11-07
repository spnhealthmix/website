/**
 * Server-side data fetching functions for the storefront.
 * All functions call the internal catalogue API directly using the lib layer,
 * bypassing HTTP for server components. This avoids a self-referencing fetch
 * and removes the need for an absolute base URL.
 *
 * Each function is used in React Server Components only (no "use client").
 */

import { cache } from "react";
import { getDb } from "@/lib/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { categories, productImages, products, productVariants } from "@/lib/db/schema";
import { imageUrl } from "@/lib/storage/storage";
import {
  getPublicProduct,
  listPublicCategories,
  listPublicProducts,
} from "@/lib/catalogue/public";
import { evaluateBestOfferForVariant, getActiveOffers } from "@/lib/discounts/engine";
import type { PublicProductQuery } from "@/lib/catalogue/validation";
import type {
  BestsellerProduct,
  CategoriesResponse,
  CategoryCard,
  ProductDetail,
  ProductQuery,
  ProductsResponse,
  ProductVariant,
} from "./types";

function getDeps() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { db: null, imageBaseUrl: process.env.R2_PUBLIC_BASE_URL };
  }
  const db = getDb(databaseUrl);
  const imageBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  return { db, imageBaseUrl };
}

export const fetchAllActiveCategories = cache(async (): Promise<CategoriesResponse> => {
  const { db, imageBaseUrl } = getDeps();
  if (!db) {
    return { categories: [] };
  }
  try {
    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        imageKey: categories.imageKey,
        productCount: sql<number>`(select count(*)::int from products p
          where p.category_id = categories.id and p.is_active)`,
      })
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name), asc(categories.id));

    return {
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        productCount: r.productCount,
        image: r.imageKey ? { url: imageUrl(imageBaseUrl, r.imageKey)! } : null,
      })),
    };
  } catch (err) {
    console.error("Failed to load categories from database:", err);
    return { categories: [] };
  }
});

export const fetchCategories = cache(async (): Promise<CategoriesResponse> => {
  return fetchAllActiveCategories();
});

export const fetchCategoryBySlug = cache(async (slug: string): Promise<CategoryCard | null> => {
  const { db, imageBaseUrl } = getDeps();
  if (!db) return null;
  const [row] = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      imageKey: categories.imageKey,
      productCount: sql<number>`(select count(*)::int from products p
        where p.category_id = categories.id and p.is_active)`,
    })
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)));

  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    productCount: row.productCount,
    image: row.imageKey ? { url: imageUrl(imageBaseUrl, row.imageKey)! } : null,
  };
});

export async function fetchProducts(query: ProductQuery): Promise<ProductsResponse> {
  const { db, imageBaseUrl } = getDeps();
  if (!db) {
    return {
      products: [],
      total: 0,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      hasMore: false,
      sort: query.sort ?? "featured",
    };
  }

  const q: PublicProductQuery = {
    category: query.category,
    q: query.q,
    sort: query.sort,
    inStock: query.inStock ? "true" : undefined,
    featured: query.featured ? "true" : undefined,
    limit: query.limit ?? 20,
    offset: query.offset ?? 0,
  };

  try {
    return (await listPublicProducts(db, q, { imageBaseUrl })) as ProductsResponse;
  } catch (err: any) {
    if (err?.status === 404) {
      return {
        products: [],
        total: 0,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
        hasMore: false,
        sort: query.sort ?? "featured",
      };
    }
    throw err;
  }
}

export const fetchProduct = cache(async (slug: string): Promise<ProductDetail> => {
  const { db, imageBaseUrl } = getDeps();
  if (!db) {
    throw new Error("Database not connected");
  }
  return getPublicProduct(db, slug, { imageBaseUrl }) as Promise<ProductDetail>;
});

export const fetchProductRatingSummary = cache(async (productId: string) => {
  const { db } = getDeps();
  if (!db) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
  const { getProductRatingSummary } = await import("@/lib/reviews/service");
  return getProductRatingSummary(db, productId);
});

export const FEATURED_BESTSELLER_SLUGS = [
  "nuts-protein-powder",
  "abc-malt-nuts-mixed-powder",
  "idli-podi",
  "karuveppilai-sadham-podi",
  "garam-masala",
  "black-pepper-powder",
  "meen-kuzhambu-masala",
  "ellu-urundai",
] as const;

export const fetchBestsellerProducts = cache(async (): Promise<{
  featured: BestsellerProduct[];
  all: BestsellerProduct[];
}> => {
  const { db, imageBaseUrl } = getDeps();
  if (!db) {
    return { featured: [], all: [] };
  }
  try {
    const prods = await db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        slug: products.slug,
        name: products.name,
        shortDescription: products.shortDescription,
        isFeatured: products.isFeatured,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(products)
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.isActive, true), eq(categories.isActive, true)))
      .orderBy(asc(products.sortOrder), asc(products.name));

    const activeOffers = await getActiveOffers(db);
    const categoryByProduct = new Map(prods.map((p) => [p.id, p.categoryId]));

    const allVariants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        label: productVariants.label,
        weightGrams: productVariants.weightGrams,
        mrpPaise: productVariants.mrpPaise,
        pricePaise: productVariants.pricePaise,
        stock: productVariants.stock,
      })
      .from(productVariants)
      .where(eq(productVariants.isActive, true))
      .orderBy(asc(productVariants.pricePaise), asc(productVariants.id));

    const allImages = await db
      .select({
        productId: productImages.productId,
        r2Key: productImages.r2Key,
        alt: productImages.alt,
        isPrimary: productImages.isPrimary,
      })
      .from(productImages)
      .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder), asc(productImages.id));

    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const v of allVariants) {
      const list = variantsByProduct.get(v.productId) ?? [];
      const catId = categoryByProduct.get(v.productId);
      const offerEval = evaluateBestOfferForVariant(v, v.productId, catId, activeOffers);
      list.push({
        id: v.id,
        label: v.label,
        weightGrams: v.weightGrams,
        mrpPaise: offerEval.effectiveMrpPaise,
        pricePaise: offerEval.discountedPricePaise,
        discountPercent: offerEval.discountPercent,
        inStock: v.stock > 0,
        lowStock: v.stock > 0 && v.stock <= 5,
        maxQuantity: Math.max(0, Math.min(v.stock, 99)),
        offer: offerEval.appliedOffer,
      });
      variantsByProduct.set(v.productId, list);
    }

    const imageByProduct = new Map<string, { url: string; alt: string | null }>();
    for (const img of allImages) {
      if (!imageByProduct.has(img.productId)) {
        const url = imageUrl(imageBaseUrl, img.r2Key);
        if (url) {
          imageByProduct.set(img.productId, { url, alt: img.alt });
        }
      }
    }

    const allProductList: BestsellerProduct[] = prods.map((p) => {
      const pVariants = variantsByProduct.get(p.id) ?? [];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        isFeatured: p.isFeatured,
        category: { slug: p.categorySlug, name: p.categoryName },
        image: imageByProduct.get(p.id) ?? null,
        inStock: pVariants.some((v) => v.inStock),
        variants: pVariants,
      };
    });

    const featured: BestsellerProduct[] = [];
    for (const slug of FEATURED_BESTSELLER_SLUGS) {
      const prod = allProductList.find((p) => p.slug === slug);
      if (prod) {
        featured.push(prod);
      }
    }

    return { featured, all: allProductList };
  } catch (err) {
    console.error("Failed to load bestseller products:", err);
    return { featured: [], all: [] };
  }
});

export type ComboOfferItem = {
  id: string;
  slug: string;
  name: string;
  shortDescription?: string | null;
  description?: string | null;
  offerBadge?: string | null;
  packageLabel?: string | null;
  imageUrl?: string | null;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  destinationUrl?: string;
  pricePaise: number;
  mrpPaise?: number | null;
  savingsPaise?: number;
  discountPercentage?: number;
  stock?: number;
  inStock?: boolean;
  allowAddToCart?: boolean;
  packageHighlights?: string[];
  variantId?: string | null;
  displayOrder?: number;
  items?: Array<{
    id: string;
    itemTitle: string;
    quantity: number;
    unit?: string | null;
    sortOrder: number;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    label: string;
    weightGrams?: number | null;
    pricePaise: number;
    mrpPaise: number;
    stock: number;
    inStock: boolean;
  }>;
};

export const FALLBACK_COMBO_DATA: Record<string, ComboOfferItem> = {
  "family-combo-offer": {
    id: "6ea90443-e162-4567-b952-b2b47059f130",
    slug: "family-combo-offer",
    name: "Family Combo Offer",
    shortDescription: "All-in-one monthly health basket with 12 handcrafted essentials for the complete family.",
    description: "Our signature Diwali Special Family Combo brings together the very best of SPN Foods. Every item is freshly prepared in small batches using traditional recipes, stone-ground flours, and zero artificial preservatives.",
    offerBadge: "Super Saver",
    packageLabel: "12-in-1 Pack (4.3 kg total)",
    imageUrl: "/hero1.jpeg",
    desktopImageUrl: "/hero1.jpeg",
    mobileImageUrl: "/hero1.jpeg",
    destinationUrl: "/combo-offers/family-combo-offer",
    pricePaise: 99900,
    mrpPaise: 159900,
    savingsPaise: 60000,
    discountPercentage: 38,
    stock: 50,
    inStock: true,
    allowAddToCart: true,
    packageHighlights: [
      "Traditional Health Mix",
      "Homemade Podi Varieties",
      "Nutrient-Dense Laddus",
      "Pure Native Ingredients",
    ],
    variantId: "4c4eaa02-c941-4766-b187-dafd4568481e",
    displayOrder: 1,
    items: [
      { id: "f-1", itemTitle: "Sirudhaniya Sathu Maavu", quantity: 1, unit: "250 g", sortOrder: 1 },
      { id: "f-2", itemTitle: "Sprouted Ragi Choco Malt", quantity: 1, unit: "100 g", sortOrder: 2 },
      { id: "f-3", itemTitle: "Karuppu Kavuni Kanji Mix", quantity: 1, unit: "250 g", sortOrder: 3 },
      { id: "f-4", itemTitle: "Sambar Powder", quantity: 1, unit: "50 g", sortOrder: 4 },
      { id: "f-5", itemTitle: "Rasam Powder", quantity: 1, unit: "50 g", sortOrder: 5 },
      { id: "f-6", itemTitle: "Idli / Dosa Milagai Podi", quantity: 1, unit: "50 g", sortOrder: 6 },
      { id: "f-7", itemTitle: "Kollu Idli Podi", quantity: 1, unit: "50 g", sortOrder: 7 },
      { id: "f-8", itemTitle: "Paruppu Podi", quantity: 1, unit: "50 g", sortOrder: 8 },
      { id: "f-9", itemTitle: "Kadalai Mittai", quantity: 1, unit: "100 g", sortOrder: 9 },
      { id: "f-10", itemTitle: "Ellu Urundai", quantity: 1, unit: "100 g", sortOrder: 10 },
      { id: "f-11", itemTitle: "Pasi Paruppu Laddu", quantity: 1, unit: "100 g", sortOrder: 11 },
      { id: "f-12", itemTitle: "Nattu Sakkarai (Country Sugar)", quantity: 1, unit: "250 g", sortOrder: 12 },
    ],
    variants: [
      {
        id: "4c4eaa02-c941-4766-b187-dafd4568481e",
        sku: "family-combo-12in1",
        label: "12 Items Pack",
        weightGrams: 1500,
        pricePaise: 99900,
        mrpPaise: 159900,
        stock: 50,
        inStock: true,
      },
    ],
  },
  "sweet-laddus-combo": {
    id: "9cbb8e71-076f-4485-a3f0-27038ea05b2c",
    slug: "sweet-laddus-combo",
    name: "Fast Moving Sweet Laddu's Combo",
    shortDescription: "Box of 4 traditionally rolled nutrient-packed sweet laddus made with pure country sugar and cold-pressed ghee.",
    description: "A celebration of authentic South Indian confectionery. Handcrafted daily with pure cow ghee, native jaggery, cardamom, and nutrient-dense sprouted lentils.",
    offerBadge: "Festive Pack",
    packageLabel: "4 Packs (1 kg total)",
    imageUrl: "/hero2.jpeg",
    desktopImageUrl: "/hero2.jpeg",
    mobileImageUrl: "/hero2.jpeg",
    destinationUrl: "/combo-offers/sweet-laddus-combo",
    pricePaise: 49900,
    mrpPaise: 69900,
    savingsPaise: 20000,
    discountPercentage: 29,
    stock: 50,
    inStock: true,
    allowAddToCart: true,
    packageHighlights: [
      "Zero Refined Sugar",
      "Pure Cow Ghee",
      "Freshly Rolled Daily",
      "Rich in Iron & Calcium",
    ],
    variantId: "21c367bb-f839-4959-882e-1154b4a50181",
    displayOrder: 2,
    items: [
      { id: "s-1", itemTitle: "Kadalai Urundai Laddu", quantity: 1, unit: "250 g", sortOrder: 1 },
      { id: "s-2", itemTitle: "Ellu Urundai", quantity: 1, unit: "250 g", sortOrder: 2 },
      { id: "s-3", itemTitle: "Rava Laddu", quantity: 1, unit: "250 g", sortOrder: 3 },
      { id: "s-4", itemTitle: "Karuppu Kavuni Laddu", quantity: 1, unit: "250 g", sortOrder: 4 },
    ],
    variants: [
      {
        id: "21c367bb-f839-4959-882e-1154b4a50181",
        sku: "sweet-laddus-combo-1kg",
        label: "4 × 250g Pack",
        weightGrams: 1000,
        pricePaise: 49900,
        mrpPaise: 69900,
        stock: 50,
        inStock: true,
      },
    ],
  },
  "spicy-podi-varieties-combo": {
    id: "8a093489-a248-48cb-bb42-b80e82de96a1",
    slug: "spicy-podi-varieties-combo",
    name: "Spicy Podi Varieties Combo",
    shortDescription: "Six aromatic, traditionally roasted spice powders made with pure native herbs and lentils.",
    description: "Six aromatic spice powders roasted slowly on wood-fire iron kadais and stone ground. Perfect accompaniment for hot steamed rice with sesame oil or soft idlis.",
    offerBadge: "Diwali Special",
    packageLabel: "6 Varieties (300g total)",
    imageUrl: "/hero3.jpeg",
    desktopImageUrl: "/hero3.jpeg",
    mobileImageUrl: "/hero3.jpeg",
    destinationUrl: "/combo-offers/spicy-podi-varieties-combo",
    pricePaise: 34900,
    mrpPaise: 39900,
    savingsPaise: 5000,
    discountPercentage: 13,
    stock: 50,
    inStock: true,
    allowAddToCart: true,
    packageHighlights: [
      "Stone Ground Spices",
      "Slow Roasted in Iron Kadais",
      "No Added Preservatives",
      "Authentic Tamil Brahmin Style",
    ],
    variantId: "7dbf413a-cc17-495e-8744-f25c1ca03f71",
    displayOrder: 3,
    items: [
      { id: "p-1", itemTitle: "Paruppu Podi", quantity: 1, unit: "50 g", sortOrder: 1 },
      { id: "p-2", itemTitle: "Idli Podi", quantity: 1, unit: "50 g", sortOrder: 2 },
      { id: "p-3", itemTitle: "Poondu Podi", quantity: 1, unit: "50 g", sortOrder: 3 },
      { id: "p-4", itemTitle: "Puliyodharai Podi", quantity: 1, unit: "50 g", sortOrder: 4 },
      { id: "p-5", itemTitle: "Karuveppilai Podi", quantity: 1, unit: "50 g", sortOrder: 5 },
      { id: "p-6", itemTitle: "Murungai Leaves Podi", quantity: 1, unit: "50 g", sortOrder: 6 },
    ],
    variants: [
      {
        id: "7dbf413a-cc17-495e-8744-f25c1ca03f71",
        sku: "spicy-podi-combo-300g",
        label: "6 × 50g Pack",
        weightGrams: 300,
        pricePaise: 34900,
        mrpPaise: 39900,
        stock: 50,
        inStock: true,
      },
    ],
  },
  "nendram-banana-chips": {
    id: "f5cb83cd-fadf-46b6-8c6b-9c6337e928f0",
    slug: "nendram-banana-chips",
    name: "Kerala Nendram Banana Chips",
    shortDescription: "Golden, crispy, wafer-thin banana chips made from premium Nendram bananas sliced and fried to perfection in pure coconut oil with a pinch of rock salt.",
    description: "Authentic golden Kerala-style banana chips made strictly from select raw Nendram bananas, sliced paper-thin and kettle-fried in 100% pure cold-pressed coconut oil.",
    offerBadge: "Crispy & Fresh",
    packageLabel: "Pure Coconut Oil",
    imageUrl: "/hero4.jpeg",
    desktopImageUrl: "/hero4.jpeg",
    mobileImageUrl: "/hero4.jpeg",
    destinationUrl: "/combo-offers/nendram-banana-chips",
    pricePaise: 11900,
    mrpPaise: 11900,
    savingsPaise: 0,
    discountPercentage: 0,
    stock: 100,
    inStock: true,
    allowAddToCart: true,
    packageHighlights: [
      "100% Pure Coconut Oil",
      "Selected Kerala Nendram Bananas",
      "Crispy & Thin Slices",
      "No Artificial Flavours",
    ],
    variantId: "7edae54e-302f-4069-9d9a-bb782d2a5651",
    displayOrder: 4,
    items: [
      { id: "b-1", itemTitle: "Kerala Nendram Banana Chips", quantity: 1, unit: "250 g", sortOrder: 1 },
    ],
    variants: [
      {
        id: "7edae54e-302f-4069-9d9a-bb782d2a5651",
        sku: "banana-chips-250g",
        label: "250 g",
        weightGrams: 250,
        pricePaise: 11900,
        mrpPaise: 11900,
        stock: 100,
        inStock: true,
      },
      {
        id: "3c1c395a-bc06-4890-bc96-2ceb8de8436d",
        sku: "banana-chips-500g",
        label: "500 g",
        weightGrams: 500,
        pricePaise: 21900,
        mrpPaise: 21900,
        stock: 100,
        inStock: true,
      },
      {
        id: "27f23ede-24a1-4bab-8c42-6b1b977e98af",
        sku: "banana-chips-1kg",
        label: "1 kg",
        weightGrams: 1000,
        pricePaise: 42900,
        mrpPaise: 42900,
        stock: 50,
        inStock: true,
      },
    ],
  },
};

export type StorefrontComboOffer = ComboOfferItem;

export const fetchActiveComboOffers = cache(async (): Promise<StorefrontComboOffer[]> => {
  const { db } = getDeps();
  if (!db) {
    return Object.values(FALLBACK_COMBO_DATA);
  }
  try {
    const { getActiveComboOffers } = await import("@/lib/combo-offers/service");
    const rows = await getActiveComboOffers(db);

    if (rows.length === 0) {
      return Object.values(FALLBACK_COMBO_DATA);
    }

    return rows.map((r) => {
      const fallback = FALLBACK_COMBO_DATA[r.slug];
      const variants = fallback?.variants && fallback.variants.length > 1
        ? fallback.variants
        : [
            {
              id: r.variantId || r.id,
              sku: `combo-${r.slug}`,
              label: r.packageLabel || "1 Pack",
              weightGrams: 500,
              pricePaise: r.pricePaise,
              mrpPaise: r.mrpPaise || r.pricePaise,
              stock: r.stock,
              inStock: r.stock > 0,
            },
          ];

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        shortDescription: r.shortDescription || fallback?.shortDescription || null,
        description: r.description || fallback?.description || null,
        offerBadge: r.offerBadge || fallback?.offerBadge || null,
        packageLabel: r.packageLabel || fallback?.packageLabel || null,
        imageUrl: r.imageUrl || fallback?.imageUrl || r.desktopImageUrl,
        desktopImageUrl: r.desktopImageUrl,
        mobileImageUrl: r.mobileImageUrl,
        destinationUrl: r.destinationUrl || `/combo-offers/${r.slug}`,
        pricePaise: r.pricePaise,
        mrpPaise: r.mrpPaise ?? fallback?.mrpPaise ?? null,
        savingsPaise: r.savingsPaise,
        discountPercentage: r.discountPercentage,
        stock: r.stock,
        inStock: r.stock > 0,
        allowAddToCart: r.allowAddToCart,
        packageHighlights: r.packageHighlights?.length ? r.packageHighlights : fallback?.packageHighlights || [],
        variantId: r.variantId || variants[0]?.id,
        displayOrder: r.displayOrder,
        items: r.items?.length
          ? r.items.map((i) => ({
              id: i.id,
              itemTitle: i.itemTitle,
              quantity: i.quantity,
              unit: i.unit,
              sortOrder: i.sortOrder,
            }))
          : fallback?.items || [],
        variants,
      };
    });
  } catch (err) {
    console.error("Failed to load active combo offers from database:", err);
    return Object.values(FALLBACK_COMBO_DATA);
  }
});

export const fetchComboOfferBySlug = cache(async (slug: string): Promise<StorefrontComboOffer | null> => {
  const { db } = getDeps();
  if (!db) {
    return FALLBACK_COMBO_DATA[slug] ?? null;
  }
  try {
    const { getComboOfferBySlug } = await import("@/lib/combo-offers/service");
    const r = await getComboOfferBySlug(db, slug);

    if (!r) {
      return FALLBACK_COMBO_DATA[slug] ?? null;
    }

    const fallback = FALLBACK_COMBO_DATA[r.slug];
    const variants = fallback?.variants && fallback.variants.length > 1
      ? fallback.variants
      : [
          {
            id: r.variantId || r.id,
            sku: `combo-${r.slug}`,
            label: r.packageLabel || "1 Pack",
            weightGrams: 500,
            pricePaise: r.pricePaise,
            mrpPaise: r.mrpPaise || r.pricePaise,
            stock: r.stock,
            inStock: r.stock > 0,
          },
        ];

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      shortDescription: r.shortDescription || fallback?.shortDescription || null,
      description: r.description || fallback?.description || null,
      offerBadge: r.offerBadge || fallback?.offerBadge || null,
      packageLabel: r.packageLabel || fallback?.packageLabel || null,
      imageUrl: r.imageUrl || fallback?.imageUrl || r.desktopImageUrl,
      desktopImageUrl: r.desktopImageUrl,
      mobileImageUrl: r.mobileImageUrl,
      destinationUrl: r.destinationUrl || `/combo-offers/${r.slug}`,
      pricePaise: r.pricePaise,
      mrpPaise: r.mrpPaise ?? fallback?.mrpPaise ?? null,
      savingsPaise: r.savingsPaise,
      discountPercentage: r.discountPercentage,
      stock: r.stock,
      inStock: r.stock > 0,
      allowAddToCart: r.allowAddToCart,
      packageHighlights: r.packageHighlights?.length ? r.packageHighlights : fallback?.packageHighlights || [],
      variantId: r.variantId || variants[0]?.id,
      displayOrder: r.displayOrder,
      items: r.items?.length
        ? r.items.map((i) => ({
            id: i.id,
            itemTitle: i.itemTitle,
            quantity: i.quantity,
            unit: i.unit,
            sortOrder: i.sortOrder,
          }))
        : fallback?.items || [],
      variants,
    };
  } catch (err) {
    console.error("Failed to load combo offer by slug:", err);
    return FALLBACK_COMBO_DATA[slug] ?? null;
  }
});

export const fetchComboOffersData = cache(async (): Promise<Record<string, ComboOfferItem>> => {
  const list = await fetchActiveComboOffers();
  const dict: Record<string, ComboOfferItem> = {};
  for (const item of list) {
    dict[item.slug] = item;
  }
  // Guarantee fallback slugs exist in dictionary
  for (const [slug, item] of Object.entries(FALLBACK_COMBO_DATA)) {
    if (!dict[slug]) {
      dict[slug] = item;
    }
  }
  return dict;
});



