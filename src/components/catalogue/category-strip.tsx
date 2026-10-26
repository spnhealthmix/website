import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, UtensilsCrossed } from "lucide-react";
import type { CategoryCard } from "@/lib/storefront/types";
import { cn } from "@/lib/utils";

interface CategoryStripProps {
  categories: CategoryCard[];
}

// Curated verified editorial metadata for all 5 storefront categories
const CATEGORY_EDITORIAL_META: Record<
  string,
  {
    image?: string;
    subtitle: string;
    tag: string;
    description: string;
    badge?: string;
    isNeutral?: boolean;
  }
> = {
  "health-mix-powders": {
    image: "/products/karuppu-kavuni-kanji-mix/main.jpg",
    subtitle: "Porridge, Kanji & Nut Malts",
    tag: "Core Nutrition",
    description: "Slow-roasted heirloom millets and grains for wholesome daily vitality.",
  },
  "podi-varieties": {
    image: "/products/idli-podi/main.jpg",
    subtitle: "Stone-Roasted Idli & Rice Podis",
    tag: "Daily Staples",
    description: "Freshly roasted dal and spice podis with genuine homestyle crunch.",
  },
  "masalas-and-powders": {
    image: "/products/sambar-masala/main.jpg",
    subtitle: "Pure Sun-Dried Spice Blends",
    tag: "Kitchen Essentials",
    description: "Aromatic sambar, rasam, and single-origin spice powders.",
  },
  snacks: {
    image: "/products/kadalai-urundai/main.jpg",
    subtitle: "Traditional Jaggery & Seed Bites",
    tag: "Wholesome Treats",
    description: "Crunchy peanut and sesame bites handcrafted with natural jaggery.",
  },
  thokku: {
    subtitle: "Homestyle Relishes & Preserves",
    tag: "Traditional Kitchen",
    description: "Authentic slow-cooked thokkus crafted during seasonal harvests.",
    badge: "Seasonal Release",
    isNeutral: true,
  },
};

// Fallback order to ensure all 5 categories appear in a consistent editorial sequence
const ORDERED_SLUGS = [
  "health-mix-powders",
  "podi-varieties",
  "masalas-and-powders",
  "snacks",
  "thokku",
];

export function CategoryStrip({ categories }: CategoryStripProps) {
  // Sort according to canonical editorial order and ensure all 5 are discoverable
  const categoryMap = new Map<string, CategoryCard>();
  for (const c of categories) {
    categoryMap.set(c.slug, c);
  }

  // Build the 5 categories list using database items or fallback cards
  const displayCategories = ORDERED_SLUGS.map((slug) => {
    const existing = categoryMap.get(slug);
    if (existing) return existing;
    // Fallback for Thokku if filtered elsewhere or newly added
    const fallbackNames: Record<string, string> = {
      "health-mix-powders": "Health Mix Powders",
      "podi-varieties": "Podi Varieties",
      "masalas-and-powders": "Masalas & Powders",
      snacks: "Snacks",
      thokku: "Thokku",
    };
    return {
      id: slug,
      slug,
      name: fallbackNames[slug] ?? slug,
      description: "",
      productCount: 0,
      image: null,
    } as CategoryCard;
  });

  return (
    <section aria-labelledby="category-strip-heading" className="w-full">
      <div className="container-spn">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--color-brand-primary-light)]/40 border border-[var(--color-brand-primary)]/20 mb-2">
              <Sparkles className="w-3 h-3 text-[var(--color-brand-primary-dark)]" />
              <span className="font-[family-name:var(--font-body)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-brand-primary-dark)]">
                Authentic Collections
              </span>
            </div>
            <h2
              id="category-strip-heading"
              className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl lg:text-[34px] text-[var(--color-text-primary)] leading-tight font-normal"
            >
              Shop by Category
            </h2>
            <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1.5 max-w-xl">
              From nutrient-rich morning kanji to freshly ground spice podis, explore traditional staples prepared with care.
            </p>
          </div>

          <Link
            href="/shop"
            prefetch={false}
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-body)] text-sm font-semibold text-[var(--color-brand-primary-dark)] hover:text-[var(--color-brand-primary)] transition-colors group shrink-0"
          >
            <span>Browse all products</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* 5-Category Responsive Grid: Clean, Un-obscured Photography */}
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5"
          role="list"
        >
          {displayCategories.map((cat, idx) => {
            const meta = CATEGORY_EDITORIAL_META[cat.slug] || {
              subtitle: "South Indian Staple",
              tag: "Staple",
              description: "Authentic recipes crafted for everyday cooking.",
            };

            const isNeutralTreatment = meta.isNeutral || !meta.image;

            return (
              <Link
                key={cat.slug}
                href={`/shop/${cat.slug}`}
                prefetch={false}
                className={cn(
                  "group flex flex-col rounded-[16px] overflow-hidden bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:border-[var(--color-brand-primary)] transition-all duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                  // If 5th item on 2-col mobile screen, span 2 columns gracefully
                  idx === 4 && "col-span-2 md:col-span-1"
                )}
                role="listitem"
                aria-label={cat.name}
              >
                {/* Visual Packaging Canvas — Crisp, Clean, Zero Dark Overlays */}
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-[var(--color-surface-sunken)] flex items-center justify-center">
                  {!isNeutralTreatment && meta.image ? (
                    <Image
                      src={meta.image}
                      alt={`SPN Health Mix ${cat.name} authentic collection`}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      loading={idx < 2 ? "eager" : "lazy"}
                    />
                  ) : (
                    /* Tasteful culinary neutral treatment for categories without current photography */
                    <div className="w-full h-full bg-gradient-to-br from-[var(--color-surface-sunken)] to-[var(--color-surface)] flex flex-col items-center justify-center p-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-brand-primary-light)]/50 border border-[var(--color-brand-primary)]/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                        <UtensilsCrossed className="w-5 h-5 text-[var(--color-brand-primary-dark)]" />
                      </div>
                      <span className="font-[family-name:var(--font-body)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-primary-dark)]">
                        {meta.badge ?? "Authentic Preserve"}
                      </span>
                    </div>
                  )}

                  {/* Clean Category Tag Pill */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="font-[family-name:var(--font-body)] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-surface-raised)]/90 backdrop-blur-xs text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-2xs">
                      {meta.tag}
                    </span>
                  </div>
                </div>

                {/* Content Area Below Image — Zero Competition with Photography */}
                <div className="p-3.5 sm:p-4 flex flex-col flex-1">
                  <h3 className="font-[family-name:var(--font-product)] text-base sm:text-lg font-medium text-[var(--color-text-primary)] leading-snug group-hover:text-[var(--color-brand-primary)] transition-colors mb-1 line-clamp-1">
                    {cat.name}
                  </h3>
                  <p className="font-[family-name:var(--font-body)] text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed mb-3 flex-1">
                    {meta.description}
                  </p>

                  <div className="flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-primary-dark)] group-hover:text-[var(--color-brand-primary)] transition-colors mt-auto">
                    <span>Explore</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CategoryStripSkeleton() {
  return (
    <div className="container-spn" aria-hidden="true">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="skeleton h-4 w-32 rounded mb-2" />
          <div className="skeleton h-8 w-48 rounded" />
        </div>
        <div className="skeleton h-5 w-28 rounded" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 lg:gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[4/5] rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
