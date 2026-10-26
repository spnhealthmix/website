"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Check } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { cn } from "@/lib/utils";
import type { ProductDetail, ProductVariant } from "@/lib/storefront/types";

interface ProductPurchasePanelProps {
  product: ProductDetail;
  initialVariantId?: string;
}

/**
 * Normalizes pack size labels to clean weight/quantity strings without prices,
 * formatted cleanly as "250 g", "500 g", "1 kg" matching the reference design.
 */
function formatPackSizeLabel(label?: string, weightGrams?: number | null): string {
  if (!label && weightGrams) {
    return weightGrams >= 1000 ? `${weightGrams / 1000} kg` : `${weightGrams} g`;
  }
  if (!label) return "";
  // Strip any attached price text (e.g. "500g - ₹249" -> "500g")
  const clean = label.split(/[-—–]/)[0].trim();
  // Ensure a space between the number and unit: "250g" -> "250 g", "1kg" -> "1 kg"
  return clean.replace(/(\d+)\s*(g|kg|gm|gms|ml|l)\b/i, "$1 $2");
}

export function ProductPurchasePanel({ product, initialVariantId }: ProductPurchasePanelProps) {
  const { addItem, isVariantMutating } = useCart();

  // If a specific variant was passed (e.g. from homepage selection or query param), prioritize it
  const requestedVariant = initialVariantId
    ? product.variants.find((v) => v.id === initialVariantId)
    : undefined;

  // Default to requested variant, or first in-stock variant, or first variant
  const initialVariant =
    requestedVariant ??
    product.variants.find((v) => v.inStock) ??
    product.variants[0];

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    initialVariant
  );
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const isThisVariantMutating = selectedVariant?.id ? isVariantMutating(selectedVariant.id) : false;
  const isBusy = adding || isThisVariantMutating;

  const maxQty = selectedVariant?.inStock
    ? Math.min(selectedVariant.maxQuantity || 99, 99)
    : 0;

  const handleVariantSelect = (v: ProductVariant) => {
    setSelectedVariant(v);
    if (quantity > (v.maxQuantity || 99)) {
      setQuantity(Math.max(1, v.maxQuantity || 1));
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || !selectedVariant.inStock || isBusy) return;
    setAdding(true);
    try {
      const success = await addItem(selectedVariant.id, quantity);
      if (success) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2200);
      }
    } finally {
      setAdding(false);
    }
  };

  // Formatted price for selected variant
  const displayPrice = selectedVariant
    ? `₹${(selectedVariant.pricePaise / 100).toLocaleString("en-IN")}`
    : "—";

  // Product description to display
  const descriptionText = product.shortDescription?.trim() || product.description?.trim();

  return (
    <div className="flex flex-col w-full">
      {/* 1. Product category in small uppercase terracotta text */}
      {product.category?.name && (
        <div className="mb-2">
          <Link
            href={`/shop/${product.category.slug}`}
            className="font-[family-name:var(--font-body)] text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.14em] text-[#BF5330] hover:text-[#8F3E20] transition-colors"
          >
            {product.category.name}
          </Link>
        </div>
      )}

      {/* 2. Product name using an elegant heading font */}
      <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-[36px] lg:text-[40px] font-normal leading-[1.15] text-[#1A1614] mb-3">
        {product.name}
      </h1>

      {/* 3. Short product description, using existing product data where available */}
      {descriptionText && (
        <p className="font-[family-name:var(--font-body)] text-[15px] sm:text-[15.5px] text-[#635850] leading-relaxed font-normal mb-6 max-w-xl">
          {descriptionText}
        </p>
      )}

      {/* 4. A subtle horizontal divider */}
      <div className="border-b border-[#E8DFD4] mb-6" />

      {/* 5. Product price prominently displayed in rupees, with small tax note */}
      <div className="flex items-baseline gap-3 mb-6">
        <span className="font-[family-name:var(--font-price)] font-bold text-[32px] sm:text-[36px] text-[#1A1614] leading-none tracking-tight">
          {displayPrice}
        </span>
        <span className="font-[family-name:var(--font-body)] text-[13px] sm:text-[13.5px] text-[#635850] font-normal">
          (Inclusive of all taxes)
        </span>
      </div>

      {/* 6. Pack-size selection buttons */}
      {product.variants.length > 0 && (
        <div className="mb-6">
          <label className="font-[family-name:var(--font-body)] text-[14px] font-semibold text-[#1A1614] mb-3 block">
            Pack Size
          </label>
          <div
            className="flex flex-wrap gap-2.5 sm:gap-3"
            role="radiogroup"
            aria-label="Select pack size"
          >
            {product.variants.map((variant) => {
              const isSelected = selectedVariant?.id === variant.id;
              const formattedLabel = formatPackSizeLabel(variant.label, variant.weightGrams);

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => handleVariantSelect(variant)}
                  disabled={!variant.inStock}
                  className={cn(
                    "h-11 px-6 min-w-[85px] sm:min-w-[95px] rounded-[8px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-[14px] transition-all cursor-pointer border select-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
                    isSelected
                      ? "bg-[#FDF3EE] border-2 border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                      : "bg-white border-[#E8DFD4] text-[#1A1614] font-normal hover:border-[#BF5330]/50 hover:bg-[#FAF4ED] hover:text-[#BF5330]",
                    !variant.inStock &&
                      "opacity-40 cursor-not-allowed line-through hover:border-[#E8DFD4] hover:bg-white hover:text-[#1A1614]"
                  )}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={!variant.inStock}
                  title={!variant.inStock ? `${formattedLabel} — out of stock` : formattedLabel}
                >
                  <span>{formattedLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. Quantity selector with minus, quantity number, and plus controls */}
      <div className="mb-6">
        <label className="font-[family-name:var(--font-body)] text-[14px] font-semibold text-[#1A1614] mb-3 block">
          Quantity
        </label>
        <div className="inline-flex items-center h-11 rounded-[8px] border border-[#E8DFD4] bg-white overflow-hidden shadow-2xs select-none">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isBusy || !selectedVariant?.inStock}
            className="w-11 h-full flex items-center justify-center text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EE] active:bg-[#F5EFE8] transition-colors text-[18px] font-medium disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#BF5330] cursor-pointer"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span
            className="w-12 h-full flex items-center justify-center font-[family-name:var(--font-price)] font-semibold text-[15px] text-[#1A1614] border-x border-[#E8DFD4] select-none"
            aria-label={`Quantity: ${quantity}`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty || isBusy || !selectedVariant?.inStock}
            className="w-11 h-full flex items-center justify-center text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EE] active:bg-[#F5EFE8] transition-colors text-[18px] font-medium disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[#BF5330] cursor-pointer"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {/* 8. Full-width terracotta Add to Cart button */}
      <div className="w-full">
        {selectedVariant?.inStock ? (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isBusy}
            className={cn(
              "w-full h-[50px] sm:h-[52px] rounded-[10px] font-[family-name:var(--font-body)] text-[15px] sm:text-[16px] font-medium flex items-center justify-center gap-2.5 transition-all duration-150 shadow-xs hover:shadow cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]",
              added
                ? "bg-[#247B49] text-white shadow-sm"
                : "bg-[#BF5330] hover:bg-[#8F3E20] text-white active:scale-[0.99]",
              isBusy && "opacity-75 cursor-wait"
            )}
            aria-label={`Add ${product.name}${selectedVariant?.label ? ` (${selectedVariant.label})` : ""} to cart`}
            aria-live="polite"
          >
            {isBusy ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span>Adding to Cart...</span>
              </>
            ) : added ? (
              <>
                <Check className="h-5 w-5 text-white stroke-[2.5]" aria-hidden="true" />
                <span>Added to Cart!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 text-white" aria-hidden="true" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        ) : (
          <div className="w-full h-[50px] sm:h-[52px] rounded-[10px] bg-[#FAF5EE] border border-[#E8DFD4] flex items-center justify-center text-[#635850] font-[family-name:var(--font-body)] font-medium text-[15px]">
            Out of stock
          </div>
        )}
      </div>
    </div>
  );
}
