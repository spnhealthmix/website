"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Check, Loader2, Plus, Minus, ArrowRight, Sparkles, Truck } from "lucide-react";
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
  const { addItem, isVariantMutating } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];
  const isPending = isVariantMutating(selectedVariant?.id);
  const maxAvailable = selectedVariant ? Math.min(selectedVariant.stock, 10) : 0;
  const isOutOfStock = !selectedVariant || selectedVariant.stock <= 0;

  async function handleAddToCart() {
    if (!selectedVariant || isOutOfStock || isPending) return;
    setErrorMessage(null);
    try {
      const success = await addItem(selectedVariant.id, quantity);
      if (success) {
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add to cart. Please try again.";
      setErrorMessage(msg);
    }
  }

  function handleIncrement() {
    if (quantity < maxAvailable) {
      setQuantity((q) => q + 1);
    }
  }

  function handleDecrement() {
    if (quantity > 1) {
      setQuantity((q) => q - 1);
    }
  }

  if (!selectedVariant) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Price Summary */}
      <div className="flex items-baseline justify-between border-t border-[#E8DFD4] pt-3.5">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-price)] text-2xl font-bold tracking-tight text-[#BF5330]">
            {formatRupee(selectedVariant.pricePaise)}
          </span>
          {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise && (
            <span className="font-[family-name:var(--font-price)] text-sm font-medium text-[#7A6E65] line-through">
              {formatRupee(selectedVariant.mrpPaise)}
            </span>
          )}
        </div>
        {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise && (
          <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2 py-0.5 text-[11px] font-bold text-[#BF5330]">
            Save {formatRupee(selectedVariant.mrpPaise - selectedVariant.pricePaise)}
          </span>
        )}
      </div>

      {/* Stock warning if low */}
      {!isOutOfStock && selectedVariant.stock < 10 && (
        <p className="text-xs font-medium text-[#C99A3B]">
          Only {selectedVariant.stock} left in stock!
        </p>
      )}

      {/* Quantity & Add to Cart button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div
          className="flex h-[42px] items-center justify-between rounded-[6px] border border-[#E8DFD4] bg-[#FFFBF7] px-2 shadow-xs sm:w-32"
          role="group"
          aria-label="Quantity selector"
        >
          <button
            type="button"
            onClick={handleDecrement}
            disabled={quantity <= 1 || isPending || isOutOfStock}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#4A3B32] hover:bg-[#FAF5EE] hover:text-[#BF5330] disabled:opacity-30 transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="font-[family-name:var(--font-price)] font-bold text-[#1A1614] text-sm tabular-nums px-2">
            {quantity}
          </span>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={quantity >= maxAvailable || isPending || isOutOfStock}
            className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#4A3B32] hover:bg-[#FAF5EE] hover:text-[#BF5330] disabled:opacity-30 transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isPending || isOutOfStock}
          className={`flex-1 h-[42px] flex items-center justify-center gap-2 rounded-[6px] px-5 text-sm font-semibold shadow-xs transition-all duration-200 font-[family-name:var(--font-body)] ${
            justAdded
              ? "bg-[#247B49] text-white"
              : isOutOfStock
              ? "bg-[#FAF5EE] border border-[#E8DFD4] text-[#7A6E65] cursor-not-allowed"
              : "bg-[#BF5330] text-white hover:bg-[#8F3E20] active:scale-[0.99]"
          }`}
          aria-live="polite"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Adding to Cart...</span>
            </>
          ) : justAdded ? (
            <>
              <Check className="h-4 w-4 text-white stroke-[3]" />
              <span>Added to Cart!</span>
            </>
          ) : isOutOfStock ? (
            <span>Sold Out</span>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              <span>Add to Cart • {formatRupee(selectedVariant.pricePaise * quantity)}</span>
            </>
          )}
        </button>
      </div>

      {/* Success notification & Quick checkout link */}
      {justAdded && (
        <div className="flex items-center justify-between rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4] px-3.5 py-2 text-xs text-[#247B49] animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="font-semibold flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" /> Item added to your cart!
          </span>
          <Link
            href="/cart"
            className="inline-flex items-center font-bold text-[#BF5330] hover:text-[#8F3E20] hover:underline ml-2"
          >
            View Cart & Checkout <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4] px-3 py-2 text-xs text-[#BF5330]">
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export function ComboOffersView({
  comboData,
}: {
  comboData: Record<string, ComboOfferItem>;
}) {
  const familyCombo = comboData["family-combo-offer"] ?? FALLBACK_COMBO_DATA["family-combo-offer"];
  const sweetLaddus = comboData["sweet-laddus-combo"] ?? FALLBACK_COMBO_DATA["sweet-laddus-combo"];
  const spicyPodi = comboData["spicy-podi-varieties-combo"] ?? FALLBACK_COMBO_DATA["spicy-podi-varieties-combo"];
  const bananaChips = comboData["nendram-banana-chips"] ?? FALLBACK_COMBO_DATA["nendram-banana-chips"];

  const [selectedChipsVariantId, setSelectedChipsVariantId] = useState<string>(() => {
    return bananaChips?.variants[0]?.id || "";
  });

  return (
    <div className="min-h-screen bg-[#FFFBF7] py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] text-[#BF5330] text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.14em] mb-3">
            <Sparkles className="h-3 w-3" />
            Limited Time Offers
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#1A1614]">
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

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Card 1: Family Combo Offer */}
          <article className="flex flex-col bg-white rounded-[16px] lg:rounded-[20px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-sm hover:border-[#D6C7BA] transition-all duration-200">
            <div className="relative aspect-[4/3] w-full bg-[#FAF5EE] overflow-hidden">
              <Image
                src="/hero1.jpeg"
                alt="Family Combo Offer poster showcasing 12 traditional food products for ₹999 with original MRP of ₹1,599"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-[#1A1614]/5 hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-[#BF5330] text-white font-bold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-xs">
                Super Saver
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
                    Family Combo Offer
                  </h2>
                  <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[11px] font-bold text-[#BF5330] whitespace-nowrap">
                    12-in-1 Pack
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#4A3B32] leading-relaxed">
                  Comprehensive mega saver pack featuring 12 traditional wholesome essentials for the whole family: health mixes, authentic podis, and handcrafted delights.
                </p>

                <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                    Package Highlights
                  </h3>
                  <ul className="grid grid-cols-2 gap-2 text-xs text-[#4A3B32] font-medium">
                    <li className="flex items-center gap-1.5"><span className="text-[#247B49] font-bold">✓</span> Traditional Health Mix</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#247B49] font-bold">✓</span> Homemade Podi Varieties</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#247B49] font-bold">✓</span> Nutrient-Dense Laddus</li>
                    <li className="flex items-center gap-1.5"><span className="text-[#247B49] font-bold">✓</span> Pure Native Ingredients</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                {familyCombo && (
                  <AddToCartControl
                    product={familyCombo}
                    selectedVariantId={familyCombo.variants[0]?.id || ""}
                  />
                )}
              </div>
            </div>
          </article>

          {/* Card 2: Sweet Laddu's Combo */}
          <article className="flex flex-col bg-white rounded-[16px] lg:rounded-[20px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-sm hover:border-[#D6C7BA] transition-all duration-200">
            <div className="relative aspect-[4/3] w-full bg-[#FAF5EE] overflow-hidden">
              <Image
                src="/hero2.jpeg"
                alt="Fast Moving Sweet Laddu's Combo poster featuring Kadalai Urundai, Ellu Urundai, Rava Laddu, and Karuppu Kavuni Laddu for ₹499"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-[#1A1614]/5 hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-[#C99A3B] text-white font-bold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-xs">
                Fast Moving
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
                    Fast Moving Sweet Laddu&apos;s Combo
                  </h2>
                  <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[11px] font-bold text-[#C99A3B] whitespace-nowrap">
                    4 Packs (1 kg total)
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#4A3B32] leading-relaxed">
                  Four signature South Indian traditional laddus prepared with natural jaggery and pure native ingredients.
                </p>

                <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                    What&apos;s Inside (250g each):
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#4A3B32] font-medium">
                    <div className="rounded-[8px] bg-white border border-[#E8DFD4] p-2">
                      🍬 Kadalai Urundai (250 g)
                    </div>
                    <div className="rounded-[8px] bg-white border border-[#E8DFD4] p-2">
                      🍬 Ellu Urundai (250 g)
                    </div>
                    <div className="rounded-[8px] bg-white border border-[#E8DFD4] p-2">
                      🍬 Rava Laddu (250 g)
                    </div>
                    <div className="rounded-[8px] bg-white border border-[#E8DFD4] p-2">
                      🍬 Karuppu Kavuni Laddu (250 g)
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {sweetLaddus && (
                  <AddToCartControl
                    product={sweetLaddus}
                    selectedVariantId={sweetLaddus.variants[0]?.id || ""}
                  />
                )}
              </div>
            </div>
          </article>

          {/* Card 3: Spicy Podi Varieties Combo */}
          <article className="flex flex-col bg-white rounded-[16px] lg:rounded-[20px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-sm hover:border-[#D6C7BA] transition-all duration-200">
            <div className="relative aspect-[4/3] w-full bg-[#FAF5EE] overflow-hidden">
              <Image
                src="/hero3.jpeg"
                alt="Spicy Podi Varieties Combo poster featuring 6 traditional rice and idli podis for ₹349"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-[#1A1614]/5 hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-[#56634A] text-white font-bold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-xs">
                Authentic Taste
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
                    Spicy Podi Varieties Combo
                  </h2>
                  <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[11px] font-bold text-[#56634A] whitespace-nowrap">
                    6 Varieties (300g total)
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#4A3B32] leading-relaxed">
                  Six aromatic, traditionally roasted spice powders made with pure native herbs and lentils. Perfect with warm rice and ghee or soft idlis.
                </p>

                <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                    Included Flavours (50g each):
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-[#4A3B32] font-medium">
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Paruppu Podi
                    </span>
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Idli Podi
                    </span>
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Poondu Podi
                    </span>
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Puliyodharai Podi
                    </span>
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Karuveppilai Podi
                    </span>
                    <span className="rounded-[8px] bg-white border border-[#E8DFD4] p-2 text-center">
                      Murungai Leaves
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                {spicyPodi && (
                  <AddToCartControl
                    product={spicyPodi}
                    selectedVariantId={spicyPodi.variants[0]?.id || ""}
                  />
                )}
              </div>
            </div>
          </article>

          {/* Card 4: Nendram Banana Chips */}
          <article className="flex flex-col bg-white rounded-[16px] lg:rounded-[20px] overflow-hidden border border-[#E8DFD4] shadow-xs hover:shadow-sm hover:border-[#D6C7BA] transition-all duration-200">
            <div className="relative aspect-[4/3] w-full bg-[#FAF5EE] overflow-hidden">
              <Image
                src="/hero4.jpeg"
                alt="Crispy Kerala Nendram Banana Chips promotional poster with pricing for 250g, 500g, and 1kg packs"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-[#1A1614]/5 hover:scale-[1.01] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-[#824629] text-white font-bold text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-[6px] shadow-xs">
                Crispy & Fresh
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[#1A1614]">
                    Kerala Nendram Banana Chips
                  </h2>
                  <span className="rounded-[6px] bg-[#FAF5EE] border border-[#E8DFD4] px-2.5 py-1 text-[11px] font-bold text-[#824629] whitespace-nowrap">
                    Pure Coconut Oil
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#4A3B32] leading-relaxed">
                  Golden, crispy, wafer-thin banana chips made from premium Nendram bananas sliced and fried to perfection in pure coconut oil with a pinch of rock salt.
                </p>

                {/* Pack Size Selector */}
                {bananaChips && bananaChips.variants.length > 0 && (
                  <div className="mt-4 rounded-[12px] bg-[#FAF5EE]/70 border border-[#E8DFD4] p-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#7A6E65] mb-2 font-[family-name:var(--font-body)]">
                      Choose Pack Size:
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {bananaChips.variants.map((v) => {
                        const isSelected = (selectedChipsVariantId || bananaChips.variants[0].id) === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setSelectedChipsVariantId(v.id)}
                            className={`flex flex-col items-center justify-center rounded-[6px] p-2 text-center transition-all ${
                              isSelected
                                ? "bg-[#FDF3EE] border-2 border-[#BF5330] text-[#BF5330] font-semibold shadow-2xs"
                                : "bg-white text-[#1A1614] border border-[#E8DFD4] hover:border-[#BF5330]/50 hover:bg-[#FAF5EE] font-medium"
                            }`}
                          >
                            <span className="text-[11px]">{v.label}</span>
                            <span className={`text-xs font-bold font-[family-name:var(--font-price)] mt-0.5 ${isSelected ? "text-[#BF5330]" : "text-[#4A3B32]"}`}>
                              {formatRupee(v.pricePaise)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                {bananaChips && (
                  <AddToCartControl
                    product={bananaChips}
                    selectedVariantId={selectedChipsVariantId || bananaChips.variants[0]?.id || ""}
                  />
                )}
              </div>
            </div>
          </article>
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
