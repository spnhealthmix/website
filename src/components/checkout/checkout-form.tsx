"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { AddressSelector } from "./address-selector";
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/utils";
import { AlertCircle, Truck } from "lucide-react";


declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm() {
  const router = useRouter();
  const { cart, isLoading: isCartLoading, refreshCart } = useCart();
  const { showToast } = useToast();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [priceChangeWarning, setPriceChangeWarning] = useState<string | null>(null);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);
  const [couponDiscountPaise, setCouponDiscountPaise] = useState<number>(0);
  const [offerDiscountPaise, setOfferDiscountPaise] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

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
      showToast(`Coupon ${data.appliedCoupon?.code} applied!`, "success");
    } catch (err: any) {
      setCouponError(err.message || "Failed to apply coupon.");
      showToast(err.message || "Failed to apply coupon.", "error");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCouponCode(null);
    setCouponDiscountPaise(0);
    setCouponInput("");
    setCouponError(null);
    showToast("Coupon removed.", "info");
  };

  // Shipping quote & serviceability state
  const [shippingQuote, setShippingQuote] = useState<{
    serviceable: boolean;
    ratePaise: number;
    courierName?: string;
    estimatedDays?: number;
    freeShipping?: boolean;
    message?: string;
  } | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [unserviceableError, setUnserviceableError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAddressId) {
      setShippingQuote(null);
      setUnserviceableError(null);
      return;
    }
    let isMounted = true;
    setIsQuoting(true);
    setUnserviceableError(null);

    fetch("/api/shipping/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressId: selectedAddressId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.serviceable === false) {
          setUnserviceableError(data.message || "Delivery is currently unavailable for this pincode.");
          setShippingQuote(null);
        } else {
          setShippingQuote(data);
          setUnserviceableError(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Shipping quote error:", err);
      })
      .finally(() => {
        if (isMounted) setIsQuoting(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedAddressId]);

  // Idempotency key per checkout attempt, generated once on mount
  const idempotencyKeyRef = useRef<string>("");
  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, []);


  if (isCartLoading && !cart) {
    return (
      <div className="py-16 text-center text-[var(--color-text-muted)] font-[family-name:var(--font-body)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent" />
        <p className="mt-3 text-sm">Preparing your checkout details...</p>
      </div>
    );
  }

  if (isPaymentSuccess) {
    return (
      <div className="py-16 text-center text-[var(--color-text-muted)] font-[family-name:var(--font-body)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent" />
        <p className="mt-3 text-base font-medium text-[var(--color-text-primary)]">
          Payment confirmed! Redirecting to your order confirmation...
        </p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    if (isSubmitting) {
      return (
        <div className="py-16 text-center text-[var(--color-text-muted)] font-[family-name:var(--font-body)]">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-primary)] border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">
            Processing your order securely...
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-8 text-center sm:p-12 shadow-[var(--shadow-xs)]">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-primary)]">
          Your cart is empty
        </h2>
        <p className="mt-2 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-body)]">
          Add items to your cart before proceeding to checkout.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-flex items-center justify-center rounded-[8px] bg-[var(--color-brand-primary)] px-6 py-2.5 font-[family-name:var(--font-body)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
        >
          Browse Products
        </Link>
      </div>
    );
  }

  const { items, summary } = cart;
  const totalItemsCount = summary.totalQuantity;

  const handleCheckout = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();

    if (!selectedAddressId) {
      setErrorMessage("Please select or add a delivery address to continue.");
      showToast("Please select a delivery address.", "error");
      return;
    }

    if (items.length === 0) {
      setErrorMessage("Your cart is empty. Please add items before checking out.");
      showToast("Your cart is empty.", "error");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setPriceChangeWarning(null);

    try {
      // 1. Submit checkout request to backend
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          addressId: selectedAddressId,
          note: customerNote.trim() || undefined,
          expectedSubtotalPaise: summary.subtotalPaise,
          couponCode: appliedCouponCode || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Price change conflict (409)
        if (res.status === 409 && data.code === "PRICE_CHANGED") {
          await refreshCart();
          setPriceChangeWarning(
            "Some product prices changed. Your cart has been updated with the latest prices. Please review the new total before proceeding."
          );
          // Generate a fresh idempotency key for the next attempt with updated price
          idempotencyKeyRef.current = crypto.randomUUID();
          setIsSubmitting(false);
          return;
        }

        // Other business errors
        const msg =
          data.message ||
          "We couldn't process your checkout at this moment. Please try again.";
        setErrorMessage(msg);
        showToast(msg, "error");
        setIsSubmitting(false);
        return;
      }

      // 2. Order created, initiate Razorpay
      const {
        orderId,
        orderNumber,
        razorpayOrderId,
        razorpayKeyId,
        amountPaise,
        currency,
      } = data;

      // Ensure Razorpay script is loaded
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        setErrorMessage(
          "Payment gateway could not be loaded. Please check your internet connection and try again."
        );
        setIsSubmitting(false);
        return;
      }

      // If razorpayKeyId is empty or invalid (dev mode without real gateway setup)
      if (!razorpayKeyId) {
        setErrorMessage(
          "Payment gateway is not currently configured for this environment."
        );
        setIsSubmitting(false);
        return;
      }

      // 3. Open Razorpay modal
      const options = {
        key: razorpayKeyId,
        amount: amountPaise,
        currency: currency || "INR",
        name: "SPN Health Mix",
        description: `Order #${orderNumber}`,
        order_id: razorpayOrderId,
        theme: {
          color: "#B4491F",
        },
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          try {
            // 4. Authoritative server verification
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.verified) {
              router.replace(
                `/checkout/failure?orderId=${encodeURIComponent(
                  orderId
                )}&error=${encodeURIComponent(
                  verifyData.message || "Payment verification failed"
                )}`
              );
              return;
            }

            // Successfully verified! Mark payment success to prevent empty cart UI flash
            setIsPaymentSuccess(true);
            const confirmedOrderId = verifyData.orderId || orderId;
            const confirmedOrderNumber = verifyData.orderNumber || orderNumber;
            const isPending = Boolean(
              verifyData.awaitingConfirmation || verifyData.status === "pending_payment"
            );

            // Navigate directly to the existing order confirmation / details page
            router.replace(
              `/checkout/success?orderId=${encodeURIComponent(
                confirmedOrderId
              )}&orderNumber=${encodeURIComponent(confirmedOrderNumber)}${
                isPending ? "&pending=true" : ""
              }`
            );

            // Reconcile client cart in background without blocking immediate navigation
            void refreshCart();
          } catch (verifyErr) {
            console.error("Payment verification network error:", verifyErr);
            router.replace(
              `/checkout/failure?orderId=${encodeURIComponent(
                orderId
              )}&pending=true`
            );
          }
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
            setErrorMessage(
              "Payment window was closed. You can complete your payment whenever you are ready."
            );
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on("payment.failed", function (failResponse: any) {
        console.error("Razorpay payment failed:", failResponse.error);
        setIsSubmitting(false);
        const reason =
          failResponse.error?.description || "Payment could not be completed.";
        setErrorMessage(reason);
        showToast(reason, "error");
      });

      rzpInstance.open();
    } catch (err) {
      console.error("Checkout request failed:", err);
      setErrorMessage(
        "An unexpected error occurred while communicating with the server. Please try again."
      );
      showToast("Network error. Please try again.", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 font-[family-name:var(--font-body)]">
      {/* Price Change Warning Banner */}
      {priceChangeWarning && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[8px] border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-text-primary)]"
        >
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-warning)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">
                Price Update Notice
              </p>
              <p className="mt-1 text-[var(--color-text-body)]">
                {priceChangeWarning}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generic Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-[8px] border border-[var(--color-error)] bg-[var(--color-error-bg)] p-4 text-sm text-[var(--color-error)]"
        >
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Delivery Address & Note (lg:col-span-7) */}
        <div className="space-y-8 lg:col-span-7">
          <section
            aria-labelledby="address-heading"
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-8 shadow-[var(--shadow-xs)]"
          >
            <h2
              id="address-heading"
              className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text-primary)]"
            >
              1. Delivery Address
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Select where you would like your order delivered.
            </p>

            <div className="mt-6">
              <AddressSelector
                selectedAddressId={selectedAddressId}
                onSelectAddress={setSelectedAddressId}
              />
            </div>
          </section>

          {/* Delivery Note */}
          <section
            aria-labelledby="note-heading"
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-8 shadow-[var(--shadow-xs)]"
          >
            <h2
              id="note-heading"
              className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text-primary)]"
            >
              2. Delivery Instructions (Optional)
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Any special instructions for the delivery team.
            </p>

            <div className="mt-4">
              <label htmlFor="customer-note" className="sr-only">
                Delivery notes
              </label>
              <textarea
                id="customer-note"
                rows={3}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="E.g., Landmark, building gate instructions, or preferred call time"
                className="w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand-primary)]"
                maxLength={500}
              />
            </div>
          </section>
        </div>

        {/* Right Column: Order Summary & Payment CTA (lg:col-span-5) */}
        <div className="space-y-6 lg:sticky lg:top-8 lg:col-span-5">
          <section
            aria-labelledby="summary-heading"
            className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 sm:p-8 shadow-[var(--shadow-xs)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
              <h2
                id="summary-heading"
                className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-text-primary)]"
              >
                Order Summary
              </h2>
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"}
              </span>
            </div>

            {/* Cart Items List */}
            <div className="divide-y divide-[var(--color-border)] py-2">
              {items.map((item) => (
                <div key={item.variantId} className="flex gap-4 py-4">
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-sunken)]">
                    {item.imageKey ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || ""}/${item.imageKey}`}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-[family-name:var(--font-logo)] text-[var(--color-brand-primary)] bg-[var(--color-surface-sunken)]">
                        SPN
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 font-[family-name:var(--font-product)] text-sm font-medium text-[var(--color-text-primary)]">
                      {item.productName}
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {item.variantLabel} &times; {item.quantity}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-price)] text-xs font-semibold text-[var(--color-text-primary)]">
                      {formatPrice(item.lineTotalPaise)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon Section */}
            <div className="border-t border-[var(--color-border)] py-4">
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
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-mono uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-brand-primary)]"
                    />
                    <button
                      type="submit"
                      disabled={couponLoading || !couponInput.trim()}
                      className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {couponLoading && (
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                      )}
                      <span>{couponLoading ? "Applying..." : "Apply"}</span>
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

            {/* Price Calculations */}
            <div className="space-y-3 border-t border-[var(--color-border)] pt-4 text-sm">
              <div className="flex justify-between text-[var(--color-text-body)]">
                <span>Subtotal</span>
                <span className="font-[family-name:var(--font-price)] font-medium">{formatPrice(summary.subtotalPaise)}</span>
              </div>
              {offerDiscountPaise > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promotional Offer</span>
                  <span className="font-[family-name:var(--font-price)] font-medium">-{formatPrice(offerDiscountPaise)}</span>
                </div>
              )}
              {couponDiscountPaise > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon Discount ({appliedCouponCode})</span>
                  <span className="font-[family-name:var(--font-price)] font-medium">-{formatPrice(couponDiscountPaise)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--color-text-body)]">
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  <span>Shipping</span>
                </span>
                <span>
                  {isQuoting ? (
                    <span className="text-[var(--color-text-muted)] animate-pulse">Calculating...</span>
                  ) : shippingQuote ? (
                    shippingQuote.freeShipping || shippingQuote.ratePaise === 0 ? (
                      <span className="text-emerald-700 font-medium">Free</span>
                    ) : (
                      <span className="font-[family-name:var(--font-price)]">{formatPrice(shippingQuote.ratePaise)}</span>
                    )
                  ) : selectedAddressId ? (
                    <span>Calculated at checkout</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">Select address</span>
                  )}
                </span>
              </div>
              {shippingQuote?.courierName && (
                <div className="text-[11px] text-[var(--color-text-muted)] text-right -mt-1.5">
                  Delivered by {shippingQuote.courierName}
                  {shippingQuote.estimatedDays ? ` (~${shippingQuote.estimatedDays} days)` : ""}
                </div>
              )}
              {unserviceableError && (
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{unserviceableError}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[var(--color-border)] pt-3 text-base font-semibold text-[var(--color-text-primary)]">
                <span>Payable Amount</span>
                <span className="font-[family-name:var(--font-price)] text-lg font-bold text-[var(--color-brand-primary)]">
                  {formatPrice(
                    Math.max(
                      0,
                      summary.subtotalPaise -
                        (offerDiscountPaise + couponDiscountPaise) +
                        (shippingQuote?.ratePaise ?? 0),
                    ),
                  )}
                </span>
              </div>
            </div>

            {/* Payment Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || !selectedAddressId || !summary.canCheckout || Boolean(unserviceableError) || isQuoting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[8px] bg-[var(--color-brand-primary)] px-6 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                    <span>Processing securely...</span>
                  </>
                ) : (
                  `Pay ${formatPrice(
                    Math.max(
                      0,
                      summary.subtotalPaise -
                        (offerDiscountPaise + couponDiscountPaise) +
                        (shippingQuote?.ratePaise ?? 0),
                    ),
                  )}`
                )}
              </button>

              {!selectedAddressId ? (
                <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                  Please select a delivery address above to enable payment.
                </p>
              ) : unserviceableError ? (
                <p className="mt-2 text-center text-xs text-rose-600 font-medium">
                  Please change delivery address to proceed.
                </p>
              ) : null}
            </div>

            {/* Security note */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[var(--color-text-muted)]">
              <svg
                className="h-3.5 w-3.5 text-[var(--color-text-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>Secured by Razorpay. 100% encrypted transaction.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
