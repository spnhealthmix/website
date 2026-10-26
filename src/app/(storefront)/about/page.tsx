import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "About SPN Health Mix — Authentic South Indian Food Heritage",
  description:
    "Bringing time-tested Indian food traditions, wholesome grains, and authentic health mixes into contemporary family kitchens.",
};

export default async function AboutPage() {
  const settings = await fetchBusinessSettings();

  const hasAddress =
    settings.address &&
    (settings.address.line1 || settings.address.city || settings.address.state);

  const addressLine1 = [
    settings.address?.line1 || "No. 257, Vaguthupatti Village",
    settings.address?.line2 || "Krishnapuram PT",
    settings.address?.city || "Dharmapuri",
  ]
    .filter(Boolean)
    .join(", ");

  const stateAndPin = [
    settings.address?.state || "Tamil Nadu",
    settings.address?.pincode ? `PIN: ${settings.address.pincode}` : "PIN: 635202",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="w-full bg-[#FFFBF7] min-h-screen">
      {/* ── Section 1: Hero — About SPN Health Mix ─────────────────────────── */}
      <section
        aria-labelledby="about-hero-heading"
        className="w-full bg-[#FFFBF7] pt-10 sm:pt-14 lg:pt-18 pb-10 sm:pb-14 lg:pb-16 overflow-hidden relative"
      >
        <div className="container-spn">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-10 xl:gap-14">
            {/* Left Narrative Block */}
            <div className="lg:col-span-6 relative flex flex-col justify-center z-10">
              {/* Subtle botanical line art decoration */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-48 sm:w-60 lg:w-72 h-full pointer-events-none select-none text-[#C5B4A2]/25 lg:text-[#C5B4A2]/30 flex items-center justify-end overflow-hidden"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 200 320"
                  fill="none"
                  stroke="currentColor"
                  className="w-full h-full object-contain object-right"
                  aria-hidden="true"
                >
                  <path d="M 190 20 Q 160 110 130 180 T 90 310" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M 180 50 C 150 45 130 60 120 70 C 135 80 155 75 175 60" strokeWidth="1.1" />
                  <path d="M 175 55 L 128 67" strokeWidth="0.8" opacity="0.7" />
                  <path d="M 185 45 C 195 25 210 20 215 25 C 205 38 195 45 180 47" strokeWidth="1.1" />
                  <path d="M 165 100 C 130 90 105 105 95 120 C 115 130 145 125 160 110" strokeWidth="1.2" />
                  <path d="M 160 105 L 102 118" strokeWidth="0.8" opacity="0.7" />
                  <path d="M 170 95 C 190 70 210 65 220 75 C 210 90 190 98 170 98" strokeWidth="1.2" />
                  <path d="M 150 160 C 105 145 75 165 65 185 C 90 198 125 188 145 170" strokeWidth="1.3" />
                  <path d="M 145 165 L 75 180" strokeWidth="0.8" opacity="0.7" />
                  <path d="M 155 150 C 180 120 210 115 220 130 C 205 150 180 158 155 155" strokeWidth="1.3" />
                  <path d="M 130 220 C 85 205 50 228 40 250 C 70 265 110 250 125 228" strokeWidth="1.3" />
                  <path d="M 125 225 L 50 245" strokeWidth="0.8" opacity="0.7" />
                  <path d="M 135 205 C 165 170 200 168 210 188 C 195 212 165 218 135 210" strokeWidth="1.3" />
                </svg>
              </div>

              {/* Eyebrow */}
              <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2.5 sm:mb-3 block">
                OUR HERITAGE &amp; MISSION
              </span>

              {/* Heading */}
              <h1
                id="about-hero-heading"
                className="text-3xl sm:text-4xl lg:text-[46px] xl:text-[50px] text-[#1A1614] leading-[1.12] tracking-[-0.02em] mb-4 sm:mb-5 font-normal"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                About SPN Health Mix
              </h1>

              {/* Supporting Copy */}
              <p className="font-[family-name:var(--font-body)] text-[15px] sm:text-[16px] text-[#635850] leading-[1.65] mb-7 sm:mb-8 max-w-lg">
                Bringing time-tested Indian food traditions, wholesome grains, and authentic health mixes into contemporary family kitchens.
              </p>

              {/* Primary CTA Button */}
              
            </div>

            {/* Right Food Photography */}
            <div className="lg:col-span-6 relative w-full">
              <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11] shadow-[0_6px_28px_rgba(42,24,16,0.06)] border border-[#E8DFD4] bg-[#FAF4ED]">
                <Image
                  src="/categories/health-mix.jpg"
                  alt="SPN Health Mix traditional porridge and wholesome heirloom ingredients in authentic brass bowl"
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  priority
                  className="object-cover object-[center_60%]"
                />
              </div>
            </div>
            <div>
                <Link
                  href="/shop"
                  className="group inline-flex justify-center items-center gap-2 font-[family-name:var(--font-body)] font-medium text-[14px] text-white bg-[#BF5330] hover:bg-[#8F3E20] px-7 py-3.5 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
                >
                  <span>Explore Our Products</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Our Story ─────────────────────────────────────────── */}
      <section
        aria-labelledby="our-story-heading"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 overflow-hidden relative border-t border-[#E8DFD4]/50"
      >
        <div className="container-spn">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-10 xl:gap-14">
            {/* Left Food & Ingredients Photography */}
            <div className="lg:col-span-6 relative w-full order-2 lg:order-1">
              <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11] shadow-[0_6px_28px_rgba(42,24,16,0.06)] border border-[#E8DFD4] bg-[#FAF4ED]">
                <Image
                  src="/categories/podi-varieties.jpg"
                  alt="Traditional South Indian grains, pulses, spices, and stone mortar pestle"
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover object-center"
                />
              </div>
            </div>

            {/* Right Story Narrative */}
            <div className="lg:col-span-6 relative flex flex-col justify-center order-1 lg:order-2 z-10">
              {/* Subtle botanical line art decoration */}
              <div
                className="absolute right-0 top-1/2 -translate-y-1/2 w-48 sm:w-56 lg:w-64 h-full pointer-events-none select-none text-[#C5B4A2]/25 lg:text-[#C5B4A2]/30 flex items-center justify-end overflow-hidden"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 180 320"
                  fill="none"
                  stroke="currentColor"
                  className="w-full h-full object-contain object-right"
                  aria-hidden="true"
                >
                  <path d="M 160 10 Q 140 100 120 180 T 90 310" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M 152 40 C 130 35 115 45 110 50 C 120 58 135 55 150 46" strokeWidth="1.1" />
                  <path d="M 143 80 C 115 70 95 80 85 90 C 100 100 125 95 140 85" strokeWidth="1.2" />
                  <path d="M 134 130 C 95 115 70 130 60 145 C 80 158 110 150 130 135" strokeWidth="1.3" />
                  <path d="M 124 185 C 80 170 50 188 40 205 C 62 220 98 210 120 192" strokeWidth="1.3" />
                  <path d="M 112 245 C 70 230 40 250 30 270 C 55 285 92 272 108 252" strokeWidth="1.3" />
                </svg>
              </div>

              {/* Eyebrow */}
              <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2.5 sm:mb-3 block">
                OUR STORY
              </span>

              {/* Heading */}
              <h2
                id="our-story-heading"
                className="text-2xl sm:text-3xl lg:text-[36px] xl:text-[40px] text-[#1A1614] leading-[1.18] tracking-[-0.015em] mb-4 sm:mb-5 font-normal"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Nourishing Generations with Real Food
              </h2>

              {/* Paragraphs */}
              <div className="space-y-4 font-[family-name:var(--font-body)] text-[14px] sm:text-[14.5px] lg:text-[15px] text-[#635850] leading-[1.68]">
                <p>
                  SPN Health Mix was founded on a simple belief: the recipes and nourishment passed down through traditional Indian households represent one of the most balanced, enduring ways to feed a family. In a world increasingly saturated with ultra-processed shortcuts and artificial fillers, we focus on authentic, recognizable ingredients.
                </p>
                <p>
                  Our products range from nutrient-dense health mixes (Sathu Maavu) to multi-grain porridges and regional staples. We select quality grains, pulses, and nuts, milling and roasting them in accordance with traditional preparation standards so that everyday cooking remains both nutritious and convenient.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Brand Principles ──────────────────────────────────── */}
      <section
        aria-labelledby="principles-heading"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 border-t border-[#E8DFD4]/50"
      >
        <div className="container-spn">
          {/* Eyebrow */}
          <span
            id="principles-heading"
            className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-6 sm:mb-7 block"
          >
            WHAT DEFINES SPN HEALTH MIX
          </span>

          {/* Three Feature Cards in one row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* Card 1: Authentic Heritage */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  {/* Stylized Grain Ear SVG */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-[#BF5330]"
                    aria-hidden="true"
                  >
                    <path d="M2 22 16 8" />
                    <path d="M3.5 12.5a3.5 3.5 0 0 1 5-5L11 10" />
                    <path d="M7 16a3.5 3.5 0 0 1 5-5l2.5 2.5" />
                    <path d="M10.5 19.5a3.5 3.5 0 0 1 5-5L18 17" />
                    <path d="M12 4a3.5 3.5 0 0 1 5 5l-2.5 2.5" />
                    <path d="M15.5 7.5a3.5 3.5 0 0 1 5 5L18 15" />
                  </svg>
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Authentic Heritage
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                Formulated using traditional grain combinations celebrated for sustained energy and daily balance.
              </p>
            </div>

            {/* Card 2: Clean Ingredients */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  {/* Clean Ingredients Bowl SVG */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-[#BF5330]"
                    aria-hidden="true"
                  >
                    <path d="M4 11h16a1 1 0 0 1 1 1c0 5-4 9-9 9s-9-4-9-9a1 1 0 0 1 1-1z" />
                    <path d="M8 11V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5" />
                    <line x1="2" y1="11" x2="22" y2="11" />
                  </svg>
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Clean Ingredients
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                Whole grains, pulses, and spices. We avoid artificial coloring, synthetic flavors, and unnecessary additives.
              </p>
            </div>

            {/* Card 3: Made for Modern Lives */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  {/* Mortar & Pestle Preparation SVG */}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-[#BF5330]"
                    aria-hidden="true"
                  >
                    <path d="m19 4-3-2-7 7" />
                    <path d="M4 11h16a1 1 0 0 1 1 1c0 5-4 9-9 9s-9-4-9-9a1 1 0 0 1 1-1z" />
                    <line x1="2" y1="11" x2="22" y2="11" />
                  </svg>
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Made for Modern Lives
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                Packaged securely for freshness, allowing busy parents and professionals to prepare real food in minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Business Information ──────────────────────────────── */}
      <section
        aria-labelledby="official-details-heading"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 border-t border-[#E8DFD4]/50"
      >
        <div className="container-spn">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-10 xl:gap-14">
            {/* Left Column: Official Business Details */}
            <div className="lg:col-span-6 relative flex flex-col justify-center">
              {/* Eyebrow */}
              <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2 sm:mb-2.5 block">
                BUSINESS INFORMATION
              </span>

              {/* Heading */}
              <h2
                id="official-details-heading"
                className="text-2xl sm:text-3xl lg:text-[36px] text-[#1A1614] leading-[1.18] tracking-[-0.015em] mb-2 font-normal"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Official Details
              </h2>

              {/* Supporting Text */}
              <p className="font-[family-name:var(--font-body)] text-[14px] sm:text-[14.5px] text-[#635850] leading-relaxed">
                Official business details and communication points for SPN Health Mix.
              </p>

              {/* Clean Information Card */}
              <div className="mt-6 rounded-[16px] md:rounded-[18px] bg-[#FAF4ED] border border-[#E8DFD4] p-5 md:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] grid grid-cols-1 md:grid-cols-2 gap-y-4 md:gap-y-5 md:gap-x-8">
                {/* 1. Brand / Operating Name */}
                <div className="w-full pb-4 md:pb-5 border-b border-[#E8DFD4]/80">
                  <span className="font-[family-name:var(--font-body)] font-semibold text-[#8C7E72] uppercase tracking-[0.14em] block text-[10.5px] md:text-[11px] mb-1">
                    BRAND / OPERATING NAME
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[14.5px] md:text-[15px] font-semibold text-[#1A1614] block">
                    {settings.businessName}
                  </span>
                </div>

                {/* 2. GSTIN */}
                <div className="w-full pb-4 md:pb-5 border-b border-[#E8DFD4]/80">
                  <span className="font-[family-name:var(--font-body)] font-semibold text-[#8C7E72] uppercase tracking-[0.14em] block text-[10.5px] md:text-[11px] mb-1">
                    GSTIN
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[14px] md:text-[14.5px] font-medium text-[#1A1614] tracking-wide block">
                    {settings.gstin || "33GACPM7047B1ZZ"}
                  </span>
                </div>

                {/* 3. FSSAI Registration Number */}
                <div className="w-full pb-4 md:pb-5 border-b border-[#E8DFD4]/80">
                  <span className="font-[family-name:var(--font-body)] font-semibold text-[#8C7E72] uppercase tracking-[0.14em] block text-[10.5px] md:text-[11px] mb-1">
                    FSSAI REGISTRATION NUMBER
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[14px] md:text-[14.5px] font-medium text-[#1A1614] tracking-wide block">
                    {settings.fssaiNumber || "22425032000829"}
                  </span>
                </div>

                {/* 4. Customer Inquiries & Support (email) */}
                <div className="w-full min-w-0 pb-4 md:pb-5 border-b border-[#E8DFD4]/80">
                  <span className="font-[family-name:var(--font-body)] font-semibold text-[#8C7E72] uppercase tracking-[0.14em] block text-[10.5px] md:text-[11px] mb-1">
                    CUSTOMER INQUIRIES &amp; SUPPORT
                  </span>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="font-[family-name:var(--font-body)] text-[14.5px] md:text-[15px] font-medium text-[#BF5330] hover:text-[#8F3E20] hover:underline transition-colors block break-normal [overflow-wrap:anywhere]"
                  >
                    {settings.supportEmail}
                  </a>
                </div>

                {/* 5. Operating Address */}
                <div className="w-full md:col-span-2">
                  <span className="font-[family-name:var(--font-body)] font-semibold text-[#8C7E72] uppercase tracking-[0.14em] block text-[10.5px] md:text-[11px] mb-1">
                    OPERATING ADDRESS
                  </span>
                  <p className="font-[family-name:var(--font-body)] text-[13.5px] md:text-[14px] text-[#4A3B32] leading-relaxed break-words">
                    <span>{addressLine1}, </span>
                    <br className="hidden md:inline" />
                    <span>{stateAndPin}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Supporting Food Photography */}
            <div className="lg:col-span-6 relative w-full">
              <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11] shadow-[0_6px_28px_rgba(42,24,16,0.06)] border border-[#E8DFD4] bg-[#FAF4ED]">
                <Image
                  src="/categories/masalas-and-powders.jpg"
                  alt="Authentic traditional spices, grains, and kitchen pantry items"
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: Closing CTA Banner ────────────────────────────────── */}
      <section
        aria-labelledby="cta-heading"
        className="w-full bg-[#FFFBF7] pb-12 sm:pb-16 lg:pb-20 pt-2 sm:pt-4"
      >
        <div className="container-spn">
          <div className="relative rounded-[20px] sm:rounded-[24px] bg-gradient-to-r from-[#BF5330] via-[#BA4E2C] to-[#993E20] text-white overflow-hidden shadow-xs">
            {/* Background delicate leaf watermark */}
            <div
              className="absolute left-[36%] lg:left-[40%] top-1/2 -translate-y-1/2 w-48 h-48 opacity-15 pointer-events-none select-none text-white hidden md:block"
              aria-hidden="true"
            >
              <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M 80 10 Q 50 50 30 90" />
                <path d="M 65 30 C 45 25 35 35 30 40 C 40 48 55 45 65 30" />
                <path d="M 50 50 C 30 45 20 55 15 60 C 25 68 40 65 50 50" />
                <path d="M 70 25 C 85 15 95 20 98 25 C 92 35 80 32 70 25" />
                <path d="M 55 45 C 70 35 80 40 85 45 C 78 55 65 52 55 45" />
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 items-center relative z-10 min-h-[170px] sm:min-h-[180px] lg:min-h-[190px]">
              {/* Left Narrative Block */}
              <div className="md:col-span-7 lg:col-span-7 xl:col-span-7 p-6 sm:p-8 lg:p-10 xl:p-12 flex flex-col justify-center">
                <span className="font-[family-name:var(--font-body)] text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F7D8CC] mb-2 block">
                  TASTE THE TRADITION
                </span>
                <h2
                  id="cta-heading"
                  className="text-[22px] sm:text-[26px] lg:text-[30px] xl:text-[34px] text-white font-normal leading-[1.2] mb-2.5 max-w-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Bring the Taste of Tradition to Your Table
                </h2>
                <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14.5px] text-white/90 mb-5 sm:mb-6 max-w-lg leading-relaxed font-normal">
                  Explore our range of health mixes, podis, masalas, and traditional snacks.
                </p>
                <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
                  <Link
                    href="/shop"
                    className="group inline-flex justify-center items-center gap-1.5 font-[family-name:var(--font-body)] font-semibold text-[13px] sm:text-[13.5px] text-[#BF5330] bg-white hover:bg-[#FFFBF7] h-[40px] sm:h-[42px] px-6 sm:px-7 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
                  >
                    <span>Explore Our Products</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/contact"
                    prefetch={false}
                    className="inline-flex justify-center items-center font-[family-name:var(--font-body)] font-medium text-[13px] sm:text-[13.5px] text-white border border-white/50 hover:border-white hover:bg-white/10 h-[40px] sm:h-[42px] px-5 sm:px-6 rounded-full transition-all duration-150"
                  >
                    Contact Our Team
                  </Link>
                </div>
              </div>

              {/* Right Food Composition */}
              <div className="hidden md:block md:col-span-5 lg:col-span-5 xl:col-span-5 absolute right-0 top-0 bottom-0 w-[42%] lg:w-[45%] xl:w-[48%] overflow-hidden pointer-events-none select-none">
                <Image
                  src="/categories/health-mix.jpg"
                  alt="Authentic traditional ingredients"
                  fill
                  sizes="(max-width: 1024px) 45vw, 560px"
                  className="object-cover object-[center_65%]"
                />
                {/* Subtle gradient feathering from terracotta banner */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-[#BF5330] via-[#BF5330]/35 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
