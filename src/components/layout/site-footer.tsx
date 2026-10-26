import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, Leaf } from "lucide-react";
import type { CategoryCard } from "@/lib/storefront/types";
import type { BusinessSettings } from "@/lib/settings/types";

/* ── Social / Channel Icons ────────────────────────────────────────────────── */
function InstagramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

/* ── Category Icons matching reference artwork ────────────────────────────── */
function AllProductsIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function HealthMixIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 4 13C4 9.13 7.13 6 11 6c.4 0 .78.03 1.16.1A8 8 0 0 1 20 14c0 3.87-3.13 7-7 7" />
      <path d="M7 17l10-10" />
      <path d="M14 6c0 2.21-1.79 4-4 4" />
    </svg>
  );
}

function PodiIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11h18a8 8 0 0 1-16 0Z" />
      <path d="M8 7c0-1.5 1-2 1-3" />
      <path d="M12 7c0-1.5 1-2 1-3" />
      <path d="M16 7c0-1.5 1-2 1-3" />
      <path d="M7 19h10" />
    </svg>
  );
}

function MasalaIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9.5" r="1.2" fill="currentColor" />
      <circle cx="14.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="11.5" cy="14.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="13.5" r="1" fill="currentColor" />
      <circle cx="8" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function SnacksIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8" cy="14" r="5" />
      <circle cx="16" cy="11" r="5" />
      <circle cx="7" cy="13" r="0.6" fill="currentColor" />
      <circle cx="9" cy="15" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
      <circle cx="17" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

/* ── Help & Support Icons matching reference artwork ──────────────────────── */
function HeritageIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function SupportIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

function ShippingIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function RefundIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <polyline points="3 3 3 8 8 8" />
    </svg>
  );
}

function PrivacyIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ChevronRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface SiteFooterProps {
  categories?: CategoryCard[];
  settings?: BusinessSettings | null;
}

export function SiteFooter({ settings }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();
  const brandName =
    settings?.businessName && settings.businessName !== "SPN Foods"
      ? settings.businessName
      : "SPN Health Mix";
  const supportEmail = settings?.supportEmail || "spnhealthmix@gmail.com";
  const phoneFormatted = settings?.phone?.trim() || "+91 70949 38940";
  const addressLine1 = [
    settings?.address?.line1 || "No. 257, Vaguthupatti Village",
    settings?.address?.line2 || "Krishnapuram PT",
    settings?.address?.city || "Dharmapuri",
  ]
    .filter(Boolean)
    .join(", ");
  const stateAndPin = [
    settings?.address?.state || "Tamil Nadu",
    settings?.address?.pincode || "635202",
  ]
    .filter(Boolean)
    .join(", ");

  const categoryLinks = [
    { label: "All Products", href: "/shop", icon: AllProductsIcon },
    { label: "Health Mix Powders", href: "/shop/health-mix-powders", icon: HealthMixIcon },
    { label: "Podi Varieties", href: "/shop/podi-varieties", icon: PodiIcon },
    { label: "Masalas & Powders", href: "/shop/masalas-and-powders", icon: MasalaIcon },
    { label: "Traditional Snacks", href: "/shop/snacks", icon: SnacksIcon },
  ];

  const supportLinks = [
    { label: "About Our Heritage", href: "/about", icon: HeritageIcon },
    { label: "Contact Customer Support", href: "/contact", icon: SupportIcon },
    { label: "Shipping & Delivery Policy", href: "/shipping-policy", icon: ShippingIcon },
    {
      label: "Cancellation & Refund Policy",
      href: "/cancellation-refund-policy",
      icon: RefundIcon,
    },
    { label: "Privacy Policy", href: "/privacy-policy", icon: PrivacyIcon },
  ];

  return (
    <footer className="bg-[#FAF5EE] border-t border-[#E8DFD4] mt-auto text-[#4A3B32] relative overflow-hidden">
      {/* ── Botanical illustration accent (left edge) ───────────────────── */}
      <div
        className="absolute bottom-0 left-0 w-36 sm:w-48 lg:w-56 pointer-events-none select-none z-0 opacity-20 text-[#BF5330]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-auto">
          <path d="M10 190 C 40 140, 50 90, 80 30" />
          <path d="M40 140 C 20 120, 15 95, 30 85 C 45 85, 50 110, 40 140" />
          <path d="M50 115 C 75 105, 95 110, 95 95 C 80 90, 60 98, 50 115" />
          <path d="M60 85 C 45 65, 45 40, 60 35 C 75 40, 75 65, 60 85" />
          <path d="M70 60 C 95 50, 110 55, 110 40 C 95 40, 80 48, 70 60" />
          <path d="M80 30 C 80 15, 95 10, 100 15 C 100 28, 90 32, 80 30" />
        </svg>
      </div>

      {/* ── Botanical illustration accent (right edge) ──────────────────── */}
      <div
        className="absolute bottom-0 right-0 w-44 sm:w-56 lg:w-72 pointer-events-none select-none z-0 opacity-20 text-[#BF5330]"
        aria-hidden="true"
      >
        <svg viewBox="0 0 240 180" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-full h-auto">
          <path d="M60 100 Q 120 160 180 100 C 185 90 190 85 175 85 L 65 85 C 50 85 55 90 60 100 Z" />
          <path d="M85 145 L 155 145" strokeWidth="1.8" />
          <path d="M150 45 L 115 110" strokeWidth="2" strokeLinecap="round" />
          <path d="M165 80 C 190 60, 215 65, 225 50 C 215 70, 195 80, 175 85" />
          <path d="M175 85 C 205 80, 230 90, 235 80 C 225 95, 200 100, 180 92" />
        </svg>
      </div>

      {/* Main footer content */}
      <div className="container-spn py-12 lg:py-14 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 xl:gap-8 items-start">
          {/* ── Column 1: Brand (left) ─────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-3.5 pb-7 border-b border-[#E8DFD4]/70 md:border-b-0 md:pb-0">
            <Link
              href="/"
              className="inline-flex items-center gap-3 font-[family-name:var(--font-heading)] text-[22px] sm:text-[24px] text-[#BF5330] tracking-normal font-normal leading-none group"
            >
              <Image
                src="/logo.png"
                alt="SPN Health Mix Emblem"
                width={40}
                height={40}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-contain drop-shadow-2xs transition-transform duration-200 group-hover:scale-105"
              />
              <span>{brandName}</span>
            </Link>

            <p className="text-[13.5px] sm:text-[14px] text-[#5C4D44] leading-[1.65] max-w-sm font-[family-name:var(--font-body)]">
              {settings?.footerText?.trim() ||
                "Traditional Indian food crafted for modern households. Nutrient-dense health mixes, freshly roasted podis, and pure spices made with care."}
            </p>
          </div>

          {/* ── Column 2: Shop by Category (center-left) ───────────────── */}
          <div className="lg:col-span-3 pb-7 border-b border-[#E8DFD4]/70 md:border-b-0 md:pb-0">
            <h3 className="font-[family-name:var(--font-body)] font-bold text-[12px] text-[#BF5330] uppercase tracking-[0.16em]">
              SHOP BY CATEGORY
            </h3>
            <div className="w-7 h-[2px] bg-[#BF5330]/70 mt-1.5 mb-5 rounded-full" aria-hidden="true" />

            <ul className="space-y-3.5 font-[family-name:var(--font-body)]">
              {categoryLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="group flex items-center justify-between py-0.5 text-[#2A201B] hover:text-[#BF5330] transition-colors focus-visible:outline-2 focus-visible:outline-[#BF5330] rounded"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Icon className="w-5 h-5 text-[#BF5330] shrink-0" />
                        <span className="text-[14px] sm:text-[14.5px] font-medium truncate">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-[#BF5330] transition-transform duration-150 group-hover:translate-x-0.5 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Column 3: Help & Support (center-right) ────────────────── */}
          <div className="lg:col-span-3 pb-7 border-b border-[#E8DFD4]/70 md:border-b-0 md:pb-0">
            <h3 className="font-[family-name:var(--font-body)] font-bold text-[12px] text-[#BF5330] uppercase tracking-[0.16em]">
              HELP &amp; SUPPORT
            </h3>
            <div className="w-7 h-[2px] bg-[#BF5330]/70 mt-1.5 mb-5 rounded-full" aria-hidden="true" />

            <ul className="space-y-3.5 font-[family-name:var(--font-body)]">
              {supportLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      className="group flex items-center justify-between py-0.5 text-[#2A201B] hover:text-[#BF5330] transition-colors focus-visible:outline-2 focus-visible:outline-[#BF5330] rounded"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Icon className="w-5 h-5 text-[#BF5330] shrink-0" />
                        <span className="text-[14px] sm:text-[14.5px] font-medium truncate">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRightIcon className="w-3.5 h-3.5 text-[#BF5330] transition-transform duration-150 group-hover:translate-x-0.5 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Column 4: Contact & Follow Us (rightmost) ──────────────── */}
          <div className="lg:col-span-3 lg:border-l lg:border-[#E8DFD4] lg:pl-6 xl:pl-8">
            <h3 className="font-[family-name:var(--font-body)] font-bold text-[12px] text-[#BF5330] uppercase tracking-[0.16em]">
              CONTACT &amp; FOLLOW US
            </h3>
            <div className="w-7 h-[2px] bg-[#BF5330]/70 mt-1.5 mb-5 rounded-full" aria-hidden="true" />

            <div className="space-y-4 font-[family-name:var(--font-body)]">
              {/* Address */}
              <div className="flex items-start gap-3 text-[13px] text-[#4A3B32] leading-relaxed">
                <MapPin className="w-4.5 h-4.5 text-[#BF5330] shrink-0 mt-0.5" aria-hidden="true" />
                <p className="break-words">
                  <span>{addressLine1}, </span>
                  <br className="hidden md:inline" />
                  <span>{stateAndPin}</span>
                </p>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3 text-[13.5px] font-medium text-[#2A201B]">
                <Phone className="w-4.5 h-4.5 text-[#BF5330] shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${phoneFormatted.replace(/\s+/g, "")}`}
                  className="hover:text-[#BF5330] transition-colors"
                >
                  {phoneFormatted}
                </a>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3 text-[13.5px] font-medium text-[#2A201B]">
                <Mail className="w-4.5 h-4.5 text-[#BF5330] shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${supportEmail}`}
                  className="hover:text-[#BF5330] transition-colors break-words"
                >
                  {supportEmail}
                </a>
              </div>

              {/* Instagram link */}
              <div className="pt-1">
                <a
                  href={settings?.socialLinks?.instagram || "https://instagram.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between py-1 text-[#2A201B] hover:text-[#BF5330] transition-colors focus-visible:outline-2 focus-visible:outline-[#BF5330] rounded"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <InstagramIcon className="w-4.5 h-4.5 text-[#BF5330] shrink-0" />
                    <span className="text-[13.5px] sm:text-[14px] font-medium truncate">
                      Follow us on Instagram
                    </span>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[#BF5330] transition-transform duration-150 group-hover:translate-x-0.5 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Bar ──────────────────────────────────────────────── */}
        <div className="border-t border-[#E8DFD4] mt-10 lg:mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px] sm:text-[13.5px] font-[family-name:var(--font-body)] text-center sm:text-left relative z-10">
          <p className="text-[#635850]">
            &copy; {currentYear} {brandName}. All rights reserved.
          </p>

          <div className="flex items-center gap-1.5 text-[#BF5330] font-medium">
            <Leaf className="w-4 h-4 text-[#BF5330] shrink-0" aria-hidden="true" />
            <span>Handcrafted in Tamil Nadu</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
