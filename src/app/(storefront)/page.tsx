import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  Leaf,
  Clock,
  Sparkles,
} from "lucide-react";
import { fetchBestsellerProducts, fetchCategories, fetchProducts } from "@/lib/storefront/api";
import { CategoryBento, CategoryBentoSkeleton } from "@/components/catalogue/category-bento";
import { FeaturedProductsFilter } from "@/components/catalogue/featured-products-filter";
import { ProductGridSkeleton } from "@/components/catalogue/product-grid";
import { HeroSlider } from "@/components/home/hero-slider";

export const metadata: Metadata = {
  title: "SPN Health Mix — Traditional Indian Health Foods",
  description:
    "Traditional Indian health mixes, spice powders, podis, masalas and snacks. Packaged with care for modern households.",
  alternates: { canonical: "/" },
};

// Revalidate homepage data every 60 seconds
export const revalidate = 60;

async function BestsellersSection() {
  const { featured, all } = await fetchBestsellerProducts();

  if (featured.length === 0 && all.length === 0) return null;

  return <FeaturedProductsFilter featuredProducts={featured} allProducts={all} />;
}

async function CategoriesSection() {
  const { categories } = await fetchCategories();
  return <CategoryBento categories={categories} />;
}

export default async function HomePage() {
  const [{ categories }, { total: totalProducts }] = await Promise.all([
    fetchCategories(),
    fetchProducts({ limit: 1 }),
  ]);

  return (
    <div className="flex flex-col bg-[#FFFBF7]">
      {/* ── Section 1: Full-Width Auto-sliding Hero Carousel ─────────────────── */}
      <HeroSlider />

      {/* ── Section 2: Continuous Running Benefits Ticker ──────────────────── */}
      <section
        aria-label="Brand highlights"
        className="w-full bg-[#F7EFE6] border-y border-[var(--color-border)] py-3 sm:py-3.5 z-20 shrink-0 overflow-hidden relative select-none"
      >
          {/* Subtle edge fade gradients */}
          <div
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 sm:w-20 bg-gradient-to-r from-[#F7EFE6] to-transparent z-10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 sm:w-20 bg-gradient-to-l from-[#F7EFE6] to-transparent z-10"
            aria-hidden="true"
          />

          {/* Running Ticker Track */}
          <div className="flex overflow-hidden w-full">
            <div className="animate-marquee flex items-center">
              {[
                { icon: Leaf, label: "Heirloom Grain Blends" },
                { icon: Clock, label: "Slow-Roasted in Small Batches" },
                { icon: ShieldCheck, label: "Zero Artificial Preservatives" },
                { icon: Sparkles, label: "100% Pure & Natural" },
                { icon: Truck, label: "Direct Pan-India Delivery" },
                { icon: Leaf, label: "Heirloom Grain Blends" },
                { icon: Clock, label: "Slow-Roasted in Small Batches" },
                { icon: ShieldCheck, label: "Zero Artificial Preservatives" },
                { icon: Sparkles, label: "100% Pure & Natural" },
                { icon: Truck, label: "Direct Pan-India Delivery" },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={idx} className="flex items-center shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 pl-8 pr-6 sm:pl-12 sm:pr-10 py-0.5">
                      <Icon className="w-4 h-4 text-[var(--color-brand-primary)] shrink-0" aria-hidden="true" />
                      <span className="font-[family-name:var(--font-body)] text-[12.5px] sm:text-[13px] font-medium text-[var(--color-text-primary)] tracking-tight whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[var(--color-brand-primary)]/35 text-[10px] select-none pr-2 sm:pr-4" aria-hidden="true">
                      ✦
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      {/* ── Section 3: Shop by Traditional Category ────────────────────────── */}
      <div id="categories" className="py-12 sm:py-16 lg:py-20 bg-[var(--color-surface)]">
        <Suspense fallback={<CategoryBentoSkeleton />}>
          <CategoriesSection />
        </Suspense>
      </div>

      {/* ── Section 4: Featured Bestsellers ────────────────────────────────── */}
      <div id="featured" className="py-12 sm:py-16 lg:py-20 bg-[#FFFBF7]">
        <Suspense
          fallback={
            <div className="container-spn">
              <div className="skeleton h-4 w-32 rounded mb-2" />
              <div className="skeleton h-8 w-64 rounded mb-8" />
              <ProductGridSkeleton count={8} />
            </div>
          }
        >
          <BestsellersSection />
        </Suspense>
      </div>

      {/* ── Section 5: Heritage Story Section (Warm Editorial Layout matching ref.png) ──────── */}
      <section
        aria-labelledby="heritage-heading"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 overflow-hidden relative"
      >
        <div className="container-spn">
          <div className="relative rounded-[22px] sm:rounded-[26px] overflow-hidden border border-[#E8DFD4] bg-[#FAF4ED] shadow-[0_4px_24px_rgba(0,0,0,0.03)] w-full">
            <div className="flex flex-col lg:flex-row items-stretch w-full min-h-[380px] sm:min-h-[420px] lg:min-h-[440px] xl:min-h-[460px]">
              {/* Left Column: Authentic Food Photography (50% on desktop, full height) */}
              <div className="w-full lg:w-1/2 relative min-h-[280px] sm:min-h-[340px] lg:min-h-0 self-stretch overflow-hidden">
                <Image
                  src="/categories/health-mix.jpg"
                  alt="SPN Health Mix traditional porridge and wholesome heirloom ingredients in authentic brass bowl"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[center_60%] w-full h-full"
                />
                {/* Subtle right-edge soft blend into warm background on desktop */}
                <div
                  className="hidden lg:block absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-[#FAF4ED] pointer-events-none"
                  aria-hidden="true"
                />
              </div>

              {/* Right Column: Editorial Narrative & Botanical Art (50% on desktop) */}
              <div className="w-full lg:w-1/2 relative flex flex-col justify-center px-6 py-8 sm:px-9 sm:py-10 lg:px-10 lg:py-12 xl:px-14 xl:py-14 z-10">
                {/* Subtle botanical line art decoration on far right */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-32 sm:w-44 lg:w-52 pointer-events-none select-none text-[#C5B4A2]/30 lg:text-[#C5B4A2]/35 flex items-center justify-end overflow-hidden"
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 180 360"
                    fill="none"
                    stroke="currentColor"
                    className="w-full h-full object-contain object-right"
                    aria-hidden="true"
                  >
                    <path
                      d="M 160 10 Q 140 100 120 180 T 90 350"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Leaflet pair 1 */}
                    <path d="M 152 40 C 130 35 115 45 110 50 C 120 58 135 55 150 46" strokeWidth="1.1" />
                    <path d="M 150 44 L 115 48" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 155 35 C 165 20 180 15 185 20 C 180 30 170 35 157 37" strokeWidth="1.1" />
                    <path d="M 157 36 L 180 20" strokeWidth="0.8" opacity="0.7" />
                    {/* Leaflet pair 2 */}
                    <path d="M 143 80 C 115 70 95 80 85 90 C 100 100 125 95 140 85" strokeWidth="1.2" />
                    <path d="M 141 82 L 92 87" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 145 75 C 160 55 178 50 188 58 C 180 72 165 78 147 78" strokeWidth="1.2" />
                    <path d="M 146 76 L 182 56" strokeWidth="0.8" opacity="0.7" />
                    {/* Leaflet pair 3 */}
                    <path d="M 134 130 C 95 115 70 130 60 145 C 80 158 110 150 130 135" strokeWidth="1.3" />
                    <path d="M 132 132 L 68 141" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 136 120 C 155 95 180 90 190 102 C 180 120 160 128 138 125" strokeWidth="1.3" />
                    <path d="M 137 122 L 184 98" strokeWidth="0.8" opacity="0.7" />
                    {/* Leaflet pair 4 */}
                    <path d="M 124 185 C 80 170 50 188 40 205 C 62 220 98 210 120 192" strokeWidth="1.3" />
                    <path d="M 122 187 L 48 200" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 126 172 C 150 145 178 140 188 155 C 178 175 155 182 128 178" strokeWidth="1.3" />
                    <path d="M 127 174 L 182 150" strokeWidth="0.8" opacity="0.7" />
                    {/* Leaflet pair 5 */}
                    <path d="M 112 245 C 70 230 40 250 30 270 C 55 285 92 272 108 252" strokeWidth="1.3" />
                    <path d="M 110 247 L 38 265" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 114 230 C 140 200 170 198 180 215 C 168 238 142 242 116 235" strokeWidth="1.3" />
                    <path d="M 115 232 L 174 210" strokeWidth="0.8" opacity="0.7" />
                    {/* Leaflet pair 6 */}
                    <path d="M 100 305 C 65 292 38 312 30 330 C 52 344 85 330 96 312" strokeWidth="1.2" />
                    <path d="M 98 307 L 38 325" strokeWidth="0.8" opacity="0.7" />
                    <path d="M 102 290 C 128 262 158 260 166 278 C 152 298 128 300 104 294" strokeWidth="1.2" />
                    <path d="M 103 292 L 160 272" strokeWidth="0.8" opacity="0.7" />
                  </svg>
                </div>

                {/* Content Box with z-10 and balanced max-width */}
                <div className="relative z-10 w-full max-w-xl">
                  {/* Eyebrow */}
                  <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2 sm:mb-2.5 block">
                    Our Roots in Dharmapuri, Tamil Nadu
                  </span>

                  {/* Heading */}
                  <h2
                    id="heritage-heading"
                    className="text-2xl sm:text-3xl lg:text-[36px] xl:text-[40px] text-[#1A1614] leading-[1.16] tracking-[-0.015em] mb-3.5 sm:mb-4 font-normal"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Nourishment Rooted in Authentic Indian Tradition
                  </h2>

                  {/* Supporting paragraph */}
                  <p className="font-[family-name:var(--font-body)] text-[14px] sm:text-[14.5px] lg:text-[15px] text-[#635850] leading-[1.65] mb-6 sm:mb-7">
                    SPN Health Mix was founded on a simple principle: the recipes and nourishment passed down through traditional South Indian households represent one of the most balanced, enduring ways to feed a family.
                  </p>

                  {/* CTA Action */}
                  <div>
                    <Link
                      href="/about"
                      prefetch={false}
                      className="group inline-flex justify-center items-center gap-2 font-[family-name:var(--font-body)] font-medium text-[14px] text-white bg-[#BF5330] hover:bg-[#8F3E20] px-7 py-3 sm:py-3.5 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
                    >
                      <span>Our Heritage Story</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 6: Quality Commitment & Promotional Banner (Mobile-First Reference Design) ──── */}
      <section
        aria-labelledby="trust-heading"
        className="w-full bg-[#FFFBF7] border-t border-[#E8DFD4] pt-8 sm:pt-10 lg:pt-12 pb-12 sm:pb-16"
      >
        <div className="container-spn">
          {/* 1. Quality Commitment Header */}
          <div className="mb-6 sm:mb-8 max-w-2xl">
            <div className="flex items-center gap-3 mb-2 sm:mb-2.5">
              <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330]">
                STANDARDS &amp; INTEGRITY
              </span>
              <span className="w-10 sm:w-12 h-[1.5px] bg-[#BF5330]" aria-hidden="true" />
            </div>
            <h2
              id="trust-heading"
              className="text-2xl sm:text-3xl lg:text-[34px] xl:text-[38px] text-[#1A1614] leading-[1.18] font-normal mb-2.5 sm:mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              The SPN Foods Quality Commitment
            </h2>
            <p className="font-[family-name:var(--font-body)] text-[14px] sm:text-[15px] lg:text-[15.5px] text-[#635850] leading-relaxed">
              Clear, verified food preparation principles upheld across every recipe and batch.
            </p>
          </div>

          {/* 2. Four Quality Highlights: 2-column grid on mobile (2 rows), 4-column row on desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5 mb-8 sm:mb-10">
            {/* Card 1: Food Safety Standards */}
            <div className="bg-white rounded-[16px] sm:rounded-[18px] border border-[#EBE3DA] p-2.5 min-[360px]:p-3 sm:p-4.5 flex items-center gap-2 sm:gap-3.5 min-h-[76px] sm:min-h-[88px] shadow-[0_2px_8px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="w-8 h-8 min-[360px]:w-10 min-[360px]:h-10 sm:w-12 sm:h-12 rounded-full bg-[#FAF0E6] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-[#BF5330] stroke-[1.8]" aria-hidden="true" />
              </div>
              <span className="font-[family-name:var(--font-heading)] text-[11.5px] min-[360px]:text-[13px] sm:text-[14.5px] lg:text-[15.5px] text-[#1A1614] font-normal leading-[1.25]">
                Food Safety<br className="sm:hidden" /> Standards
              </span>
            </div>

            {/* Card 2: 100% Traditional Recipes */}
            <div className="bg-white rounded-[16px] sm:rounded-[18px] border border-[#EBE3DA] p-2.5 min-[360px]:p-3 sm:p-4.5 flex items-center gap-2 sm:gap-3.5 min-h-[76px] sm:min-h-[88px] shadow-[0_2px_8px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="w-8 h-8 min-[360px]:w-10 min-[360px]:h-10 sm:w-12 sm:h-12 rounded-full bg-[#FAF0E6] flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-[#BF5330] stroke-[1.8]" aria-hidden="true" />
              </div>
              <span className="font-[family-name:var(--font-heading)] text-[11.5px] min-[360px]:text-[13px] sm:text-[14.5px] lg:text-[15.5px] text-[#1A1614] font-normal leading-[1.25]">
                100% Traditional<br className="sm:hidden" /> Recipes
              </span>
            </div>

            {/* Card 3: Small-Batch Milling */}
            <div className="bg-white rounded-[16px] sm:rounded-[18px] border border-[#EBE3DA] p-2.5 min-[360px]:p-3 sm:p-4.5 flex items-center gap-2 sm:gap-3.5 min-h-[76px] sm:min-h-[88px] shadow-[0_2px_8px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="w-8 h-8 min-[360px]:w-10 min-[360px]:h-10 sm:w-12 sm:h-12 rounded-full bg-[#FAF0E6] flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-[#BF5330]"
                  aria-hidden="true"
                >
                  <path d="M4 11h16a7 7 0 0 1-14 0z" />
                  <path d="M8.5 18h7" />
                  <path d="M16 4.5l-5 6.5" />
                </svg>
              </div>
              <span className="font-[family-name:var(--font-heading)] text-[11.5px] min-[360px]:text-[13px] sm:text-[14.5px] lg:text-[15.5px] text-[#1A1614] font-normal leading-[1.25]">
                Small-Batch<br className="sm:hidden" /> Milling
              </span>
            </div>

            {/* Card 4: Pan-India Delivery */}
            <div className="bg-white rounded-[16px] sm:rounded-[18px] border border-[#EBE3DA] p-2.5 min-[360px]:p-3 sm:p-4.5 flex items-center gap-2 sm:gap-3.5 min-h-[76px] sm:min-h-[88px] shadow-[0_2px_8px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="w-8 h-8 min-[360px]:w-10 min-[360px]:h-10 sm:w-12 sm:h-12 rounded-full bg-[#FAF0E6] flex items-center justify-center shrink-0">
                <Truck className="w-4 h-4 min-[360px]:w-5 min-[360px]:h-5 sm:w-6 sm:h-6 text-[#BF5330] stroke-[1.8]" aria-hidden="true" />
              </div>
              <span className="font-[family-name:var(--font-heading)] text-[11.5px] min-[360px]:text-[13px] sm:text-[14.5px] lg:text-[15.5px] text-[#1A1614] font-normal leading-[1.25]">
                Pan-India<br className="sm:hidden" /> Delivery
              </span>
            </div>
          </div>

          {/* 3. Promotional Banner */}
          <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden bg-gradient-to-br from-[#B34522] via-[#BA4E2C] to-[#8C3417] text-white shadow-xs w-full">
            {/* Background image on right side with responsive opacity */}
            <div className="absolute right-0 top-0 bottom-0 w-[55%] sm:w-[50%] lg:w-[48%] overflow-hidden pointer-events-none select-none">
              <Image
                src="/categories/health-mix.jpg"
                alt="Authentic traditional ingredients"
                fill
                sizes="(max-width: 640px) 55vw, (max-width: 1024px) 50vw, 560px"
                className="object-cover object-right sm:object-[center_right] opacity-35 sm:opacity-50 lg:opacity-100"
              />
              {/* Subtle terracotta gradient blend from left edge of image */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#B34522] from-10% via-[#B34522]/85 sm:via-[#B34522]/70 to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* Narrative Content: Spans from left side to rightmost side across mobile screens */}
            <div className="relative z-10 p-5 min-[360px]:p-6 sm:p-8 lg:py-10 lg:pl-10 xl:pl-12 flex flex-col justify-center min-h-[220px] min-[360px]:min-h-[240px] sm:min-h-[280px] lg:min-h-[310px] w-full max-w-full lg:max-w-xl">
              <div className="flex items-center gap-2.5 sm:gap-3 mb-2 sm:mb-2.5">
                <span className="font-[family-name:var(--font-body)] text-[10px] min-[360px]:text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F7D8CC]">
                  TASTE THE TRADITION
                </span>
                <span className="w-8 sm:w-10 h-[1.5px] bg-[#F7D8CC]/80" aria-hidden="true" />
              </div>

              <h3
                id="cta-heading"
                className="text-[18px] min-[360px]:text-[20px] min-[390px]:text-[22px] sm:text-[26px] lg:text-[32px] xl:text-[36px] text-white font-normal leading-[1.2] mb-2 sm:mb-3 max-w-2xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Ready to bring authentic flavours to your table?
              </h3>

              <p className="font-[family-name:var(--font-body)] text-[12px] min-[360px]:text-[13px] sm:text-[14px] lg:text-[15px] text-[#FDEEE8] leading-relaxed mb-4 sm:mb-6 max-w-xl">
                Explore our complete range of traditional health mix powders and natural foods.
              </p>

              <div>
                <Link
                  href="/shop"
                  className="group inline-flex justify-center items-center gap-2 font-[family-name:var(--font-body)] font-semibold text-[12.5px] min-[360px]:text-[13px] sm:text-[14px] text-[#BF5330] bg-white hover:bg-[#FFFBF7] active:scale-[0.98] h-[38px] sm:h-[44px] px-4.5 sm:px-6 rounded-full shadow-xs hover:shadow transition-all duration-150 w-fit whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <span>Shop All Products</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-150 group-hover:translate-x-0.5 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
