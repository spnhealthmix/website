"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryCard } from "@/lib/storefront/types";
import {
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Check,
  X,
  RotateCcw,
} from "lucide-react";

const SORT_OPTIONS = [
  { value: "featured",   label: "Featured" },
  { value: "price_asc",  label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest",     label: "Newest" },
  { value: "name",       label: "Name: A–Z" },
] as const;

const SEARCH_SORT_OPTIONS = [
  { value: "relevance",  label: "Most Relevant" },
  ...SORT_OPTIONS,
] as const;

export interface CatalogueToolbarProps {
  categories: CategoryCard[];
  activeSlug?: string;
  totalCount?: number;
  currentSort?: string;
  isSearch?: boolean;
  className?: string;
}

export function CatalogueToolbar({
  categories,
  activeSlug,
  totalCount,
  currentSort,
  isSearch = false,
  className,
}: CatalogueToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Mobile drawer state
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  // Desktop dropdown popover state
  const [isDesktopPopoverOpen, setIsDesktopPopoverOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const desktopPopoverRef = useRef<HTMLDivElement>(null);
  const desktopButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Desktop: close popover on outside click
  useEffect(() => {
    if (!isDesktopPopoverOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        desktopPopoverRef.current &&
        !desktopPopoverRef.current.contains(target) &&
        desktopButtonRef.current &&
        !desktopButtonRef.current.contains(target)
      ) {
        setIsDesktopPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDesktopPopoverOpen]);

  // Close popover or drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDesktopPopoverOpen(false);
        setIsMobileDrawerOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock mobile body scroll when drawer is open
  useEffect(() => {
    if (isMobileDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileDrawerOpen]);

  // Build category links preserving sort params and resetting pagination
  function buildHref(slug?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("offset");
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    if (!slug) {
      return `/shop${queryStr}`;
    }
    return `/shop/${slug}${queryStr}`;
  }

  // Handle sort changes
  const sortOptions = isSearch ? SEARCH_SORT_OPTIONS : SORT_OPTIONS;
  const defaultSort = isSearch ? "relevance" : "featured";
  const activeSortValue = currentSort ?? defaultSort;
  const currentSortOption =
    sortOptions.find((opt) => opt.value === activeSortValue) ?? sortOptions[0];

  const handleSortChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === defaultSort) {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    params.delete("offset");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const isAll = !activeSlug || (pathname === "/shop" && !activeSlug);
  const filteredCategories = categories.filter((cat) => cat.slug !== "thokku");
  const activeCategory = filteredCategories.find((cat) => cat.slug === activeSlug);
  const hasActiveFilter = Boolean(!isAll && activeCategory);

  const allItems = [
    {
      slug: undefined,
      name: "All Categories",
      count: totalCount,
      isActive: isAll,
    },
    ...filteredCategories.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      count: cat.productCount,
      isActive: activeSlug === cat.slug,
    })),
  ];

  return (
    <div className={cn("w-full", className)}>
      {/* ══════════════════════════════════════════════════════════════
          MOBILE TOOLBAR (< md)
          - Row 1: Two equal-width controls (Filters + Sort)
          - Row 2: Selected Category compact chip (when filter active)
          ══════════════════════════════════════════════════════════════ */}
      <div className="md:hidden mb-6 border-b border-[#E8DFD4] pb-4">
        {/* Row 1: Equal-width controls */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {/* Filters Button */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-expanded={isMobileDrawerOpen}
            aria-haspopup="dialog"
            aria-label="Filter products by category"
            className={cn(
              "h-11 px-3.5 rounded-[10px] flex items-center justify-center gap-2 font-[family-name:var(--font-body)] text-sm font-medium transition-all cursor-pointer select-none border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330] shadow-2xs active:scale-[0.99]",
              hasActiveFilter
                ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold"
                : "bg-white border-[#E8DFD4] text-[#1A1614] hover:border-[#BF5330]/60 hover:text-[#BF5330]"
            )}
          >
            <SlidersHorizontal
              className={cn(
                "w-4 h-4 shrink-0 transition-colors",
                hasActiveFilter ? "text-[#BF5330]" : "text-[#7A6E65]"
              )}
              aria-hidden="true"
            />
            <span className="truncate">Filters</span>
            {hasActiveFilter && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#BF5330] shrink-0"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Sort Control */}
          <div
            className={cn(
              "relative h-11 rounded-[10px] bg-white border border-[#E8DFD4] shadow-2xs flex items-center justify-between px-3 text-sm font-medium font-[family-name:var(--font-body)] text-[#1A1614] transition-all hover:border-[#BF5330]/60 focus-within:border-[#BF5330]"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-1">
              <ArrowUpDown
                className="w-3.5 h-3.5 text-[#7A6E65] shrink-0"
                aria-hidden="true"
              />
              <span className="truncate text-xs sm:text-sm text-[#1A1614] font-medium">
                {currentSortOption.label}
              </span>
            </div>
            <ChevronDown
              className="w-3.5 h-3.5 text-[#7A6E65] shrink-0 ml-1"
              aria-hidden="true"
            />
            {/* Native invisible select covering full button for seamless mobile OS picker */}
            <select
              id="mobile-sort-select"
              value={activeSortValue}
              onChange={(e) => handleSortChange(e.target.value)}
              aria-label="Sort products"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base bg-transparent"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Active Filter Compact Chip on Separate Row */}
        {hasActiveFilter && activeCategory && (
          <div className="mt-2.5 pt-2.5 border-t border-[#E8DFD4]/60 flex items-center justify-between gap-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-[#7A6E65] font-[family-name:var(--font-body)] shrink-0">
                Filtered:
              </span>
              <span className="inline-flex items-center gap-1.5 max-w-[210px] sm:max-w-[260px] pl-2.5 pr-1.5 py-1 rounded-full bg-[#FDF3EE] border border-[#BF5330]/30 text-[#BF5330] text-xs font-medium font-[family-name:var(--font-body)]">
                <span className="truncate">{activeCategory.name}</span>
                <Link
                  href={buildHref(undefined)}
                  aria-label={`Remove ${activeCategory.name} filter`}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[#BF5330]/20 text-[#BF5330] transition-colors shrink-0"
                >
                  <X className="w-3 h-3 stroke-[2.5]" aria-hidden="true" />
                </Link>
              </span>
            </div>
            <Link
              href={buildHref(undefined)}
              className="text-xs font-medium font-[family-name:var(--font-body)] text-[#7A6E65] hover:text-[#BF5330] underline underline-offset-2 shrink-0 transition-colors"
            >
              Clear all
            </Link>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP & TABLET TOOLBAR (md:)
          - Left: Filter Trigger Button + Quick Clear + Popover Dropdown
          - Right: Sort Control Dropdown
          ══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex items-center justify-between gap-3 sm:gap-4 mb-7 sm:mb-8 border-b border-[#E8DFD4] pb-4">
        {/* Left: Desktop Category Filter with Dropdown */}
        <div className="relative inline-flex items-center gap-2">
          <button
            ref={desktopButtonRef}
            type="button"
            onClick={() => setIsDesktopPopoverOpen((prev) => !prev)}
            aria-expanded={isDesktopPopoverOpen}
            aria-haspopup="dialog"
            aria-label="Filter by category"
            className={cn(
              "inline-flex items-center gap-2 h-9 sm:h-9.5 px-3.5 sm:px-4 rounded-[8px] font-[family-name:var(--font-body)] text-sm font-medium transition-all duration-150 cursor-pointer select-none border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330] shadow-2xs",
              hasActiveFilter
                ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold"
                : "bg-white border-[#E8DFD4] text-[#1A1614] hover:border-[#BF5330]/60 hover:text-[#BF5330] hover:bg-[#FAF4ED]"
            )}
          >
            <SlidersHorizontal
              className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-colors",
                hasActiveFilter ? "text-[#BF5330]" : "text-[#7A6E65]"
              )}
              aria-hidden="true"
            />
            <span>
              {hasActiveFilter ? `Filter: ${activeCategory?.name}` : "Filter"}
            </span>
            {hasActiveFilter && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#BF5330] shrink-0"
                aria-hidden="true"
              />
            )}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-150 shrink-0",
                hasActiveFilter ? "text-[#BF5330]" : "text-[#7A6E65]",
                isDesktopPopoverOpen && "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>

          {/* Active Filter Quick-Clear Badge */}
          {hasActiveFilter && (
            <Link
              href={buildHref(undefined)}
              className="inline-flex items-center gap-1.5 h-9 sm:h-9.5 px-2.5 sm:px-3 rounded-[8px] text-xs sm:text-[12.5px] font-medium font-[family-name:var(--font-body)] text-[#7A6E65] hover:text-[#BF5330] bg-white border border-[#E8DFD4] hover:border-[#BF5330]/40 hover:bg-[#FAF4ED] transition-all cursor-pointer shadow-2xs"
              title="Clear category filter"
              aria-label="Clear active category filter"
            >
              <span>Clear</span>
              <X className="w-3 h-3 text-[#BF5330]" aria-hidden="true" />
            </Link>
          )}

          {/* Desktop Popover Dropdown */}
          {isDesktopPopoverOpen && (
            <div
              ref={desktopPopoverRef}
              role="dialog"
              aria-label="Category filter options"
              className="absolute left-0 top-full mt-2 z-30 w-72 bg-white rounded-[14px] border border-[#E8DFD4] shadow-[0_12px_32px_rgba(26,22,20,0.1)] p-2 animate-in fade-in zoom-in-95 duration-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#F5EFE8] mb-1">
                <span className="font-[family-name:var(--font-body)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A6E65]">
                  Filter by Category
                </span>
                {hasActiveFilter && (
                  <Link
                    href={buildHref(undefined)}
                    onClick={() => setIsDesktopPopoverOpen(false)}
                    className="text-[11.5px] font-medium text-[#BF5330] hover:text-[#8F3E20] hover:underline"
                  >
                    Clear
                  </Link>
                )}
              </div>

              {/* Category List */}
              <div className="space-y-0.5 max-h-[320px] overflow-y-auto py-1">
                {allItems.map((item) => (
                  <Link
                    key={item.slug ?? "all"}
                    href={buildHref(item.slug)}
                    onClick={() => setIsDesktopPopoverOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-[8px] text-sm font-[family-name:var(--font-body)] transition-all cursor-pointer select-none",
                      item.isActive
                        ? "bg-[#FDF3EE] text-[#BF5330] font-semibold shadow-2xs"
                        : "text-[#1A1614] hover:bg-[#FAF4ED] hover:text-[#BF5330]"
                    )}
                    role="radio"
                    aria-checked={item.isActive}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={cn(
                          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                          item.isActive
                            ? "border-[#BF5330] bg-[#BF5330] text-white"
                            : "border-[#D4C5B5] bg-white"
                        )}
                      >
                        {item.isActive && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span className="truncate">{item.name}</span>
                    </div>
                    {typeof item.count === "number" && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full shrink-0 font-normal",
                          item.isActive
                            ? "bg-[#BF5330]/10 text-[#BF5330]"
                            : "text-[#7A6E65] bg-[#FAF5EE]"
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Footer Action */}
              {hasActiveFilter && (
                <div className="pt-2 mt-1 border-t border-[#F5EFE8]">
                  <Link
                    href={buildHref(undefined)}
                    onClick={() => setIsDesktopPopoverOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-[#BF5330] hover:bg-[#FDF3EE] rounded-[8px] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Filters</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Desktop Sort Control */}
        <div className="flex items-center gap-2 shrink-0">
          <label
            htmlFor="desktop-sort-select"
            className="text-sm font-[family-name:var(--font-body)] text-[var(--color-text-muted)] whitespace-nowrap"
          >
            Sort by
          </label>
          <select
            id="desktop-sort-select"
            value={activeSortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="h-9 pl-3 pr-8 text-sm font-[family-name:var(--font-body)] text-[var(--color-text-body)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)] cursor-pointer appearance-none bg-no-repeat"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%238A7F78' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundPosition: "right 10px center",
            }}
            aria-label="Sort products"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MOBILE BOTTOM SHEET DRAWER (Portal to body)
          ══════════════════════════════════════════════════════════════ */}
      {isMobileDrawerOpen &&
        mounted &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Bottom Sheet Modal */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Filter by category"
              className="relative z-10 w-full bg-white rounded-t-[22px] border-t border-[#E8DFD4] shadow-2xl p-5 pb-7 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200"
            >
              {/* Drag Handle Indicator */}
              <div className="w-10 h-1 bg-[#E8DFD4] rounded-full mx-auto mb-3 shrink-0" />

              {/* Sheet Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-[#F5EFE8] mb-2 shrink-0">
                <div>
                  <h3
                    className="text-lg font-normal text-[#1A1614] leading-snug"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Filter by Category
                  </h3>
                  <p className="text-xs text-[#7A6E65] font-[family-name:var(--font-body)]">
                    Select a category to view traditional products
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#FAF5EE] text-[#635850] hover:text-[#1A1614] flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="Close filter menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sheet Category Options */}
              <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5 py-1">
                {allItems.map((item) => (
                  <Link
                    key={item.slug ?? "all"}
                    href={buildHref(item.slug)}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3.5 py-3 rounded-[10px] text-[14.5px] font-[family-name:var(--font-body)] transition-all cursor-pointer border",
                      item.isActive
                        ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                        : "bg-[#FFFBF7] border-[#E8DFD4] text-[#1A1614] hover:border-[#BF5330]/40"
                    )}
                    role="radio"
                    aria-checked={item.isActive}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                          item.isActive
                            ? "border-[#BF5330] bg-[#BF5330] text-white"
                            : "border-[#D4C5B5] bg-white"
                        )}
                      >
                        {item.isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{item.name}</span>
                    </div>
                    {typeof item.count === "number" && (
                      <span
                        className={cn(
                          "text-xs px-2.5 py-0.5 rounded-full font-medium",
                          item.isActive
                            ? "bg-[#BF5330]/10 text-[#BF5330]"
                            : "text-[#7A6E65] bg-white border border-[#E8DFD4]"
                        )}
                      >
                        {item.count}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Sheet Footer Action */}
              <div className="pt-3.5 mt-2 border-t border-[#F5EFE8] flex items-center gap-2.5 shrink-0">
                {hasActiveFilter ? (
                  <Link
                    href={buildHref(undefined)}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className="flex-1 h-11 rounded-[8px] border border-[#BF5330] text-[#BF5330] font-[family-name:var(--font-body)] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FDF3EE] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Clear Filters</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex-1 h-11 rounded-[8px] bg-[#BF5330] text-white font-[family-name:var(--font-body)] text-sm font-semibold flex items-center justify-center hover:bg-[#8F3E20] transition-colors shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
