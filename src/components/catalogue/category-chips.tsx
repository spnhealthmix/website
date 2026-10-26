"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoryCard } from "@/lib/storefront/types";
import { SlidersHorizontal, ChevronDown, Check, X, RotateCcw } from "lucide-react";

export interface CategoryFilterProps {
  categories: CategoryCard[];
  activeSlug?: string; // currently active category slug
  totalCount?: number;
  className?: string;
}

export function CategoryFilter({
  categories,
  activeSlug,
  totalCount,
  className,
}: CategoryFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click (desktop)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock mobile scroll when bottom sheet is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Build href for each category — preserves search params (sort, etc.), resets offset
  function buildHref(slug?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("offset"); // reset pagination on category switch

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    if (!slug) {
      return `/shop${queryStr}`;
    }
    return `/shop/${slug}${queryStr}`;
  }

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
    <div className={cn("relative inline-flex items-center gap-2", className)}>
      {/* ── Filter Trigger Button ── */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
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
          {hasActiveFilter ? (
            <>
              <span className="hidden sm:inline">Filter: {activeCategory?.name}</span>
              <span className="sm:hidden">{activeCategory?.name}</span>
            </>
          ) : (
            "Filter"
          )}
        </span>
        {hasActiveFilter && (
          <span className="w-1.5 h-1.5 rounded-full bg-[#BF5330] shrink-0" aria-hidden="true" />
        )}
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-150 shrink-0",
            hasActiveFilter ? "text-[#BF5330]" : "text-[#7A6E65]",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* ── Active Filter Quick-Clear Badge (Desktop & Mobile) ── */}
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

      {/* ── Desktop Popover Dropdown (hidden on small screens) ── */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Category filter options"
          className="hidden md:block absolute left-0 top-full mt-2 z-30 w-72 bg-white rounded-[14px] border border-[#E8DFD4] shadow-[0_12px_32px_rgba(26,22,20,0.1)] p-2 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#F5EFE8] mb-1">
            <span className="font-[family-name:var(--font-body)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7A6E65]">
              Filter by Category
            </span>
            {hasActiveFilter && (
              <Link
                href={buildHref(undefined)}
                onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-xs font-medium text-[#BF5330] hover:bg-[#FDF3EE] rounded-[8px] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Bottom Sheet (Portal to body for clean viewport stacking) ── */}
      {isOpen && mounted &&
        createPortal(
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Bottom Sheet */}
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
                  onClick={() => setIsOpen(false)}
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
                    onClick={() => setIsOpen(false)}
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
                    onClick={() => setIsOpen(false)}
                    className="flex-1 h-11 rounded-[8px] border border-[#BF5330] text-[#BF5330] font-[family-name:var(--font-body)] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#FDF3EE] transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Clear Filters</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 h-11 rounded-[8px] bg-[#BF5330] text-white font-[family-name:var(--font-body)] text-sm font-semibold flex items-center justify-center hover:bg-[#8F3E20] transition-colors shadow-xs"
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

// Re-export as CategoryChips for backward compatibility
export { CategoryFilter as CategoryChips };
