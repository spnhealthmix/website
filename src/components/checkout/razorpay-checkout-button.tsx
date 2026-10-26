"use client";

import React, { useState } from "react";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Loads the official Razorpay Checkout SDK dynamically.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutButtonProps {
  /** Amount in paise (e.g. 50000 for ₹500.00). Minimum 100 paise. */
  amountPaise: number;
  currency?: string;
  orderName?: string;
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentData: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  onFailure?: (error: any) => void;
  onDismiss?: () => void;
}

export function RazorpayCheckoutButton({
  amountPaise,
  currency = "INR",
  orderName = "SPN Health Mix",
  description = "Standard Web Checkout",
  customerName,
  customerEmail,
  customerPhone,
  buttonText,
  className = "",
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    paymentId: string;
    orderId: string;
  } | null>(null);

  const formattedAmount = (amountPaise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  });

  const handlePayment = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      // 1. Ensure Razorpay script is loaded
      const scriptReady = await loadRazorpayScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay checkout SDK. Please verify your connection."
        );
      }

      // 2. Call backend order creation endpoint
      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountPaise,
          currency,
          receipt: `rcpt_${Date.now()}`,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.order_id) {
        throw new Error(
          orderData.error || "Failed to create order on payment gateway"
        );
      }

      const keyId =
        orderData.key_id ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        "";

      // 3. Configure Razorpay modal options
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || currency,
        name: orderName,
        description,
        order_id: orderData.order_id,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: "#B4491F", // SPN Health Mix Terracotta Brand Accent
        },
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          try {
            // 4. Authoritative backend signature verification
            const verifyRes = await fetch("/api/verify-payment", {
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
              const msg =
                verifyData.error ||
                "Payment signature verification failed on the server.";
              setErrorMessage(msg);
              onFailure?.(verifyData);
              return;
            }

            // Success verified!
            setSuccessInfo({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
            });
            onSuccess?.(response);
          } catch (verifyErr: any) {
            console.error("Signature verification error:", verifyErr);
            const msg =
              verifyErr.message ||
              "Network error occurred while verifying your payment.";
            setErrorMessage(msg);
            onFailure?.(verifyErr);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            setErrorMessage("Payment was cancelled or closed.");
            onDismiss?.();
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      // Handle failed payment events
      razorpayInstance.on("payment.failed", function (failResponse: any) {
        console.error("Payment failed event:", failResponse.error);
        const failMsg =
          failResponse.error?.description ||
          failResponse.error?.reason ||
          "Payment attempt failed.";
        setErrorMessage(`Payment Failed: ${failMsg}`);
        onFailure?.(failResponse.error);
        setLoading(false);
      });

      // Open checkout modal
      razorpayInstance.open();
    } catch (err: any) {
      console.error("Razorpay initiation error:", err);
      setErrorMessage(err.message || "Something went wrong initiating payment.");
      setLoading(false);
      onFailure?.(err);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <button
        type="button"
        onClick={handlePayment}
        disabled={loading || amountPaise < 100}
        className={
          className ||
          "inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary,#B4491F)] px-6 py-3 font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        }
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : (
          <span>{buttonText || `Pay with Razorpay (${formattedAmount})`}</span>
        )}
      </button>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successInfo && (
        <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold">Payment Successful & Verified!</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Payment ID: <span className="font-mono">{successInfo.paymentId}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
