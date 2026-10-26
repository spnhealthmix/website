"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BestsellerProduct } from "@/lib/storefront/types";
import { FeaturedProductCard } from "./featured-product-card";

interface FeaturedProductsFilterProps {
  featuredProducts: BestsellerProduct[];
  allProducts?: BestsellerProduct[];
}

export function FeaturedProductsFilter({
  featuredProducts,
}: FeaturedProductsFilterProps) {
  // Strictly display the 8 featured bestseller products (two rows of four on desktop)
  const productsToDisplay = featuredProducts.slice(0, 8);

  return (
    <section aria-labelledby="featured-heading" className="w-full">
      <div className="container-spn">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7 sm:mb-9">
          <div>
            <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[12px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2 block">
              SMALL-BATCH STAPLES
            </span>
            <h2
              id="featured-heading"
              className="text-3xl sm:text-4xl lg:text-[44px] text-[#1A1614] leading-[1.12] font-normal"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Featured Bestsellers
            </h2>
            <p className="font-[family-name:var(--font-body)] text-[14.5px] sm:text-[15.5px] text-[#635850] mt-2 max-w-xl leading-relaxed font-normal">
              Everyday favourites, made for the way we cook at home.
            </p>
          </div>

          <Link
            href="/shop"
            prefetch={false}
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-body)] text-[14px] sm:text-[14.5px] font-medium text-[#BF5330] hover:text-[#8F3E20] hover:underline underline-offset-4 shrink-0 transition-colors"
          >
            <span>View all products</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        {/* Product Grid: Exactly 8 products in 4 columns on desktop (2 rows of 4) */}
        {productsToDisplay.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {productsToDisplay.map((product, idx) => (
              <FeaturedProductCard
                key={product.id}
                product={product}
                priority={idx < 4}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
