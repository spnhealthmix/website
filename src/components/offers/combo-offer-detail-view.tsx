"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import type { StorefrontComboOffer } from "@/lib/storefront/api";
import { useCart } from "@/context/cart-context";

function formatRupee(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export function ComboOfferDetailView({
  combo,
  otherCombos = [],
}: {
  combo: StorefrontComboOffer;
  otherCombos?: StorefrontComboOffer[];
}) {
  const { cart, addItem, updateQuantity, removeItem, isVariantMutating } = useCart();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    return combo.variants?.[0]?.id || combo.variantId || combo.id;
  });

  const selectedVariant = combo.variants?.find((v) => v.id === selectedVariantId) || combo.variants?.[0];
  const isPending = isVariantMutating(selectedVariant?.id);
  const isOutOfStock = !combo.inStock || (selectedVariant && selectedVariant.stock <= 0);

  const cartItem = cart?.items?.find((item) => item.variantId === selectedVariant?.id);
  const currentQty = cartItem?.quantity ?? 0;

  const pricePaise = selectedVariant?.pricePaise ?? combo.pricePaise;
  const mrpPaise = selectedVariant?.mrpPaise ?? combo.mrpPaise;
  const savings = mrpPaise && mrpPaise > pricePaise ? mrpPaise - pricePaise : 0;
  const discountPercent = mrpPaise && mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

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

  const mainImageSrc = combo.imageUrl || combo.desktopImageUrl || "/hero1.jpeg";

  return (
    <div className="min-h-screen bg-[#FFFBF7] py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs sm:text-sm text-[#7A6E65]">
          <Link href="/" className="hover:text-[#BF5330] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/combo-offers" className="hover:text-[#BF5330] transition-colors">
            Combo Offers
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#1A1614] truncate max-w-[200px] sm:max-w-md">
            {combo.name}
          </span>
        </nav>

        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/combo-offers"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#BF5330] hover:text-[#9E3E20] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to all Combo Offers
          </Link>
        </div>

        {/* Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-[20px] p-6 sm:p-10 border border-[#E8DFD4] shadow-xs">
          {/* Left Column: Visuals & Posters */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-[4/3] w-full rounded-[16px] overflow-hidden bg-[#FAF5EE] border border-[#E8DFD4]">
              <Image
                src={mainImageSrc}
                alt={combo.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 600px"
                className="object-contain hover:scale-[1.02] transition-transform duration-300"
              />
              {combo.offerBadge && (
                <div className="absolute top-4 left-4 bg-[#BF5330] text-white font-bold text-xs uppercase tracking-wider px-3 py-1.5 rounded-[6px] shadow-xs">
                  {combo.offerBadge}
                </div>
              )}
              {discountPercent > 0 && (
                <div className="absolute top-4 right-4 bg-[#247B49] text-white font-bold text-xs uppercase tracking-wider px-3 py-1.5 rounded-[6px] shadow-xs">
                  {discountPercent}% OFF
                </div>
              )}
            </div>

            {/* Poster Preview Thumbnails if desktop and mobile differ */}
            {combo.desktopImageUrl && combo.mobileImageUrl && combo.desktopImageUrl !== combo.mobileImageUrl && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-2 rounded-[10px] bg-[#FAF5EE] border border-[#E8DFD4] text-center">
                  <span className="text-[11px] font-semibold text-[#7A6E65] block mb-1">Desktop Display</span>
                  <div className="relative aspect-[16/9] w-full rounded-[6px] overflow-hidden">
                    <Image src={combo.desktopImageUrl} alt="Desktop poster" fill className="object-cover" />
                  </div>
                </div>
                <div className="p-2 rounded-[10px] bg-[#FAF5EE] border border-[#E8DFD4] text-center">
                  <span className="text-[11px] font-semibold text-[#7A6E65] block mb-1">Mobile Display</span>
                  <div className="relative aspect-[16/9] w-full rounded-[6px] overflow-hidden">
                    <Image src={combo.mobileImageUrl} alt="Mobile poster" fill className="object-cover" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Pricing, Info, and Add to Cart */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div>
              {/* Badge & Label Header */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {combo.packageLabel && (
                  <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-3 py-1 text-xs font-bold text-[#BF5330]">
                    {combo.packageLabel}
                  </span>
                )}
                {(combo.stock ?? 0) > 0 && (
                  <span className="rounded-[6px] bg-[#EBF7EE] border border-[#CBE7D3] px-3 py-1 text-xs font-bold text-[#247B49]">
                    In Stock
                  </span>
                )}
              </div>

              {/* Offer Name */}
              <h1 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl md:text-4xl font-bold text-[#1A1614] tracking-tight">
                {combo.name}
              </h1>

              {/* Short Description */}
              {combo.shortDescription && (
                <p className="mt-3 text-sm sm:text-base text-[#4A3B32] leading-relaxed font-[family-name:var(--font-body)]">
                  {combo.shortDescription}
                </p>
              )}

              {/* Pricing Box */}
              <div className="mt-6 p-4 rounded-[12px] bg-[#FAF5EE] border border-[#E8DFD4] flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-[#7A6E65] block mb-0.5">Special Price:</span>
                  <div className="flex items-baseline gap-2.5">
                    <span className="font-[family-name:var(--font-price)] text-3xl font-bold text-[#BF5330]">
                      {formatRupee(pricePaise)}
                    </span>
                    {mrpPaise && mrpPaise > pricePaise && (
                      <span className="font-[family-name:var(--font-price)] text-base font-medium text-[#7A6E65] line-through">
                        {formatRupee(mrpPaise)}
                      </span>
                    )}
                  </div>
                </div>

                {savings > 0 && (
                  <div className="text-right">
                    <span className="rounded-[6px] bg-white border border-[#E8DFD4] px-3 py-1.5 text-xs sm:text-sm font-bold text-[#247B49] shadow-2xs">
                      Save {formatRupee(savings)} ({discountPercent}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Multi-variant selector (e.g. for chips with 250g, 500g, 1kg) */}
              {combo.variants && combo.variants.length > 1 && (
                <div className="mt-6">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                    Select Pack Size:
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {combo.variants.map((v) => {
                      const isSelected = selectedVariantId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`h-10 px-3 rounded-[8px] flex items-center justify-center text-center font-[family-name:var(--font-body)] text-xs sm:text-sm transition-all cursor-pointer select-none ${
                            isSelected
                              ? "bg-[#FDF3EE] border-2 border-[#BF5330] text-[#BF5330] font-bold shadow-2xs"
                              : "bg-white text-[#1A1614] border border-[#E8DFD4] hover:border-[#BF5330]/50 hover:bg-[#FAF5EE] font-medium"
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Package Highlights */}
              {combo.packageHighlights && combo.packageHighlights.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#7A6E65] mb-2.5 font-[family-name:var(--font-body)]">
                    Offer Highlights
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-[13px] text-[#4A3B32]">
                    {combo.packageHighlights.map((hl, i) => (
                      <div
                        key={i}
                        className="rounded-[8px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-2.5 flex items-center gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#247B49] shrink-0" />
                        <span className="font-medium">{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Actions */}
            <div className="pt-4 border-t border-[#E8DFD4] space-y-3">
              {errorMessage && (
                <div className="rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4] p-3 text-xs text-[#BF5330]">
                  {errorMessage}
                </div>
              )}

              {combo.allowAddToCart !== false && (
                <div>
                  {currentQty === 0 ? (
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || isPending}
                      className="w-full h-12 rounded-[8px] bg-[#BF5330] text-white font-bold text-sm tracking-wide shadow-xs hover:bg-[#A84524] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isPending ? (
                        <span className="flex items-center gap-2">Adding...</span>
                      ) : isOutOfStock ? (
                        "Out of Stock"
                      ) : (
                        <>Add Combo to Cart — {formatRupee(pricePaise)}</>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center justify-between h-12 rounded-[8px] bg-[#BF5330] text-white px-3 font-semibold">
                      <button
                        type="button"
                        onClick={handleDecrement}
                        disabled={isPending}
                        className="h-9 w-9 rounded-[6px] hover:bg-black/15 flex items-center justify-center text-lg font-bold"
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      <span className="font-[family-name:var(--font-price)] text-base font-bold">
                        {currentQty} in Cart
                      </span>
                      <button
                        type="button"
                        onClick={handleIncrement}
                        disabled={isPending}
                        className="h-9 w-9 rounded-[6px] hover:bg-black/15 flex items-center justify-center text-lg font-bold"
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-[#7A6E65]">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-[#BF5330]" />
                  <span>Free TN shipping ₹500+</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#247B49]" />
                  <span>100% Quality Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: What's Inside (Included Products) */}
        {combo.items && combo.items.length > 0 && (
          <div className="mt-12 bg-white rounded-[20px] p-6 sm:p-10 border border-[#E8DFD4] shadow-xs">
            <div className="flex items-center gap-2.5 mb-6">
              <Package className="h-6 w-6 text-[#BF5330]" />
              <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
                What&apos;s Inside this Combo ({combo.items.length} Included Products)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {combo.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4 flex items-center justify-between gap-3 hover:border-[#BF5330]/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-7 w-7 rounded-full bg-white border border-[#E8DFD4] flex items-center justify-center text-xs font-bold text-[#BF5330]">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1A1614] leading-snug">
                        {item.itemTitle}
                      </h4>
                      {item.quantity > 1 && (
                        <span className="text-xs text-[#7A6E65]">Qty: {item.quantity}</span>
                      )}
                    </div>
                  </div>
                  {item.unit && (
                    <span className="rounded-[6px] bg-white border border-[#E8DFD4] px-2.5 py-1 text-xs font-bold text-[#56634A] whitespace-nowrap">
                      {item.unit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section: Full Description */}
        {combo.description && (
          <div className="mt-8 bg-white rounded-[20px] p-6 sm:p-10 border border-[#E8DFD4] shadow-xs">
            <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614] mb-4">
              About this Combo
            </h2>
            <div className="prose prose-sm sm:prose max-w-none text-[#4A3B32] leading-relaxed whitespace-pre-line font-[family-name:var(--font-body)]">
              {combo.description}
            </div>
          </div>
        )}

        {/* Section: Other Available Combos */}
        {otherCombos.length > 0 && (
          <div className="mt-16">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold text-[#1A1614] text-center mb-8">
              Explore More Combo Offers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherCombos
                .filter((o) => o.slug !== combo.slug)
                .slice(0, 3)
                .map((other) => (
                  <Link
                    key={other.id}
                    href={`/combo-offers/${other.slug}`}
                    className="group bg-white rounded-[16px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-md hover:border-[#BF5330]/50 transition-all flex flex-col justify-between"
                  >
                    <div className="relative aspect-[4/3] w-full bg-[#FAF5EE]">
                      <Image
                        src={other.imageUrl || other.desktopImageUrl || "/hero1.jpeg"}
                        alt={other.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 350px"
                        className="object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      {other.offerBadge && (
                        <div className="absolute top-3 left-3 bg-[#BF5330] text-white font-bold text-[10px] uppercase tracking-wider px-2 py-1 rounded-[4px]">
                          {other.offerBadge}
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-[family-name:var(--font-heading)] font-bold text-lg text-[#1A1614] group-hover:text-[#BF5330] transition-colors">
                          {other.name}
                        </h3>
                        {other.shortDescription && (
                          <p className="mt-1.5 text-xs text-[#7A6E65] line-clamp-2">
                            {other.shortDescription}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-[#E8DFD4] flex items-center justify-between">
                        <span className="font-[family-name:var(--font-price)] font-bold text-lg text-[#BF5330]">
                          {formatRupee(other.pricePaise)}
                        </span>
                        <span className="text-xs font-bold text-[#BF5330] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          View Offer <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

