import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CategoryCard } from "@/lib/storefront/types";

interface CategoryBentoProps {
  categories: CategoryCard[];
}

const CATEGORY_ITEMS = [
  {
    slug: "health-mix-powders",
    fallbackName: "Health Mix Powders",
    image: "/categories/cat-health-mix.jpg",
    description: "Nutrient-rich traditional health mixes for all ages.",
    alt: "Traditional brass bowl filled with nutritious health mix porridge garnished with nuts",
    icon: (
      <svg
        className="w-5 h-5 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22v-9" />
        <path d="M9 13a4 4 0 0 1 8 0c0 3-4 6-5 6s-5-3-5-6a4 4 0 0 1 2-3.46" />
        <path d="M12 8c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" />
        <path d="M12 11c0-2.8-2.2-5-5-5 0 2.8 2.2 5 5 5Z" />
      </svg>
    ),
  },
  {
    slug: "podi-varieties",
    fallbackName: "Podi Varieties",
    image: "/categories/cat-podi.jpg",
    description: "Authentic South Indian podis for everyday meals.",
    alt: "Brass bowl with authentic roasted podi powder served with dried red chillies and curry leaves",
    icon: (
      <svg
        className="w-5 h-5 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 11h18a8 8 0 0 1-16 0Z" />
        <path d="M14 4l-4 7" />
        <path d="M7 19h10" />
      </svg>
    ),
  },
  {
    slug: "masalas-and-powders",
    fallbackName: "Masalas & Powders",
    image: "/categories/cat-masalas.jpg",
    description: "Traditional spice blends for rich, homestyle flavour.",
    alt: "Bowls of ground red chilli, turmeric, and spice powders with cinnamon and whole coriander",
    icon: (
      <svg
        className="w-5 h-5 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4Z" />
        <path d="M6 14a3 3 0 0 1 3 3c0 2-3 5-3 5s-3-3-3-5a3 3 0 0 1 3-3Z" />
        <path d="M18 14a3 3 0 0 1 3 3c0 2-3 5-3 5s-3-3-3-5a3 3 0 0 1 3-3Z" />
      </svg>
    ),
  },
  {
    slug: "snacks",
    fallbackName: "Traditional Snacks",
    image: "/categories/cat-snacks.jpg",
    description: "Time-honoured snacks made the traditional way.",
    alt: "Handcrafted South Indian sesame ladoos, crunchy murukku, and spiced snacks",
    icon: (
      <svg
        className="w-5 h-5 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 14h16a7 7 0 0 1-14 0Z" />
        <circle cx="8.5" cy="9.5" r="2.5" />
        <circle cx="15.5" cy="9.5" r="2.5" />
        <circle cx="12" cy="6.5" r="2.5" />
      </svg>
    ),
  },
] as const;

export function CategoryBento({ categories }: CategoryBentoProps) {
  const categoryMap = new Map(categories.map((c) => [c.slug, c]));

  return (
    <section aria-labelledby="category-section-heading" className="relative w-full overflow-hidden">
      {/* Botanical leaf sprig at top-right matching reference */}
      <div className="absolute -top-4 -right-4 w-32 sm:w-44 lg:w-56 pointer-events-none select-none z-0">
        <Image
          src="/hero-leaves.png"
          alt=""
          width={200}
          height={175}
          className="w-full h-auto object-contain opacity-90 scale-x-[-1] rotate-12"
          aria-hidden="true"
        />
      </div>

      {/* Subtle gold line-art botanical accent on the left edge matching reference */}
      <div
        className="absolute top-1/4 -left-6 w-24 sm:w-32 pointer-events-none select-none opacity-30 z-0"
        aria-hidden="true"
      >
        <svg viewBox="0 0 100 160" fill="none" stroke="#D9C6AA" strokeWidth="1.2" className="w-full h-auto">
          <path d="M10 150 C 30 100, 20 60, 50 10" />
          <path d="M30 100 C 50 90, 70 95, 75 80 C 65 75, 45 85, 30 100" />
          <path d="M23 70 C 45 60, 60 62, 70 45 C 55 42, 38 52, 23 70" />
          <path d="M38 40 C 55 30, 65 28, 70 15 C 58 15, 45 25, 38 40" />
          <path d="M15 125 C 0 115, -10 118, -15 105 C -5 100, 5 110, 15 125" />
        </svg>
      </div>

      <div className="container-spn relative z-10">
        {/* Section Header: Eyebrow, Main Heading, Supporting Text, and Right-Aligned Link */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 sm:mb-10 lg:mb-12">
          <div className="max-w-2xl">
            <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2 sm:mb-2.5 block">
              CURATED COLLECTIONS
            </span>
            <h2
              id="category-section-heading"
              className="text-[32px] sm:text-[38px] lg:text-[44px] text-[#1A1614] leading-[1.1] font-normal tracking-[-0.025em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Shop by <br className="md:hidden" />Traditional Category
            </h2>
            <p className="font-[family-name:var(--font-body)] text-[14.5px] sm:text-[15.5px] text-[#635850] mt-2 sm:mt-2.5 leading-relaxed font-normal">
              Explore authentic staple categories &mdash; from morning porridge mixes to freshly ground spice podis.
            </p>
          </div>

          <Link
            href="/shop"
            prefetch={false}
            className="group inline-flex items-center gap-1.5 font-[family-name:var(--font-body)] text-[14px] sm:text-[14.5px] font-medium text-[#BF5330] hover:text-[#8F3E20] transition-colors shrink-0 self-start md:self-end pb-1"
          >
            <span className="underline decoration-[#BF5330]/40 underline-offset-4 group-hover:decoration-[#8F3E20]">
              Browse complete catalogue
            </span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>

        {/* Category Cards: Single column on mobile (<md), 2 columns on tablet (md), 4 columns on desktop (lg) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-stretch">
          {CATEGORY_ITEMS.map((item) => {
            const dbCategory = categoryMap.get(item.slug);
            const categoryName = dbCategory?.name || item.fallbackName;

            return (
              <Link
                key={item.slug}
                href={`/shop/${item.slug}`}
                prefetch={false}
                className="group flex flex-col bg-white rounded-[22px] border border-[#E8DFD4] hover:border-[#BF5330]/40 overflow-hidden shadow-[0_2px_10px_rgba(26,22,20,0.03)] hover:shadow-[0_12px_28px_rgba(26,22,20,0.08)] hover:-translate-y-1 transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] h-full"
              >
                {/* Image Top Area (4:3 aspect ratio) with Overlapping Category Icon */}
                <div className="relative w-full aspect-[4/3] bg-[#F5EFE8] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
                  />

                  {/* Circular Terracotta Category Icon overlapping the image boundary */}
                  <div
                    className="absolute -bottom-5 left-5 w-11 h-11 rounded-full bg-[#BF5330] border-2 border-white flex items-center justify-center text-white shadow-sm z-10 transition-transform duration-300 group-hover:scale-110"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </div>
                </div>

                {/* Card Content: Title, Description & Action */}
                <div className="flex flex-col flex-1 pt-7 px-5 pb-5 bg-white">
                  <h3
                    className="text-[25px] sm:text-[26px] lg:text-[27px] font-normal text-[#1A1614] group-hover:text-[#BF5330] transition-colors leading-[1.18] mb-2 tracking-[-0.015em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {categoryName}
                  </h3>

                  <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.55] mb-5 flex-1 font-normal">
                    {item.description}
                  </p>

                  {/* Navigation Action Row */}
                  <div className="flex items-center justify-between pt-2 mt-auto border-t border-[#F5EFE8]/80">
                    <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[#BF5330] group-hover:text-[#8F3E20] inline-flex items-center transition-colors">
                      Explore Products
                    </span>

                    <span
                      className="w-8 h-8 rounded-full bg-[#F5EFE8] text-[#BF5330] group-hover:bg-[#BF5330] group-hover:text-white flex items-center justify-center transition-all duration-200 shrink-0 shadow-2xs"
                      aria-hidden="true"
                    >
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </span>
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

export function CategoryBentoSkeleton() {
  return (
    <div className="container-spn py-8" aria-hidden="true">
      <div className="skeleton h-4 w-32 rounded mb-2" />
      <div className="skeleton h-8 w-64 rounded mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col bg-white rounded-[22px] border border-[#E8DFD4] overflow-hidden h-[390px]"
          >
            <div className="skeleton w-full aspect-[4/3]" />
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="skeleton h-7 w-3/4 rounded mb-3" />
                <div className="skeleton h-4 w-full rounded mb-2" />
                <div className="skeleton h-4 w-2/3 rounded" />
              </div>
              <div className="skeleton h-6 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
