"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ShoppingCart, Check, Loader2, Plus, Minus, ArrowRight } from "lucide-react";
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
      <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-emerald-800">
            {formatRupee(selectedVariant.pricePaise)}
          </span>
          {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise && (
            <span className="text-sm font-medium text-slate-400 line-through">
              {formatRupee(selectedVariant.mrpPaise)}
            </span>
          )}
        </div>
        {selectedVariant.mrpPaise && selectedVariant.mrpPaise > selectedVariant.pricePaise && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            Save {formatRupee(selectedVariant.mrpPaise - selectedVariant.pricePaise)}
          </span>
        )}
      </div>

      {/* Stock warning if low */}
      {!isOutOfStock && selectedVariant.stock < 10 && (
        <p className="text-xs font-medium text-amber-700">
          Only {selectedVariant.stock} left in stock!
        </p>
      )}

      {/* Quantity & Add to Cart button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm sm:w-32"
          role="group"
          aria-label="Quantity selector"
        >
          <button
            type="button"
            onClick={handleDecrement}
            disabled={quantity <= 1 || isPending || isOutOfStock}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="font-semibold text-slate-800 text-sm tabular-nums px-2">
            {quantity}
          </span>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={quantity >= maxAvailable || isPending || isOutOfStock}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isPending || isOutOfStock}
          className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition-all duration-200 ${
            justAdded
              ? "bg-emerald-700 text-white"
              : isOutOfStock
              ? "bg-slate-200 text-slate-500 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
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
              <Check className="h-4 w-4 text-emerald-200 stroke-[3]" />
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
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 animate-in fade-in slide-in-from-top-1 duration-200">
          <span className="font-medium">Item added to your cart!</span>
          <Link
            href="/cart"
            className="inline-flex items-center font-bold text-emerald-700 hover:text-emerald-800 hover:underline ml-2"
          >
            View Cart & Checkout <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </div>
      )}

      {/* Error notification */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20 py-10 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-3">
            Limited Time Offers
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
            Exclusive Combo Offers
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">
            Experience the authentic taste of tradition with our handpicked value packs. Freshly prepared, hygienically packed, and delivered right to your doorstep.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-medium text-emerald-800">
            <span className="inline-flex items-center gap-1.5 bg-white shadow-sm border border-emerald-100 px-3 py-1.5 rounded-full">
              🚚 Free shipping on orders ₹500+ in Tamil Nadu
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white shadow-sm border border-emerald-100 px-3 py-1.5 rounded-full">
              ✨ 100% Homemade Quality
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
          {/* Card 1: Family Combo Offer */}
          <article className="flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-md hover:shadow-xl transition-shadow duration-300">
            <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
              <Image
                src="/hero1.jpeg"
                alt="Family Combo Offer poster showcasing 12 traditional food products for ₹999 with original MRP of ₹1,599"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-slate-900/5 hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-red-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                Super Saver
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Family Combo Offer
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 whitespace-nowrap">
                    12-in-1 Pack
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Comprehensive mega saver pack featuring 12 traditional wholesome essentials for the whole family: health mixes, authentic podis, and handcrafted delights.
                </p>

                <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Package Highlights
                  </h3>
                  <ul className="grid grid-cols-2 gap-1.5 text-xs text-slate-700">
                    <li className="flex items-center gap-1.5">✓ Traditional Health Mix</li>
                    <li className="flex items-center gap-1.5">✓ Homemade Podi Varieties</li>
                    <li className="flex items-center gap-1.5">✓ Nutrient-Dense Laddus</li>
                    <li className="flex items-center gap-1.5">✓ Pure Native Ingredients</li>
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
          <article className="flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-md hover:shadow-xl transition-shadow duration-300">
            <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
              <Image
                src="/hero2.jpeg"
                alt="Fast Moving Sweet Laddu's Combo poster featuring Kadalai Urundai, Ellu Urundai, Rava Laddu, and Karuppu Kavuni Laddu for ₹499"
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-slate-900/5 hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-amber-500 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                Fast Moving
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Fast Moving Sweet Laddu&apos;s Combo
                  </h2>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 whitespace-nowrap">
                    4 Packs (1 kg total)
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Four signature South Indian traditional laddus prepared with natural jaggery and pure native ingredients.
                </p>

                <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    What&apos;s Inside (250g each):
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 font-medium">
                    <div className="rounded-lg bg-white border border-slate-200/60 p-2">
                      🍬 Kadalai Urundai (250 g)
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200/60 p-2">
                      🍬 Ellu Urundai (250 g)
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200/60 p-2">
                      🍬 Rava Laddu (250 g)
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200/60 p-2">
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
          <article className="flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-md hover:shadow-xl transition-shadow duration-300">
            <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
              <Image
                src="/hero3.jpeg"
                alt="Spicy Podi Varieties Combo poster featuring 6 traditional rice and idli podis for ₹349"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-slate-900/5 hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-orange-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                Authentic Taste
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Spicy Podi Varieties Combo
                  </h2>
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 whitespace-nowrap">
                    6 Varieties (300g total)
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Six aromatic, traditionally roasted spice powders made with pure native herbs and lentils. Perfect with warm rice and ghee or soft idlis.
                </p>

                <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Included Flavours (50g each):
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-700 font-medium">
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                      Paruppu Podi
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                      Idli Podi
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                      Poondu Podi
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                      Puliyodharai Podi
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                      Karuveppilai Podi
                    </span>
                    <span className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
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
          <article className="flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-md hover:shadow-xl transition-shadow duration-300">
            <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
              <Image
                src="/hero4.jpeg"
                alt="Crispy Kerala Nendram Banana Chips promotional poster with pricing for 250g, 500g, and 1kg packs"
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                className="object-contain bg-slate-900/5 hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="absolute top-4 left-4 bg-yellow-600 text-white font-bold text-xs uppercase px-3 py-1 rounded-full shadow-sm">
                Crispy & Fresh
              </div>
            </div>

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Kerala Nendram Banana Chips
                  </h2>
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800 whitespace-nowrap">
                    Pure Coconut Oil
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Golden, crispy, wafer-thin banana chips made from premium Nendram bananas sliced and fried to perfection in pure coconut oil with a pinch of rock salt.
                </p>

                {/* Pack Size Selector */}
                {bananaChips && bananaChips.variants.length > 0 && (
                  <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
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
                            className={`flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all ${
                              isSelected
                                ? "bg-emerald-600 text-white font-semibold shadow-sm ring-2 ring-emerald-600 ring-offset-1"
                                : "bg-white text-slate-700 border border-slate-200/80 hover:border-emerald-300 font-medium"
                            }`}
                          >
                            <span className="text-xs">{v.label}</span>
                            <span className={`text-sm font-bold mt-0.5 ${isSelected ? "text-white" : "text-emerald-800"}`}>
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
        <div className="mt-16 rounded-3xl bg-emerald-800 text-white p-8 sm:p-12 text-center shadow-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Looking for our Full Traditional Range?
            </h2>
            <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
              Explore our whole collection of nutritious health mixes, sprouted grain flours, natural sweeteners, and authentic cold-pressed oils.
            </p>
            <div className="pt-2">
              <Link
                href="/shop"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-emerald-900 shadow hover:bg-emerald-50 active:scale-95 transition-all"
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
