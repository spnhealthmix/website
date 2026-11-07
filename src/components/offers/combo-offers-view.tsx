"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShoppingCart, Loader2, Plus, Minus, ArrowRight, Sparkles, Truck, CheckCircle2 } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { FALLBACK_COMBO_DATA, type ComboOfferItem } from "@/lib/storefront/api";

function formatRupee(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

interface AddToCartControlProps {
  product: ComboOfferItem;
  selectedVariantId: string;
}

function AddToCartControl({ product, selectedVariantId }: AddToCartControlProps) {
  const { cart, addItem, updateQuantity, removeItem, isVariantMutating } = useCart();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const isPending = isVariantMutating(selectedVariant?.id);
  const maxAvailable = selectedVariant ? Math.min(selectedVariant.stock, 10) : 0;
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  const cartItem = cart?.items?.find((item) => item.variantId === selectedVariant?.id);
  const currentQty = cartItem?.quantity ?? 0;

  async function handleAddToCart() {
    if (!selectedVariant || isOutOfStock || isPending) return;
    setErrorMessage(null);
    try {
      await addItem(selectedVariant.id, 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add to cart. Please try again.";
      setErrorMessage(msg);
    }
  }

  function handleIncrement() {
    if (!selectedVariant || isPending) return;
    if (maxAvailable > 0 && currentQty >= maxAvailable) return;
    setErrorMessage(null);
    updateQuantity(selectedVariant.id, currentQty + 1).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update quantity. Please try again.";
      setErrorMessage(msg);
    });
  }

  function handleDecrement() {
    if (!selectedVariant || isPending) return;
    setErrorMessage(null);
    const action = currentQty <= 1 ? removeItem(selectedVariant.id) : updateQuantity(selectedVariant.id, currentQty - 1);
    action.catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update quantity. Please try again.";
      setErrorMessage(msg);
    });
  }

  if (!selectedVariant) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Price & Savings Summary - Savings on Left, Price on Right */}
      <div className="flex items-baseline justify-between border-t border-[#E8DFD4] pt-3.5">
        <div>
          {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise ? (
            <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[13px] sm:text-[14px] font-bold text-[#BF5330]">
              Save {formatRupee(selectedVariant.mrpPaise - selectedVariant.pricePaise)}
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span className="font-[family-name:var(--font-price)] text-lg sm:text-xl font-bold tracking-tight text-[#BF5330]">
            {formatRupee(selectedVariant.pricePaise)}
          </span>
          {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise && (
            <span className="font-[family-name:var(--font-price)] text-xs sm:text-sm font-medium text-[#7A6E65] line-through">
              {formatRupee(selectedVariant.mrpPaise)}
            </span>
          )}
        </div>
      </div>

      {/* Stock warning if low */}
      {!isOutOfStock && selectedVariant.stock < 10 && (
        <p className="text-xs font-medium text-[#C99A3B]">
          Only {selectedVariant.stock} left in stock!
        </p>
      )}

      {/* Single Add to Cart button when quantity is 0, or - [quantity] + when in cart */}
      <div className="w-full">
        {currentQty === 0 ? (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isPending || isOutOfStock}
            className={`w-full h-[42px] flex items-center justify-center gap-2 rounded-[6px] px-5 text-sm font-semibold shadow-xs transition-all duration-150 font-[family-name:var(--font-body)] ${
              isOutOfStock
                ? "bg-[#FAF5EE] border border-[#E8DFD4] text-[#7A6E65] cursor-not-allowed"
                : "bg-[#BF5330] text-white hover:bg-[#8F3E20] active:scale-[0.99] cursor-pointer"
            }`}
            aria-live="polite"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Adding to Cart...</span>
              </>
            ) : isOutOfStock ? (
              <span>Sold Out</span>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 text-white" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        ) : (
          <div
            className="flex items-center justify-between w-full h-[42px] rounded-[6px] bg-[#BF5330] px-2 shadow-xs"
            role="group"
            aria-label={`Quantity in cart for ${product.name}`}
          >
            <button
              type="button"
              onClick={handleDecrement}
              disabled={isPending}
              className="h-8 w-8 rounded-[4px] flex items-center justify-center hover:bg-[#8F3E20] active:scale-95 transition-all text-white cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4 stroke-[2.5]" />
            </button>

            <span className="font-[family-name:var(--font-price)] font-bold text-[16px] text-white select-none px-4 tracking-tight min-w-[24px] text-center">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin inline-block" /> : currentQty}
            </span>

            <button
              type="button"
              onClick={handleIncrement}
              disabled={isPending || (maxAvailable > 0 && currentQty >= maxAvailable)}
              className="h-8 w-8 rounded-[4px] flex items-center justify-center hover:bg-[#8F3E20] active:scale-95 transition-all text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>

      {/* Error notification */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4] px-3 py-2 text-xs text-[#BF5330]">
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

function ComboCard({ offer }: { offer: ComboOfferItem }) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    return offer.variants[0]?.id || "";
  });

  const imageSrc = offer.imageUrl || offer.desktopImageUrl || "/hero1.jpeg";
  const badge = offer.offerBadge || "Special Offer";
  const badgeColorClass =
    badge.toLowerCase().includes("saver")
      ? "bg-[#BF5330] text-white"
      : badge.toLowerCase().includes("festive") || badge.toLowerCase().includes("moving")
      ? "bg-[#C99A3B] text-white"
      : badge.toLowerCase().includes("crispy")
      ? "bg-[#824629] text-white"
      : "bg-[#56634A] text-white";

  return (
    <article className="flex flex-col bg-white rounded-[16px] lg:rounded-[20px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-sm hover:border-[#D6C7BA] transition-all duration-200">
      {/* Poster Image */}
      <Link href={`/combo-offers/${offer.slug}`} className="relative aspect-[4/3] w-full bg-[#FAF5EE] overflow-hidden group">
        <Image
          src={imageSrc}
          alt={offer.name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
          className="object-contain bg-[#1A1614]/5 group-hover:scale-[1.02] transition-transform duration-300"
        />
        <div className={`absolute top-4 left-4 ${badgeColorClass} font-bold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-xs`}>
          {badge}
        </div>
      </Link>

      <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
        <div>
          {/* Header Title & Package Label */}
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
              <Link href={`/combo-offers/${offer.slug}`} className="hover:text-[#BF5330] transition-colors">
                {offer.name}
              </Link>
            </h2>
            {offer.packageLabel && (
              <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[11px] font-bold text-[#BF5330] whitespace-nowrap">
                {offer.packageLabel}
              </span>
            )}
          </div>

          {/* Short Description */}
          {offer.shortDescription && (
            <p className="mt-2 text-sm text-[#4A3B32] leading-relaxed">
              {offer.shortDescription}
            </p>
          )}

          {/* Multi-variant selector (e.g. for Chips 250g, 500g, 1kg) */}
          {offer.variants.length > 1 && (
            <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                Choose Pack Size:
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {offer.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`h-9 px-2 rounded-[6px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-xs sm:text-[13px] transition-all cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#FDF3EE] border-2 border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                          : "bg-white text-[#1A1614] border border-[#E8DFD4] hover:border-[#BF5330]/50 hover:bg-[#FAF5EE] font-medium"
                      }`}
                    >
                      <span>{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Included Products / Highlights */}
          {offer.items && offer.items.length > 0 ? (
            <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                What&apos;s Inside ({offer.items.length} items):
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#4A3B32] font-medium max-h-36 overflow-y-auto pr-1">
                {offer.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 flex items-center justify-between gap-1 text-[11px]"
                  >
                    <span className="truncate">{item.itemTitle}</span>
                    {item.unit && (
                      <span className="text-[#7A6E65] text-[10px] shrink-0 font-semibold">{item.unit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : offer.packageHighlights && offer.packageHighlights.length > 0 ? (
            <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                Package Highlights
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#4A3B32] font-medium">
                {offer.packageHighlights.map((hl, i) => (
                  <div key={i} className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 flex items-center gap-1.5">
                    <span className="text-[#247B49] font-bold">✓</span> {hl}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Pricing, Add To Cart, and View Details */}
        <div className="mt-6 space-y-3">
          <AddToCartControl
            product={offer}
            selectedVariantId={selectedVariantId || offer.variants[0]?.id || ""}
          />
          <div className="pt-2 text-center">
            <Link
              href={`/combo-offers/${offer.slug}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#BF5330] hover:text-[#8F3E20] transition-colors"
            >
              View Full Offer Details <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ComboOffersView({
  comboData,
}: {
  comboData: Record<string, ComboOfferItem>;
}) {
  const offersList = Object.values(comboData).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  return (
    <div className="min-h-screen bg-[#FFFBF7] py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] text-[#BF5330] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.14em] mb-3">
            <Sparkles className="h-3 w-3" />
            Limited Time Offers
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-[#1A1614]">
            Exclusive Combo Offers
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#4A3B32] leading-relaxed font-[family-name:var(--font-body)]">
            Experience the authentic taste of tradition with our handpicked value packs. Freshly prepared, hygienically packed, and delivered right to your doorstep.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-medium text-[#4A3B32]">
            <span className="inline-flex items-center gap-1.5 bg-white shadow-2xs border border-[#E8DFD4] px-3.5 py-1.5 rounded-[6px]">
              <Truck className="h-3.5 w-3.5 text-[#BF5330]" /> Free shipping on orders ₹500+ in Tamil Nadu
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white shadow-2xs border border-[#E8DFD4] px-3.5 py-1.5 rounded-[6px]">
              <Sparkles className="h-3.5 w-3.5 text-[#C99A3B]" /> 100% Homemade Quality
            </span>
          </div>
        </div>

        {/* Dynamic Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {offersList.map((offer) => (
            <ComboCard key={offer.id || offer.slug} offer={offer} />
          ))}
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 rounded-[20px] bg-gradient-to-br from-[#2A1B12] via-[#3E2719] to-[#8F3E20] text-white p-8 sm:p-12 text-center shadow-sm relative overflow-hidden border border-[#8F3E20]">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold tracking-tight text-[#FAF5EE]">
              Looking for our Full Traditional Range?
            </h2>
            <p className="text-[#D6C7BA] text-sm sm:text-base leading-relaxed font-[family-name:var(--font-body)]">
              Explore our whole collection of nutritious health mixes, sprouted grain flours, natural sweeteners, and authentic cold-pressed oils.
            </p>
            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#FAF5EE] px-6 py-3 text-sm font-bold text-[#1A1614] shadow-xs hover:bg-white active:scale-95 transition-all"
              >
                Browse All Products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
