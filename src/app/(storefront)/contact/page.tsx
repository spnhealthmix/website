import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  MapPin,
  Clock,
  Package,
  Truck,
  ShoppingCart,
  Leaf,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Contact SPN Health Mix — Customer Support & Order Assistance",
  description:
    "We are here to assist you with order status, product ingredients, fulfillment, and customer inquiries.",
};

export default async function ContactPage() {
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
      {/* ── Section 1: Hero — Contact SPN Health Mix ───────────────────────── */}
      <section
        aria-labelledby="contact-hero-heading"
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
                CUSTOMER SUPPORT
              </span>

              {/* Heading */}
              <h1
                id="contact-hero-heading"
                className="text-3xl sm:text-4xl lg:text-[46px] xl:text-[50px] text-[#1A1614] leading-[1.12] tracking-[-0.02em] mb-4 sm:mb-5 font-normal"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Contact SPN Health Mix
              </h1>

              {/* Supporting Copy */}
              <p className="font-[family-name:var(--font-body)] text-[15px] sm:text-[16px] text-[#635850] leading-[1.65] max-w-lg">
                We are here to assist you with order status, product ingredients, fulfillment, and customer inquiries.
              </p>
            </div>

            {/* Right Food Photography */}
            <div className="lg:col-span-6 relative w-full">
              <div className="relative rounded-[20px] sm:rounded-[24px] overflow-hidden aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/3] xl:aspect-[16/11] shadow-[0_6px_28px_rgba(42,24,16,0.06)] border border-[#E8DFD4] bg-[#FAF4ED]">
                <Image
                  src="/categories/health-mix.jpg"
                  alt="Traditional South Indian grains, seeds, and brassware in authentic kitchen setting"
                  fill
                  sizes="(max-width: 1024px) 100vw, 640px"
                  priority
                  className="object-cover object-[center_60%]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Main Contact Information & Order Help ──────────────── */}
      <section
        aria-label="Support Channels and Order Tracking"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 border-t border-[#E8DFD4]/50"
      >
        <div className="container-spn">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* Left Card: Reach Our Team */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-8 lg:p-9 shadow-[0_2px_12px_rgba(42,24,16,0.02)] flex flex-col justify-between">
              <div>
                <h2
                  className="text-2xl sm:text-[26px] text-[#1A1614] font-normal leading-tight mb-2.5"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Reach Our Team
                </h2>
                <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.6] mb-6">
                  For customer orders, billing, product queries, or any other assistance, you can reach us through the following channels.
                </p>

                {/* Information Rows */}
                <div className="space-y-5">
                  {/* Row 1: Email Support */}
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-[10px] bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                      <Mail className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="font-[family-name:var(--font-body)] min-w-0 flex-1">
                      <h3 className="text-[15px] sm:text-[15.5px] font-normal text-[#1A1614]">
                        Email Support
                      </h3>
                      <p className="text-[13px] text-[#635850] mt-0.5">
                        For customer orders, billing, and product queries:
                      </p>
                      <a
                        href={`mailto:${settings.supportEmail || "spnhealthmix@gmail.com"}`}
                        className="inline-block mt-1 text-[14px] font-medium text-[#BF5330] hover:text-[#8F3E20] hover:underline break-all sm:break-normal transition-colors"
                      >
                        {settings.supportEmail || "spnhealthmix@gmail.com"}
                      </a>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
                        <span className="text-[#635850]">Phone:</span>
                        <a
                          href="tel:+917094938940"
                          className="font-medium text-[#1A1614] hover:text-[#BF5330] hover:underline transition-colors"
                        >
                          +91 70949 38940
                        </a>
                        <span className="text-[#D6C7BA] select-none">/</span>
                        <a
                          href="tel:+916382674529"
                          className="font-medium text-[#1A1614] hover:text-[#BF5330] hover:underline transition-colors"
                        >
                          +91 63826 74529
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Operating Address */}
                  <div className="flex items-start gap-4 pt-4 border-t border-[#E8DFD4]/60">
                    <div className="w-11 h-11 rounded-[10px] bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                      <MapPin className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="font-[family-name:var(--font-body)]">
                      <h3 className="text-[15px] sm:text-[15.5px] font-normal text-[#1A1614]">
                        Operating Address
                      </h3>
                      <p className="text-[13px] sm:text-[13.5px] text-[#4A3B32] mt-1 leading-relaxed">
                        <span>{addressLine1}, </span>
                        <br className="hidden md:inline" />
                        <span>{stateAndPin}</span>
                      </p>
                    </div>
                  </div>

                  {/* Row 3: Response Time */}
                  <div className="flex items-start gap-4 pt-4 border-t border-[#E8DFD4]/60">
                    <div className="w-11 h-11 rounded-[10px] bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="font-[family-name:var(--font-body)]">
                      <h3 className="text-[15px] sm:text-[15.5px] font-normal text-[#1A1614]">
                        Response Time
                      </h3>
                      <p className="text-[13px] text-[#635850] mt-0.5 leading-relaxed">
                        Emails are reviewed during standard working hours. We aim to respond to order and product inquiries as quickly as possible.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card: Looking for Your Order? */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-8 lg:p-9 shadow-[0_2px_12px_rgba(42,24,16,0.02)] flex flex-col justify-between">
              <div>
                {/* Header with Package Icon */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="w-9 h-9 rounded-[8px] bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center text-[#BF5330] shrink-0">
                    <Package className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h2
                    className="text-2xl sm:text-[26px] text-[#1A1614] font-normal leading-tight"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Looking for Your Order?
                  </h2>
                </div>

                <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65] mb-5">
                  If you have already placed an order with SPN Health Mix, your dispatch status, tracking number (AWB), courier name, and itemized receipt are accessible directly in your account portal.
                </p>

                {/* Softly Tinted Order Guidance Box */}
                <div className="p-4 sm:p-5 rounded-[12px] bg-[#F4EDE5] border border-[#E8DFD4] text-[12.5px] sm:text-[13px] text-[#4A3B32] font-[family-name:var(--font-body)] space-y-2 mb-6">
                  <p className="font-semibold text-[#1A1614]">
                    When contacting us about an order:
                  </p>
                  <p className="leading-relaxed">
                    &bull; Please include your <strong>Order Reference ID</strong> (e.g., SPN-XXXXXX).
                  </p>
                  <p className="leading-relaxed">
                    &bull; State the registered email address used during checkout.
                  </p>
                  <p className="leading-relaxed">
                    &bull; If reporting transit issues, courier updates are synced in real time on your order tracking page.
                  </p>
                </div>

                {/* Main Order CTA */}
                <div>
                  <Link
                    href="/account/orders"
                    className="group inline-flex justify-center items-center gap-2 font-[family-name:var(--font-body)] font-medium text-[14px] text-white bg-[#BF5330] hover:bg-[#8F3E20] px-7 py-3 sm:py-3.5 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
                  >
                    <span>View My Orders</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* Shipping Assistance Row */}
              <div className="pt-6 mt-6 border-t border-[#E8DFD4]/80 flex items-start gap-3.5 font-[family-name:var(--font-body)]">
                <div className="w-9 h-9 rounded-[8px] bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center text-[#BF5330] shrink-0 mt-0.5">
                  <Truck className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[#1A1614]">
                    Shipping &amp; Delivery
                  </h3>
                  <p className="text-[12.5px] sm:text-[13px] text-[#635850] mt-0.5 leading-relaxed">
                    For delivery timelines, shipping locations, and related queries, please refer to our Shipping Policy.
                  </p>
                  <Link
                    href="/shipping-policy"
                    className="inline-block mt-1.5 text-[12.5px] sm:text-[13px] font-medium text-[#BF5330] hover:text-[#8F3E20] hover:underline transition-colors"
                  >
                    Read our Shipping Policy &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: How We Can Help ───────────────────────────────────── */}
      <section
        aria-labelledby="how-we-can-help-heading"
        className="w-full bg-[#FFFBF7] py-10 sm:py-14 lg:py-16 border-t border-[#E8DFD4]/50"
      >
        <div className="container-spn">
          {/* Eyebrow */}
          <span className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#BF5330] mb-2 sm:mb-2.5 block">
            HERE TO SUPPORT YOU
          </span>

          {/* Heading */}
          <h2
            id="how-we-can-help-heading"
            className="text-2xl sm:text-3xl lg:text-[36px] text-[#1A1614] leading-[1.18] tracking-[-0.015em] mb-6 sm:mb-8 font-normal"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            How We Can Help
          </h2>

          {/* Three Assistance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
            {/* Card 1: Order Support */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Order Support
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                Get help with order status, tracking details, and delivery-related queries.
              </p>
            </div>

            {/* Card 2: Product Information */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  <Leaf className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Product Information
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                Ask us about ingredients, usage, available pack sizes, or product suitability.
              </p>
            </div>

            {/* Card 3: General Assistance */}
            <div className="rounded-[18px] sm:rounded-[20px] bg-[#FAF4ED] border border-[#E8DFD4] p-6 sm:p-7 shadow-[0_2px_12px_rgba(42,24,16,0.02)] transition-all hover:border-[#D6C7BA]">
              <div className="flex items-center gap-3.5 sm:gap-4 mb-3.5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F5EBE1] border border-[#E8DFD4] flex items-center justify-center shrink-0 text-[#BF5330]">
                  <Headphones className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3
                  className="text-[20px] sm:text-[22px] lg:text-[23px] text-[#1A1614] font-normal leading-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  General Assistance
                </h3>
              </div>
              <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14px] text-[#635850] leading-[1.65]">
                We’re here for any other questions or suggestions to help you have a better experience with SPN Health Mix.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Closing CTA Banner ────────────────────────────────── */}
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
                  HERE TO SUPPORT YOU
                </span>
                <h2
                  id="cta-heading"
                  className="text-[22px] sm:text-[26px] lg:text-[30px] xl:text-[34px] text-white font-normal leading-[1.2] mb-2.5 max-w-xl"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Still Have a Question?
                </h2>
                <p className="font-[family-name:var(--font-body)] text-[13.5px] sm:text-[14.5px] text-white/90 mb-5 sm:mb-6 max-w-lg leading-relaxed font-normal">
                  We’re here to help and usually respond as quickly as possible.
                </p>
                <div>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="group inline-flex justify-center items-center gap-1.5 font-[family-name:var(--font-body)] font-semibold text-[13px] sm:text-[13.5px] text-[#BF5330] bg-white hover:bg-[#FFFBF7] h-[40px] sm:h-[42px] px-6 sm:px-7 rounded-full shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
                  >
                    <span>Contact Our Team</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                  </a>
                </div>
              </div>

              {/* Right Food Composition */}
              <div className="hidden md:block md:col-span-5 lg:col-span-5 xl:col-span-5 absolute right-0 top-0 bottom-0 w-[42%] lg:w-[45%] xl:w-[48%] overflow-hidden pointer-events-none select-none">
                <Image
                  src="/categories/health-mix.jpg"
                  alt="Authentic traditional spices, grains, and herbs"
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
