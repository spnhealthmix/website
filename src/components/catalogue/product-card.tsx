"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Heart, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import type { ProductCard as ProductCardType, ProductVariant } from "@/lib/storefront/types";

interface ProductCardProps {
  product: ProductCardType;
  className?: string;
  priority?: boolean;
}

/**
 * Formats variant labels into compact tokens (e.g. "50 g" -> "50g", "1 kg" -> "1kg").
 */
export function formatCompactPackSize(label: string): string {
  if (!label) return "";
  return label.replace(/(\d+)\s*(g|kg|ml|l)\b/gi, "$1$2");
}

/**
 * Controlled two-line formatting for specific storefront product card titles.
 * Ensures consistent line breaks across responsive views and screen sizes.
 */
export const PRODUCT_CARD_TWO_LINE_TITLES: Record<string, [string, string]> = {
  "nendram-raw-banana-powder": ["Nendram Raw", "Banana Powder"],
  "karuppu-kavuni-kanji-mix": ["Karuppu Kavuni", "Kanji Mix"],
  "abc-malt-nuts-mixed-powder": ["ABC Malt -", "Nuts Mixed Powder"],
  "moringa-leaves-sadham-podi": ["Moringa Leaves", "Sadham Podi"],
  "karuveppilai-sadham-podi": ["Karuveppilai", "Sadham Podi"],
};

export function renderProductCardTitle(slug?: string, name?: string): React.ReactNode {
  if (slug && PRODUCT_CARD_TWO_LINE_TITLES[slug]) {
    const [line1, line2] = PRODUCT_CARD_TWO_LINE_TITLES[slug];
    return (
      <>
        <span className="block">{line1}</span>
        <span className="block">{line2}</span>
      </>
    );
  }

  // Fallback matching by name in case product object has alternate slug casing
  const clean = (name ?? "").toLowerCase().replace(/[\u2013\u2014-]/g, " ");
  if (clean.includes("nendram") && clean.includes("banana")) {
    return (
      <>
        <span className="block">Nendram Raw</span>
        <span className="block">Banana Powder</span>
      </>
    );
  }
  if (clean.includes("karuppu") && clean.includes("kavuni")) {
    return (
      <>
        <span className="block">Karuppu Kavuni</span>
        <span className="block">Kanji Mix</span>
      </>
    );
  }
  if (clean.includes("abc") && clean.includes("malt")) {
    return (
      <>
        <span className="block">ABC Malt -</span>
        <span className="block">Nuts Mixed Powder</span>
      </>
    );
  }
  if (clean.includes("moringa") && clean.includes("sadham")) {
    return (
      <>
        <span className="block">Moringa Leaves</span>
        <span className="block">Sadham Podi</span>
      </>
    );
  }
  if (clean.includes("karuveppilai") && clean.includes("sadham")) {
    return (
      <>
        <span className="block">Karuveppilai</span>
        <span className="block">Sadham Podi</span>
      </>
    );
  }

  return name;
}

export function ProductCard({ product, className, priority = false }: ProductCardProps) {
  const { slug, name, category, image, variants = [], inStock } = product;
  const { cart, addItem, updateQuantity, removeItem, isVariantMutating } = useCart();

  // Default to first in-stock variant, or first variant if all out of stock
  const initialVariant = variants.find((v) => v.inStock) ?? variants[0];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(initialVariant);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOverflowOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOverflowOpen]);

  const productHref = `/products/${slug}${selectedVariant ? `?variant=${selectedVariant.id}` : ""}`;

  // Real MRP / Selling price from currently selected variant or product base
  const activePricePaise = selectedVariant?.pricePaise ?? (product as any)?.price?.fromPaise ?? 0;
  const activeMrpPaise = selectedVariant?.mrpPaise ?? (product as any)?.price?.fromMrpPaise ?? 0;
  const displayPrice = activePricePaise > 0 ? formatPrice(activePricePaise) : activeMrpPaise > 0 ? formatPrice(activeMrpPaise) : null;

  // Genuine verified discount from database only
  const hasGenuineDiscount = Boolean(
    activeMrpPaise > activePricePaise &&
    selectedVariant?.discountPercent &&
    selectedVariant.discountPercent > 0
  );
  const originalMrp = hasGenuineDiscount ? formatPrice(activeMrpPaise) : null;

  // Compact horizontal pack size selector logic:
  // Display up to MAX_VISIBLE (3) compact buttons on one line, plus a '+N' control for remaining sizes.
  const MAX_VISIBLE = 3;
  const hasOverflow = variants.length > MAX_VISIBLE;
  const remainingCount = hasOverflow ? variants.length - MAX_VISIBLE : 0;

  // If the user selected a variant that belongs to the overflow items,
  // swap it into the visible slots so the user's active choice is always directly visible and highlighted on the card.
  const visibleVariants = (() => {
    if (!hasOverflow) return variants;
    const selectedIdx = variants.findIndex((v) => v.id === selectedVariant?.id);
    if (selectedIdx >= MAX_VISIBLE && selectedVariant) {
      return [...variants.slice(0, MAX_VISIBLE - 1), selectedVariant];
    }
    return variants.slice(0, MAX_VISIBLE);
  })();

  const overflowVariants = variants.filter(
    (v) => !visibleVariants.some((vis) => vis.id === v.id)
  );

  const isSelectedInOverflow = Boolean(
    hasOverflow &&
    selectedVariant &&
    !visibleVariants.some((v) => v.id === selectedVariant.id)
  );

  // Current quantity of selected variant in cart (0 if not added)
  const cartItem = cart?.items?.find((item) => item.variantId === selectedVariant?.id);
  const currentQty = cartItem?.quantity ?? 0;

  // Scoped loading state: only this card and this specific variant
  const isThisVariantMutating = selectedVariant?.id ? isVariantMutating(selectedVariant.id) : false;
  const isBusy = isPending || isThisVariantMutating;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedVariant || !selectedVariant.inStock || isBusy) return;
    setIsPending(true);
    try {
      await addItem(selectedVariant.id, 1);
    } finally {
      setIsPending(false);
    }
  };

  const handleIncrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedVariant || isBusy) return;
    setIsPending(true);
    try {
      await updateQuantity(selectedVariant.id, currentQty + 1);
    } finally {
      setIsPending(false);
    }
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedVariant || isBusy) return;
    setIsPending(true);
    try {
      if (currentQty <= 1) {
        await removeItem(selectedVariant.id);
      } else {
        await updateQuantity(selectedVariant.id, currentQty - 1);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <article
      className={cn(
        "group flex flex-col h-full bg-white rounded-[20px] border border-[#E8DFD4] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#BF5330]/40 transition-all duration-200 relative",
        className
      )}
      aria-label={name}
    >
      {/* 1. Product image — prominently displayed at the top, spanning the card's available width */}
      <div className="relative w-full aspect-[4/3] bg-[#FAF5EE] overflow-hidden rounded-t-[19px]">
        <Link
          href={productHref}
          prefetch={false}
          className="relative block w-full h-full"
          tabIndex={-1}
          aria-hidden="true"
        >
          {image?.url ? (
            <Image
              src={image.url}
              alt={image.alt ?? name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover object-center group-hover:scale-[1.03] transition-transform duration-300 ease-out"
              priority={priority}
              loading={priority ? "eager" : "lazy"}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center bg-[#FAF5EE]"
              aria-hidden="true"
            >
              <span className="font-heading text-4xl font-normal text-[#D4C5B5] select-none">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        {/* Wishlist control button in upper-right corner */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsWishlisted((prev) => !prev);
          }}
          className={cn(
            "absolute top-3.5 right-3.5 z-10 w-9.5 h-9.5 rounded-full bg-white shadow-xs border border-[#E8DFD4]/80 flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
            isWishlisted
              ? "text-[#BF5330]"
              : "text-[#1A1614] hover:text-[#BF5330]"
          )}
          aria-label={isWishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
        >
          <Heart
            className={cn(
              "w-4.5 h-4.5 transition-colors",
              isWishlisted && "fill-[#BF5330] text-[#BF5330]"
            )}
            aria-hidden="true"
          />
        </button>

        {/* Promotional offer badge overlay if active offer exists */}
        {inStock && (selectedVariant?.offer || product.appliedOffer) ? (
          <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
            <span className="font-[family-name:var(--font-body)] text-[10.5px] font-bold text-white bg-emerald-700/95 backdrop-blur-[2px] rounded-[6px] px-2 py-0.5 shadow-sm border border-emerald-600/50 flex items-center gap-1">
              <span>🏷️</span>
              <span>{(selectedVariant?.offer || product.appliedOffer)?.name}</span>
            </span>
          </div>
        ) : null}

        {/* Subtle Out of Stock badge overlay if entire product is unavailable */}
        {!inStock ? (
          <div className="absolute inset-0 bg-[#FAF5EE]/75 backdrop-blur-[2px] flex items-end p-3 pointer-events-none">
            <span className="font-[family-name:var(--font-body)] text-[11px] font-semibold text-[#635850] bg-white rounded-[6px] px-2.5 py-1 border border-[#E8DFD4] shadow-xs">
              Out of stock
            </span>
          </div>
        ) : null}
      </div>

      {/* 2. Structured Card Body following strictly aligned vertical sections */}
      <div className="px-[5%] sm:px-5.5 py-4 sm:py-5 flex flex-col flex-1 justify-between">
        <div>
          {/* Category — fixed height for perfect cross-card alignment */}
          <div className="h-4 mb-1.5 flex items-center">
            {category?.name ? (
              <p className="font-[family-name:var(--font-body)] text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[#BF5330] truncate">
                {category.name}
              </p>
            ) : null}
          </div>

          {/* Product name — natural height without awkward empty gap before pack size */}
          <div className="mb-1 sm:mb-1.5 flex items-start">
            <h3 className="font-[family-name:var(--font-heading)] text-[19px] md:text-[17px] font-normal leading-[1.3] text-[#1A1614] w-full">
              <Link
                href={productHref}
                prefetch={false}
                title={name}
                className="hover:text-[#BF5330] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330] rounded block"
              >
                {name}
              </Link>
            </h3>
          </div>

          {/* Pack size selector */}
          {variants.length > 0 ? (
            <div className="mt-2 sm:mt-2.5 mb-3.5 relative" ref={overflowRef}>
              {/* Mobile View (< md): Always display all available pack sizes directly, wrapping neatly if needed */}
              <div
                className="flex md:hidden flex-wrap gap-1.5 w-full"
                role="radiogroup"
                aria-label={`Available pack sizes for ${name}`}
              >
                {variants.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id;
                  const compactLabel = formatCompactPackSize(variant.label);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!variant.inStock}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVariant(variant);
                      }}
                      className={cn(
                        "h-8 px-2.5 rounded-[6px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-[12px] transition-all cursor-pointer border select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
                        isSelected
                          ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                          : "bg-[#FFFBF7] border-[#E8DFD4] text-[#1A1614] font-normal hover:border-[#BF5330]/50 hover:bg-[#FAF4ED] hover:text-[#BF5330]",
                        !variant.inStock &&
                          "opacity-40 cursor-not-allowed line-through hover:border-[#E8DFD4] hover:bg-[#FFFBF7] hover:text-[#1A1614]"
                      )}
                    >
                      <span>{compactLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Desktop View (>= md): Compact 1-line selector with +N expansion when > 3 variants */}
              <div
                className="hidden md:flex items-center gap-1.5 w-full h-8"
                role="radiogroup"
                aria-label={`Available pack sizes for ${name}`}
              >
                {visibleVariants.map((variant) => {
                  const isSelected = selectedVariant?.id === variant.id;
                  const compactLabel = formatCompactPackSize(variant.label);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={!variant.inStock}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedVariant(variant);
                        setIsOverflowOpen(false);
                      }}
                      className={cn(
                        "h-8 px-2.5 sm:px-3 rounded-[6px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-[12px] sm:text-[12.5px] transition-all cursor-pointer border select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330] shrink-0",
                        isSelected
                          ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                          : "bg-[#FFFBF7] border-[#E8DFD4] text-[#1A1614] font-normal hover:border-[#BF5330]/50 hover:bg-[#FAF4ED] hover:text-[#BF5330]",
                        !variant.inStock &&
                          "opacity-40 cursor-not-allowed line-through hover:border-[#E8DFD4] hover:bg-[#FFFBF7] hover:text-[#1A1614]"
                      )}
                    >
                      <span>{compactLabel}</span>
                    </button>
                  );
                })}

                {/* +N trigger button for remaining variants on desktop */}
                {hasOverflow ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsOverflowOpen((prev) => !prev);
                    }}
                    aria-expanded={isOverflowOpen}
                    aria-haspopup="dialog"
                    aria-label={`View ${remainingCount} more pack sizes for ${name}`}
                    className={cn(
                      "h-8 px-2 rounded-[6px] border text-xs font-medium font-[family-name:var(--font-body)] transition-all cursor-pointer select-none shrink-0 flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
                      isOverflowOpen || isSelectedInOverflow
                        ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                        : "bg-[#FAF5EE] border-[#E8DFD4] text-[#635850] hover:border-[#BF5330]/50 hover:bg-[#FAF4ED] hover:text-[#BF5330]"
                    )}
                  >
                    <span>+{remainingCount}</span>
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 transition-transform duration-150 md:hidden",
                        isOverflowOpen && "rotate-180"
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {/* Accessible Popover for +N: reveals ONLY additional pack-size options without prices */}
              {isOverflowOpen && hasOverflow ? (
                <div
                  role="dialog"
                  aria-label={`Additional pack sizes for ${name}`}
                  className="absolute left-0 top-full mt-1.5 z-30 bg-white border border-[#E8DFD4] rounded-[10px] shadow-[0_10px_25px_rgba(0,0,0,0.12)] p-2.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#E8DFD4] gap-4">
                    <span className="text-[11px] font-semibold text-[#635850] uppercase tracking-wider font-[family-name:var(--font-body)]">
                      More Sizes
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsOverflowOpen(false);
                      }}
                      className="text-[#635850] hover:text-[#1A1614] p-0.5 rounded hover:bg-[#FAF5EE] cursor-pointer"
                      aria-label="Close pack size menu"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                    {overflowVariants.map((variant) => {
                      const isSelected = selectedVariant?.id === variant.id;
                      const compactLabel = formatCompactPackSize(variant.label);
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          disabled={!variant.inStock}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedVariant(variant);
                            setIsOverflowOpen(false);
                          }}
                          className={cn(
                            "h-8 px-2.5 sm:px-3 rounded-[6px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-[12px] sm:text-[12.5px] transition-all cursor-pointer border select-none whitespace-nowrap",
                            isSelected
                              ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                              : "bg-[#FFFBF7] border-[#E8DFD4] text-[#1A1614] font-normal hover:border-[#BF5330]/50 hover:bg-[#FAF4ED] hover:text-[#BF5330]",
                            !variant.inStock && "opacity-40 cursor-not-allowed line-through"
                          )}
                        >
                          <span>{compactLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mb-3.5">
              <div className="h-8 flex items-center">
                <span className="font-[family-name:var(--font-body)] text-xs text-[#635850]/70 italic">
                  View product details
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Purchase Action Button & Price Row — Mobile: Price ~5% from left edge & Add to Cart ~5% from right edge */}
        <div className="w-full mt-auto pt-2.5 sm:pt-3 flex items-center justify-between gap-2.5">
          {/* Price View — positioned ~5% from left edge of card, vertically centered in row */}
          <div className="flex flex-col justify-center items-start shrink-0 min-w-0">
            {displayPrice ? (
              <>
                <div className="flex items-baseline gap-1 sm:gap-1.5">
                  <span className="font-[family-name:var(--font-price)] font-extrabold text-[19px] sm:text-[20px] lg:text-[22px] text-[#1A1614] tracking-tight leading-none select-none">
                    {displayPrice}
                  </span>
                  {hasGenuineDiscount && originalMrp ? (
                    <span className="font-[family-name:var(--font-price)] text-[12px] lg:text-[13px] text-[#7A6E65] line-through font-medium">
                      {originalMrp}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hasGenuineDiscount && selectedVariant?.discountPercent ? (
                    <span className="text-[10px] md:text-[10.5px] font-bold text-emerald-700 leading-tight mt-0.5">
                      {selectedVariant.discountPercent}% OFF
                    </span>
                  ) : null}
                  {selectedVariant?.offer?.name ? (
                    <span
                      className="text-[9.5px] font-medium text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 mt-0.5 truncate max-w-[120px]"
                      title={selectedVariant.offer.name}
                    >
                      🏷️ {selectedVariant.offer.name}
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          {/* Action Button / Quantity Controls — positioned ~5% from right edge of card, vertically centered in row */}
          <div className="flex justify-end shrink-0">
            {variants.length > 0 ? (
              currentQty === 0 ? (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!selectedVariant?.inStock || isBusy}
                  className={cn(
                    "w-auto min-w-[102px] min-[360px]:min-w-[108px] sm:min-w-[124px] lg:min-w-[130px] bg-[#BF5330] hover:bg-[#8F3E20] text-white h-[38px] sm:h-[40px] lg:h-[42px] px-2.5 min-[360px]:px-3 sm:px-3.5 lg:px-4 rounded-[6px] font-[family-name:var(--font-body)] text-[12px] min-[360px]:text-[12.5px] sm:text-[13px] lg:text-[13.5px] font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] cursor-pointer shrink-0 whitespace-nowrap",
                    (!selectedVariant?.inStock || isBusy) && "opacity-60 cursor-not-allowed"
                  )}
                  aria-label={`Add ${name}${selectedVariant?.label ? ` - ${selectedVariant.label}` : ""} to cart`}
                >
                  <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-white" aria-hidden="true" />
                  <span>{isBusy ? "Adding..." : "Add to Cart"}</span>
                </button>
              ) : (
                <div
                  className="w-auto h-[38px] sm:h-[40px] lg:h-[42px] rounded-[6px] bg-[#BF5330] text-white flex items-center justify-between px-2 sm:px-2 lg:px-2.5 shadow-xs select-none shrink-0"
                  role="group"
                  aria-label={`Quantity in cart for ${name} (${selectedVariant?.label})`}
                >
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={isBusy}
                    className="h-7.5 w-7.5 sm:h-8 sm:w-7.5 rounded-[3px] flex items-center justify-center hover:bg-[#8F3E20] active:scale-95 transition-all text-white cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                    aria-label={`Decrease quantity of ${name} (${selectedVariant?.label})`}
                  >
                    <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" aria-hidden="true" />
                  </button>

                  <span className="font-[family-name:var(--font-price)] font-bold text-[15px] sm:text-[15px] lg:text-[16px] text-white select-none px-2.5 sm:px-3 tracking-tight min-w-[20px] sm:min-w-[22px] text-center">
                    {currentQty}
                  </span>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={
                      isBusy ||
                      (selectedVariant?.maxQuantity ? currentQty >= selectedVariant.maxQuantity : currentQty >= 99)
                    }
                    className="h-7.5 w-7.5 sm:h-8 sm:w-7.5 rounded-[3px] flex items-center justify-center hover:bg-[#8F3E20] active:scale-95 transition-all text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                    aria-label={`Increase quantity of ${name} (${selectedVariant?.label})`}
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" aria-hidden="true" />
                  </button>
                </div>
              )
            ) : (
              <Link
                href={productHref}
                prefetch={false}
                className="w-auto min-w-[102px] min-[360px]:min-w-[108px] sm:min-w-[124px] bg-[#BF5330] hover:bg-[#8F3E20] text-white h-[38px] sm:h-[40px] lg:h-[42px] px-2.5 min-[360px]:px-3 sm:px-3.5 rounded-[6px] font-[family-name:var(--font-body)] text-[12px] min-[360px]:text-[12.5px] sm:text-[13px] font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 shadow-xs hover:shadow-sm active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] shrink-0 whitespace-nowrap"
                aria-label={`Choose options for ${name}`}
              >
                <span>Choose options</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── Skeleton variant matching ProductCard alignment to the pixel ─────────── */
export function ProductCardSkeleton() {
  return (
    <div
      className="flex flex-col h-full bg-white rounded-[20px] border border-[#E8DFD4] overflow-hidden animate-pulse"
      aria-hidden="true"
    >
      <div className="bg-[#FAF5EE] aspect-[4/3] w-full" />
      <div className="px-[5%] sm:px-5.5 py-4 sm:py-5 flex flex-col flex-1 justify-between">
        <div>
          {/* Category skeleton */}
          <div className="h-4 mb-1.5 flex items-center">
            <div className="h-3 w-20 bg-[#FAF5EE] rounded" />
          </div>
          {/* Title skeleton */}
          <div className="mb-1 sm:mb-1.5">
            <div className="h-5 w-4/5 bg-[#FAF5EE] rounded" />
          </div>
          {/* Pack size selector skeleton */}
          <div className="mt-2 sm:mt-2.5 mb-3.5">
            <div className="h-8 flex gap-1.5">
              <div className="h-8 w-14 bg-[#FAF5EE] rounded-[6px]" />
              <div className="h-8 w-14 bg-[#FAF5EE] rounded-[6px]" />
              <div className="h-8 w-14 bg-[#FAF5EE] rounded-[6px]" />
            </div>
          </div>
        </div>
        {/* Price and Buttons Row */}
        <div className="w-full mt-auto pt-2.5 sm:pt-3 flex items-center justify-between gap-2.5">
          <div className="h-6 w-20 bg-[#FAF5EE] rounded shrink-0" />
          <div className="h-[38px] md:h-[40px] lg:h-[42px] w-28 md:w-32 bg-[#FAF5EE] rounded-[6px] shrink-0" />
        </div>
      </div>
    </div>
  );
}
