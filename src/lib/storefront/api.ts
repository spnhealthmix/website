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
      const discountPercent =
        v.mrpPaise > v.pricePaise && v.mrpPaise > 0
          ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100)
          : 0;
      list.push({
        id: v.id,
        label: v.label,
        weightGrams: v.weightGrams,
        mrpPaise: v.mrpPaise,
        pricePaise: v.pricePaise,
        discountPercent,
        inStock: v.stock > 0,
        lowStock: v.stock > 0 && v.stock <= 5,
        maxQuantity: Math.max(0, Math.min(v.stock, 99)),
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
  shortDescription: string | null;
  variants: {
    id: string;
    sku: string;
    label: string;
    weightGrams: number | null;
    pricePaise: number;
    mrpPaise: number;
    stock: number;
    inStock: boolean;
  }[];
};

export const FALLBACK_COMBO_DATA: Record<string, ComboOfferItem> = {
  "family-combo-offer": {
    id: "6ea90443-e162-4567-b952-b2b47059f130",
    slug: "family-combo-offer",
    name: "Family Combo Offer",
    shortDescription: "Diwali Special 12-item family combo: Health mixes, spice masalas, podis, and traditional sweets.",
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
    shortDescription: "Diwali Special 4-pack sweet laddus: Kadalai Urundai, Ellu Urundai, Rava Laddu, and Karuppu Kavuni Laddu (250g each).",
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
    shortDescription: "Diwali Special 6-pack authentic South Indian podi varieties (50g each).",
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
    name: "Nendram Banana Chips",
    shortDescription: "Authentic crispy golden Kerala-style Nendram banana chips.",
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

export const fetchComboOffersData = cache(async (): Promise<Record<string, ComboOfferItem>> => {
  const { db } = getDeps();
  if (!db) {
    return FALLBACK_COMBO_DATA;
  }
  try {
    const comboSlugs = [
      "family-combo-offer",
      "sweet-laddus-combo",
      "spicy-podi-varieties-combo",
      "nendram-banana-chips",
    ];

    const prods = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        shortDescription: products.shortDescription,
      })
      .from(products)
      .where(and(inArray(products.slug, comboSlugs), eq(products.isActive, true)));

    if (prods.length === 0) {
      return FALLBACK_COMBO_DATA;
    }

    const prodIds = prods.map((p) => p.id);
    const vars = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        sku: productVariants.sku,
        label: productVariants.label,
        weightGrams: productVariants.weightGrams,
        pricePaise: productVariants.pricePaise,
        mrpPaise: productVariants.mrpPaise,
        stock: productVariants.stock,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, prodIds), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.pricePaise));

    const result: Record<string, ComboOfferItem> = {};

    for (const p of prods) {
      const pVars = vars
        .filter((v) => v.productId === p.id)
        .map((v) => ({
          id: v.id,
          sku: v.sku,
          label: v.label,
          weightGrams: v.weightGrams,
          pricePaise: v.pricePaise,
          mrpPaise: v.mrpPaise,
          stock: v.stock,
          inStock: v.stock > 0,
        }));

      result[p.slug] = {
        id: p.id,
        slug: p.slug,
        name: p.name,
        shortDescription: p.shortDescription,
        variants: pVars,
      };
    }

    // Merge in any missing with fallback to guarantee all 4 exist
    for (const slug of comboSlugs) {
      if (!result[slug] || result[slug].variants.length === 0) {
        result[slug] = FALLBACK_COMBO_DATA[slug];
      }
    }

    return result;
  } catch (err) {
    console.error("Failed to fetch live combo offers data:", err);
    return FALLBACK_COMBO_DATA;
  }
});


