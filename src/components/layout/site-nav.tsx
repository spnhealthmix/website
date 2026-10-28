"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Menu, Search, ShoppingBag, User, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import { AccountDropdown } from "@/components/layout/account-dropdown";
import { FloatingCartButton } from "@/components/layout/floating-cart-button";
import type { CategoryCard } from "@/lib/storefront/types";

const MORE_LINKS = [
  { label: "Contact Support", href: "/contact" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Cancellation & Refund Policy", href: "/cancellation-refund-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
] as const;

interface SiteNavProps {
  categories: CategoryCard[];
}

export function SiteNav({ categories }: SiteNavProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const handler = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isScrolled = window.scrollY > 80;
          setScrolled((prev) => (prev !== isScrolled ? isScrolled : prev));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Close drawer and dropdowns on route change (bail out if already closed)
  useEffect(() => {
    setDrawerOpen((prev) => (prev ? false : prev));
    setMoreOpen((prev) => (prev ? false : prev));
    setMobileMoreOpen((prev) => (prev ? false : prev));
  }, [pathname]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    const onOutside = (e: MouseEvent) => {
      if (
        moreOpen &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(e.target as Node) &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [moreOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const { itemCount } = useCart();

  const isHomeActive = pathname === "/";
  const isShopActive = pathname === "/shop";
  const isComboOffersActive = pathname === "/combo-offers";
  const isAboutActive = pathname === "/about";
  const isMoreActive = MORE_LINKS.some((l) => pathname === l.href);

  return (
    <>
      {/* ── Main Nav Bar ───────────────────────────────────────────────────── */}
      <header
        role="banner"
        className={cn(
          "sticky top-0 left-0 right-0 z-40 transition-colors duration-200",
          scrolled
            ? "bg-white/95 backdrop-blur-md border-b border-[var(--color-border)] shadow-[var(--shadow-xs)]"
            : "bg-[#FFFBF7] border-b border-transparent"
        )}
      >
        <div className="container-spn relative h-[62px] lg:h-[68px] flex items-center justify-between gap-1 xs:gap-2 sm:gap-4 px-1 min-[360px]:px-2 sm:px-4 md:px-6">
          {/* 1. Left: Mobile hamburger menu (fixed at far-left on mobile, hidden on lg+) */}
          <div className="flex items-center justify-start w-9 xs:w-10 shrink-0 lg:hidden">
            <button
              className="flex items-center justify-center h-9 w-9 xs:h-10 xs:w-10 rounded-[6px] hover:bg-[var(--color-surface-sunken)] active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] shrink-0"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              <Menu className="h-5 w-5 text-[var(--color-text-primary)]" aria-hidden />
            </button>
          </div>

          {/* 2. Middle (Mobile) / Left (Desktop): Centered brand section on mobile, left-aligned on desktop */}
          <div className="absolute left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-88px)] min-w-0 flex items-center justify-center lg:static lg:translate-x-0 lg:left-auto lg:w-auto lg:max-w-none lg:justify-start lg:flex-none lg:shrink-0">
            <Link
              href="/"
              prefetch={false}
              className="flex flex-col items-center justify-center text-center min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] rounded group"
              aria-label="SPN Health Mix — Home"
            >
              {/* Mobile brand block (<lg): Logo and title on row 1, Tamil tagline directly underneath */}
              <div className="flex flex-col items-center justify-center text-center min-w-0 lg:hidden">
                {/* Row 1: Logo and Title side-by-side, centered together */}
                <div className="flex items-center justify-center gap-1.5 min-[360px]:gap-2">
                  <Image
                    src="/logo.png"
                    alt="SPN Health Mix Emblem"
                    width={38}
                    height={38}
                    priority
                    className="w-5 h-5 min-[360px]:w-6 min-[360px]:h-6 sm:w-7 sm:h-7 rounded-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-105 shrink-0"
                  />
                  <span className="font-[family-name:var(--font-logo)] text-[13.5px] min-[360px]:text-[15px] sm:text-[18px] text-[var(--color-brand-primary)] tracking-tight font-bold leading-tight whitespace-nowrap">
                    SPN Health Mix
                  </span>
                </div>

                {/* Row 2: Complete Tamil tagline directly underneath, centered */}
                <span className="font-[family-name:var(--font-tamil)] text-[7px] min-[360px]:text-[8px] sm:text-[9.5px] text-[#6B5A4E] font-bold tracking-tight mt-0.5 whitespace-nowrap leading-tight">
                  அன்பும் அக்கறையும் நிறைந்த ஆரோக்கியம்
                </span>
              </div>

              {/* Desktop brand block (lg+): Preserved exact original desktop layout */}
              <div className="hidden lg:flex items-center gap-2.5 min-w-0">
                <Image
                  src="/logo.png"
                  alt="SPN Health Mix Emblem"
                  width={38}
                  height={38}
                  priority
                  className="w-[38px] h-[38px] rounded-full object-contain drop-shadow-xs transition-transform duration-200 group-hover:scale-105 shrink-0"
                />
                <div className="flex flex-col leading-none min-w-0">
                  <span className="font-[family-name:var(--font-logo)] text-[21px] text-[var(--color-brand-primary)] tracking-tight font-bold leading-tight whitespace-nowrap">
                    SPN Health Mix
                  </span>
                  <span className="font-[family-name:var(--font-tamil)] text-[10.5px] text-[#6B5A4E] font-bold mt-0.5 whitespace-nowrap">
                    அன்பும் அக்கறையும் நிறைந்த ஆரோக்கியம்
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop center nav: Horizontally centered in available space between brand and actions */}
          <nav
            className="hidden lg:flex lg:flex-1 items-center justify-center lg:mx-2 xl:mx-6 min-w-0 gap-3.5 lg:gap-4 xl:gap-6 2xl:gap-7"
            aria-label="Primary navigation"
          >
            <Link
              href="/"
              prefetch={false}
              className={cn(
                "whitespace-nowrap font-[family-name:var(--font-body)] text-[14px] xl:text-[15px] font-medium transition-colors hover:text-[var(--color-brand-primary)] rounded-[4px] px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                isHomeActive
                  ? "text-[var(--color-brand-primary)] font-semibold"
                  : "text-[var(--color-text-primary)]"
              )}
            >
              Home
            </Link>

            <Link
              href="/shop"
              className={cn(
                "whitespace-nowrap font-[family-name:var(--font-body)] text-[14px] xl:text-[15px] font-medium transition-colors hover:text-[var(--color-brand-primary)] rounded-[4px] px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                isShopActive
                  ? "text-[var(--color-brand-primary)] font-semibold"
                  : "text-[var(--color-text-primary)]"
              )}
            >
              Shop
            </Link>

            <Link
              href="/combo-offers"
              className={cn(
                "whitespace-nowrap font-[family-name:var(--font-body)] text-[14px] xl:text-[15px] font-medium transition-colors hover:text-[var(--color-brand-primary)] rounded-[4px] px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                isComboOffersActive
                  ? "text-[var(--color-brand-primary)] font-semibold"
                  : "text-[var(--color-text-primary)]"
              )}
            >
              Combo Offers
            </Link>

            {/* About Us link */}
            <Link
              href="/about"
              className={cn(
                "whitespace-nowrap font-[family-name:var(--font-body)] text-[14px] xl:text-[15px] font-medium transition-colors hover:text-[var(--color-brand-primary)] rounded-[4px] px-1 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                isAboutActive
                  ? "text-[var(--color-brand-primary)] font-semibold"
                  : "text-[var(--color-text-primary)]"
              )}
            >
              About Us
            </Link>

            {/* More dropdown */}
            <div className="relative shrink-0">
              <button
                ref={moreButtonRef}
                className={cn(
                  "whitespace-nowrap inline-flex items-center gap-1 font-[family-name:var(--font-body)] text-[14px] xl:text-[15px] font-medium transition-colors hover:text-[var(--color-brand-primary)] py-2 px-1 rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                  isMoreActive || moreOpen
                    ? "text-[var(--color-brand-primary)] font-semibold"
                    : "text-[var(--color-text-primary)]"
                )}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-controls="more-dropdown"
                onClick={() => {
                  setMoreOpen((o) => !o);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setMoreOpen((o) => !o);
                  }
                }}
              >
                <span>More</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform duration-200",
                    moreOpen && "rotate-180 text-[var(--color-brand-primary)]"
                  )}
                  aria-hidden
                />
              </button>

              {/* Dropdown menu */}
              <div
                id="more-dropdown"
                ref={moreMenuRef}
                className={cn(
                  "absolute top-full left-0 mt-1 w-64 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[10px] shadow-[var(--shadow-md)] transition-all duration-150 origin-top-left z-50",
                  moreOpen
                    ? "opacity-100 visible translate-y-0"
                    : "opacity-0 invisible -translate-y-1 pointer-events-none"
                )}
                role="menu"
              >
                <div className="py-2">
                  {MORE_LINKS.map((link) => {
                    const isItemActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        prefetch={false}
                        className={cn(
                          "flex items-center px-4 py-2 text-sm font-[family-name:var(--font-body)] transition-colors",
                          isItemActive
                            ? "bg-[var(--color-surface-sunken)] text-[var(--color-brand-primary)] font-medium"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
                        )}
                        role="menuitem"
                        onClick={() => setMoreOpen(false)}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>

          {/* 3. Right: Profile icon (fixed at far-right on mobile) and Desktop Search/Profile/Cart */}
          <div className="relative z-10 ml-auto lg:ml-0 flex items-center justify-end w-9 xs:w-10 md:w-auto gap-2 sm:gap-3 shrink-0 lg:flex-none lg:shrink-0">
            {/* Inline search bar (Desktop only - lg and above) */}
            <form
              action="/shop"
              method="GET"
              className="relative hidden lg:flex items-center"
              role="search"
            >
              <Search
                className="absolute left-3.5 w-3.5 h-3.5 text-[var(--color-text-muted)] pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                name="q"
                placeholder="Search products..."
                aria-label="Search products"
                className="w-40 xl:w-52 2xl:w-56 h-9 pl-9 pr-3 text-[13px] rounded-full bg-[#FAF5EE] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-primary)] focus:bg-white transition-all font-[family-name:var(--font-body)]"
              />
            </form>

            {/* Account Dropdown */}
            <AccountDropdown />

            {/* Cart Icon with Terracotta Badge (Desktop/Tablet only: hidden on mobile, visible from md up) */}
            <Link
              href="/cart"
              prefetch={false}
              className="hidden md:flex items-center justify-center h-10 w-10 rounded-full hover:bg-[var(--color-surface-sunken)] active:scale-95 transition-all relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] text-[var(--color-text-primary)]"
              aria-label={itemCount > 0 ? `Shopping cart, ${itemCount} items` : "Shopping cart"}
            >
              <ShoppingBag className="h-5 w-5" aria-hidden />
              {itemCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white text-[10.5px] font-bold px-1 leading-none shadow-xs">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ──────────────────────────────────────────────────── */}
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-[#1A1614]/40 transition-opacity duration-250 lg:hidden",
          drawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-hidden
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer panel */}
      <div
        id="mobile-drawer"
        role="dialog"
        aria-label="Navigation menu"
        aria-modal="true"
        aria-hidden={!drawerOpen}
        className={cn(
          "fixed top-0 left-0 bottom-0 z-50 w-[80vw] max-w-[320px] bg-[var(--color-surface-raised)] shadow-[var(--shadow-lg)] transition-transform duration-250 ease-out lg:hidden flex flex-col",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-[var(--color-border)] shrink-0">
          <Link
            href="/"
            prefetch={false}
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-2.5"
          >
            <Image
              src="/logo.png"
              alt="SPN Health Mix Emblem"
              width={36}
              height={36}
              className="w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-full object-contain shrink-0"
            />
            <span
              className="font-[family-name:var(--font-logo)] text-[18px] sm:text-[19px] text-[var(--color-brand-primary)] tracking-tight font-bold leading-none"
            >
              SPN Health Mix
            </span>
          </Link>
          <button
            onClick={() => setDrawerOpen(false)}
            className="h-9 w-9 flex items-center justify-center rounded-[4px] hover:bg-[var(--color-surface-sunken)] active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5 text-[var(--color-text-body)]" aria-hidden />
          </button>
        </div>

        {/* Drawer search bar */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]/60">
          <form
            action="/shop"
            method="GET"
            onSubmit={() => setDrawerOpen(false)}
            className="relative flex items-center"
            role="search"
          >
            <Search
              className="absolute left-3 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              placeholder="Search products..."
              aria-label="Search products"
              className="w-full h-9 pl-9 pr-3 text-[13px] rounded-[8px] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-primary)] focus:bg-white transition-all font-[family-name:var(--font-body)]"
            />
          </form>
        </div>

        {/* Drawer nav links */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Mobile navigation">
          {/* Home */}
          <Link
            href="/"
            prefetch={false}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center px-5 py-3 text-base font-[family-name:var(--font-body)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-primary)]",
              isHomeActive
                ? "bg-[var(--color-surface-sunken)] text-[var(--color-brand-primary)] font-semibold"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
            )}
          >
            Home
          </Link>

          {/* Shop */}
          <Link
            href="/shop"
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center px-5 py-3 text-base font-[family-name:var(--font-body)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-primary)]",
              isShopActive
                ? "bg-[var(--color-surface-sunken)] text-[var(--color-brand-primary)] font-semibold"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
            )}
          >
            Shop
          </Link>

          {/* Combo Offers */}
          <Link
            href="/combo-offers"
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center px-5 py-3 text-base font-[family-name:var(--font-body)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-primary)]",
              isComboOffersActive
                ? "bg-[var(--color-surface-sunken)] text-[var(--color-brand-primary)] font-semibold"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
            )}
          >
            Combo Offers
          </Link>

          {/* About Us */}
          <Link
            href="/about"
            prefetch={false}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center px-5 py-3 text-base font-[family-name:var(--font-body)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-primary)]",
              isAboutActive
                ? "bg-[var(--color-surface-sunken)] text-[var(--color-brand-primary)] font-semibold"
                : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
            )}
          >
            About Us
          </Link>

          {/* Expandable More */}
          <div>
            <button
              type="button"
              onClick={() => setMobileMoreOpen((o) => !o)}
              className={cn(
                "w-full flex items-center justify-between px-5 py-3 text-base font-[family-name:var(--font-body)] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-primary)]",
                isMoreActive
                  ? "text-[var(--color-brand-primary)] font-semibold"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-brand-primary)]"
              )}
              aria-expanded={mobileMoreOpen}
              aria-controls="mobile-more-sublist"
            >
              <span>More</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-[var(--color-text-muted)] transition-transform duration-200",
                  mobileMoreOpen && "rotate-180 text-[var(--color-brand-primary)]"
                )}
                aria-hidden
              />
            </button>

            {mobileMoreOpen && (
              <div
                id="mobile-more-sublist"
                className="bg-[var(--color-surface-sunken)]/60 py-1.5 border-y border-[var(--color-border)]/60"
              >
                {MORE_LINKS.map((link) => {
                  const isItemActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={false}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center justify-between pl-8 pr-5 py-2.5 text-sm font-[family-name:var(--font-body)] transition-colors",
                        isItemActive
                          ? "text-[var(--color-brand-primary)] font-semibold"
                          : "text-[var(--color-text-body)] hover:text-[var(--color-brand-primary)]"
                      )}
                    >
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </nav>
      </div>

      {/* ── Floating Mobile Cart Button ───────────────────────────────────────── */}
      <FloatingCartButton drawerOpen={drawerOpen} />
    </>
  );
}
