"use client";

import { ProductCard } from "./product-card";
import type { BestsellerProduct } from "@/lib/storefront/types";

interface FeaturedProductCardProps {
  product: BestsellerProduct;
  priority?: boolean;
}

export function FeaturedProductCard({ product, priority = false }: FeaturedProductCardProps) {
  return <ProductCard product={product as any} priority={priority} />;
}
