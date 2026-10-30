/**
 * Client-side type mirrors for the public catalogue API responses.
 * These are typed against the actual API output shapes in src/lib/catalogue/public.ts.
 * No invented fields — every field here exists in the real API response.
 */

export type CategoryCard = {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  productCount: number;
  image: { url: string } | null;
};

export type CategoriesResponse = {
  categories: CategoryCard[];
};

export type ProductOfferBadge = {
  id: string;
  name: string;
  scope?: "product" | "category";
  discountType: "percentage" | "flat";
  value: number;
  discountPaise?: number;
};

export type ProductPrice = {
  fromPaise: number | null;
  toPaise: number | null;
  fromMrpPaise: number | null;
  discountPercent: number;
};

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  isFeatured: boolean;
  category: { slug: string; name: string };
  price: ProductPrice;
  appliedOffer?: ProductOfferBadge | null;
  hasMultipleSizes: boolean;
  inStock: boolean;
  image: { url: string; alt: string | null } | null;
  variants: ProductVariant[];
};

export type ProductsResponse = {
  products: ProductCard[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  sort: string;
};

export type BestsellerProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  isFeatured: boolean;
  category: { slug: string; name: string };
  image: { url: string; alt: string | null } | null;
  inStock: boolean;
  variants: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  label: string;
  weightGrams: number | null;
  mrpPaise: number;
  pricePaise: number;
  discountPercent: number;
  inStock: boolean;
  lowStock: boolean;
  maxQuantity: number;
  offer?: ProductOfferBadge | null;
};

export type ProductImage = {
  url: string;
  alt: string | null;
  isPrimary: boolean;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  usage: string | null;
  isFeatured: boolean;
  category: { slug: string; name: string };
  inStock: boolean;
  variants: ProductVariant[];
  images: ProductImage[];
  related: ProductCard[];
};

export type SortOption = "featured" | "relevance" | "price_asc" | "price_desc" | "newest" | "name";

export type ProductQuery = {
  category?: string;
  q?: string;
  sort?: SortOption;
  inStock?: boolean;
  featured?: boolean;
  limit?: number;
  offset?: number;
};
