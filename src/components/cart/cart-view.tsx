"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Trash2, AlertCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatPrice } from "@/lib/utils";
import type { CartLineView } from "@/lib/cart/cart";

export function CartView() {
  const { cart, isLoading, isMutating, updateQuantity, removeItem, clearCart } = useCart();
  const [clearing, setClearing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponDiscountPaise, setCouponDiscountPaise] = useState<number>(0);
  const [offerDiscountPaise, setOfferDiscountPaise] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  if (isLoading && !cart) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-brand-primary)] border-t-transparent mb-4" />
        <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)]">
          Loading your cart...
        </p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />;
  }

  const { items, summary } = cart;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError(null);

    try {
      const res = await fetch("/api/cart/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: couponInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        throw new Error(data.error || "Invalid coupon code.");
      }
      setAppliedCouponCode(data.appliedCoupon?.code ?? couponInput.trim().toUpperCase());
      setCouponDiscountPaise(data.couponDiscountPaise ?? 0);
      setOfferDiscountPaise(data.offerDiscountPaise ?? 0);
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon.");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(null);
    setCouponDiscountPaise(0);
    setCouponInput("");
    setCouponError(null);
  };

  const handleClear = async () => {
    if (confirm("Are you sure you want to clear your cart?")) {
      setClearing(true);
      await clearCart();
      setClearing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-start">
      {/* Items list */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] mb-4">
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)]">
            {summary.lineCount} item{summary.lineCount !== 1 ? "s" : ""} ({summary.totalQuantity} total quantity)
          </p>
          <button
            onClick={handleClear}
            disabled={isMutating || clearing}
            className="font-[family-name:var(--font-body)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-error)] rounded px-1"
          >
            {clearing ? "Clearing..." : "Clear Cart"}
          </button>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <CartItemRow
              key={item.variantId}
              item={item}
              isMutating={isMutating}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div className="pt-6">
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 font-[family-name:var(--font-body)] text-sm text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-dark)] font-medium transition-colors"
          >
            ← Continue Shopping
          </Link>
        </div>
      </div>

      {/* Order Summary Sidebar */}
      <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[8px] p-6 lg:sticky lg:top-24">
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-[var(--color-text-primary)] mb-4 pb-3 border-b border-[var(--color-border-subtle)]">
          Order Summary
        </h2>

        <div className="space-y-3 font-[family-name:var(--font-body)] text-sm mb-6">
          <div className="flex items-center justify-between text-[var(--color-text-body)]">
            <span>Items Subtotal</span>
            <span className="font-semibold text-[var(--color-text-primary)] font-[family-name:var(--font-price)]">
              {formatPrice(summary.subtotalPaise)}
            </span>
          </div>

          {summary.savingsPaise > 0 && (
            <div className="flex items-center justify-between text-[var(--color-success)] font-[family-name:var(--font-price)]">
              <span>Your Savings</span>
              <span>−{formatPrice(summary.savingsPaise)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)] leading-relaxed">
            Shipping charges calculated during checkout based on your delivery address.
          </div>
        </div>

        {/* Coupon Preview Section */}
        <div className="pt-4 border-t border-[var(--color-border)] mb-4">
          <span className="block text-xs font-semibold text-[var(--color-text-primary)] mb-2">
            Have a coupon?
          </span>

          {appliedCouponCode ? (
            <div className="flex items-center justify-between rounded-[6px] bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-800">Coupon:</span>
                <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                  {appliedCouponCode}
                </span>
                {couponDiscountPaise > 0 && (
                  <span className="text-emerald-700 font-[family-name:var(--font-price)] font-medium">
                    (-{formatPrice(couponDiscountPaise)})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="font-medium text-rose-600 hover:text-rose-800 transition-colors"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="flex-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-mono uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponInput.trim()}
                  className="rounded-[6px] bg-[var(--color-brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-primary-dark)] transition-colors disabled:opacity-50"
                >
                  {couponLoading ? "..." : "Apply"}
                </button>
              </div>
              {couponError && (
                <p className="text-[11px] text-[var(--color-error)] font-medium">
                  {couponError}
                </p>
              )}
            </form>
          )}
        </div>

        <div className="pt-2 border-t border-[var(--color-border)] mb-6 space-y-2 text-xs font-[family-name:var(--font-body)]">
          {offerDiscountPaise > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Promotional Offer</span>
              <span className="font-[family-name:var(--font-price)] font-medium">−{formatPrice(offerDiscountPaise)}</span>
            </div>
          )}
          {couponDiscountPaise > 0 && (
            <div className="flex items-center justify-between text-emerald-700">
              <span>Coupon Discount ({appliedCouponCode})</span>
              <span className="font-[family-name:var(--font-price)] font-medium">−{formatPrice(couponDiscountPaise)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-2 border-t border-[var(--color-border-subtle)]">
            <span className="font-body text-base text-[var(--color-text-primary)] font-semibold">
              Total
            </span>
            <span className="font-[family-name:var(--font-price)] text-2xl font-bold text-[var(--color-brand-primary)]">
              {formatPrice(Math.max(0, summary.subtotalPaise - (offerDiscountPaise + couponDiscountPaise)))}
            </span>
          </div>
        </div>

        {summary.hasIssues && (
          <div className="mb-4 p-3 rounded-[6px] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-start gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Please update or remove items marked with stock warnings before proceeding to checkout.
            </p>
          </div>
        )}

        <Link
          href={summary.canCheckout ? "/checkout" : "#"}
          aria-disabled={!summary.canCheckout || isMutating}
          className={[
            "w-full h-12 flex items-center justify-center gap-2 rounded-[8px] font-[family-name:var(--font-body)] font-semibold text-sm transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
            summary.canCheckout && !isMutating
              ? "bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98]"
              : "bg-[var(--color-border-strong)] text-[var(--color-text-muted)] cursor-not-allowed pointer-events-none",
          ].join(" ")}
        >
          Proceed to Checkout
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function CartItemRow({
  item,
  isMutating,
  onUpdateQuantity,
  onRemove,
}: {
  item: CartLineView;
  isMutating: boolean;
  onUpdateQuantity: (variantId: string, qty: number) => Promise<boolean>;
  onRemove: (variantId: string) => Promise<boolean>;
}) {
  const [localUpdating, setLocalUpdating] = useState(false);

  const handleDecrement = async () => {
    if (item.quantity <= 1) {
      if (confirm(`Remove ${item.productName} from your cart?`)) {
        setLocalUpdating(true);
        try {
          await onRemove(item.variantId);
        } finally {
          setLocalUpdating(false);
        }
      }
    } else {
      setLocalUpdating(true);
      try {
        await onUpdateQuantity(item.variantId, item.quantity - 1);
      } finally {
        setLocalUpdating(false);
      }
    }
  };

  const handleIncrement = async () => {
    if (item.quantity >= 99) return;
    setLocalUpdating(true);
    try {
      await onUpdateQuantity(item.variantId, item.quantity + 1);
    } finally {
      setLocalUpdating(false);
    }
  };

  const handleRemove = async () => {
    setLocalUpdating(true);
    try {
      await onRemove(item.variantId);
    } finally {
      setLocalUpdating(false);
    }
  };

  const isBusy = isMutating || localUpdating;

  return (
    <div className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Product info */}
      <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
        <Link
          href={`/products/${item.productSlug}`}
          className="relative w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-[8px] bg-[var(--color-surface-sunken)] overflow-hidden shrink-0 border border-[var(--color-border)]"
        >
          {item.imageKey ? (
            <Image
              src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""}/${item.imageKey}`}
              alt={item.productName}
              fill
              sizes="(max-width: 640px) 72px, 80px"
              loading="lazy"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-heading font-normal text-2xl text-[var(--color-text-muted)] select-none">
              {item.productName.charAt(0)}
            </div>
          )}
        </Link>

        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <Link
            href={`/products/${item.productSlug}`}
            className="font-[family-name:var(--font-product)] text-[15px] sm:text-base text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] font-medium transition-colors line-clamp-2"
          >
            {item.productName}
          </Link>
          <span className="font-[family-name:var(--font-body)] text-xs text-[var(--color-text-muted)]">
            Size: {item.variantLabel}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5 font-[family-name:var(--font-price)]">
            <span className="font-semibold text-sm text-[var(--color-text-primary)]">
              {formatPrice(item.unitPricePaise)}
            </span>
            {item.mrpPaise > item.unitPricePaise && (
              <span className="text-xs text-[var(--color-text-muted)] line-through font-normal">
                {formatPrice(item.mrpPaise)}
              </span>
            )}
          </div>

          {/* Issue warnings */}
          {item.issue === "UNAVAILABLE" && (
            <span className="font-[family-name:var(--font-body)] text-xs text-[var(--color-error)] font-medium mt-1">
              Currently unavailable
            </span>
          )}
          {item.issue === "OUT_OF_STOCK" && (
            <span className="font-[family-name:var(--font-body)] text-xs text-[var(--color-error)] font-medium mt-1">
              Out of stock
            </span>
          )}
          {item.issue === "INSUFFICIENT_STOCK" && (
            <span className="font-[family-name:var(--font-body)] text-xs text-[var(--color-warning)] font-medium mt-1">
              Only {item.availableQuantity} in stock
            </span>
          )}
        </div>
      </div>

      {/* Controls & Total */}
      <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0">
        {/* Quantity Stepper */}
        <div className="flex items-center border border-[var(--color-border)] rounded-[8px] bg-[var(--color-surface)] overflow-hidden">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={isBusy}
            className="w-8 h-8 flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] active:bg-[var(--color-border)] transition-colors font-medium text-base disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)]"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span
            className="w-9 h-8 flex items-center justify-center text-xs font-semibold font-[family-name:var(--font-body)] text-[var(--color-text-primary)] border-x border-[var(--color-border)] select-none"
            aria-label={`Quantity: ${item.quantity}`}
          >
            {localUpdating ? (
              <span className="w-3 h-3 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin inline-block" aria-hidden="true" />
            ) : (
              item.quantity
            )}
          </span>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={isBusy || (item.availableQuantity > 0 && item.quantity >= item.availableQuantity)}
            className="w-8 h-8 flex items-center justify-center text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] active:bg-[var(--color-border)] transition-colors font-medium text-base disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-brand-primary)]"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        {/* Line Total */}
        <div className="text-right min-w-[70px]">
          <span className="font-[family-name:var(--font-price)] font-semibold text-base text-[var(--color-text-primary)]">
            {formatPrice(item.lineTotalPaise)}
          </span>
        </div>

        {/* Remove button */}
        <button
          type="button"
          onClick={handleRemove}
          disabled={isBusy}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-error)] active:scale-95 transition-all p-1.5 rounded disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-error)]"
          aria-label={`Remove ${item.productName} from cart`}
          title="Remove item"
        >
          {localUpdating ? (
            <span className="w-4 h-4 border-2 border-[var(--color-brand-primary)] border-t-transparent rounded-full animate-spin inline-block" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="py-16 lg:py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center mb-5 text-[var(--color-text-muted)]">
        <ShoppingBag className="h-8 w-8 text-[var(--color-brand-primary)]/70" />
      </div>
      <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-primary)] mb-2">
        Your cart is waiting.
      </h2>
      <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-body)] leading-relaxed mb-8 max-w-sm">
        Explore our traditional health mixes, freshly ground podis, and regional food staples.
      </p>
      <Link
        href="/shop"
        className="inline-flex items-center justify-center h-12 px-7 rounded-[8px] bg-[var(--color-brand-primary)] text-white font-[family-name:var(--font-body)] font-semibold text-sm hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
      >
        Browse Products
      </Link>
    </div>
  );
}
