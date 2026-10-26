"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { RazorpayCheckoutButton } from "@/components/checkout/razorpay-checkout-button";

export default function RazorpayDemoPage() {
  const [amountRupees, setAmountRupees] = useState(500);
  const [customerName, setCustomerName] = useState("Jane Doe");
  const [customerEmail, setCustomerEmail] = useState("jane.doe@example.com");
  const [customerPhone, setCustomerPhone] = useState("9876543210");
  const [lastPayment, setLastPayment] = useState<any>(null);

  const amountPaise = Math.round(Number(amountRupees || 0) * 100);

  return (
    <div className="min-h-screen bg-[var(--color-bg-subtle,#FFFBF7)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-primary,#B4491F)] hover:underline mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>

        <div className="overflow-hidden rounded-2xl border border-[var(--color-border,#E8DFD6)] bg-white shadow-sm">
          <div className="border-b border-[var(--color-border,#E8DFD6)] bg-gradient-to-r from-orange-50/50 to-amber-50/30 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-brand-primary,#B4491F)] text-white shadow-sm">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary,#2D241E)]">
                  Razorpay Standard Checkout
                </h1>
                <p className="text-xs text-[var(--color-text-muted,#786B62)] mt-0.5">
                  Test orders, web checkout modal, and HMAC-SHA256 verification
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-1.5">
                Amount (INR ₹)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-[var(--color-border,#E8DFD6)] py-2.5 pl-8 pr-4 text-sm font-semibold focus:border-[var(--color-brand-primary,#B4491F)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#B4491F)]"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Converted to {amountPaise} paise (minimum 100 paise)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-1.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border,#E8DFD6)] py-2 px-3 text-sm focus:border-[var(--color-brand-primary,#B4491F)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#B4491F)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border,#E8DFD6)] py-2 px-3 text-sm focus:border-[var(--color-brand-primary,#B4491F)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#B4491F)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border,#E8DFD6)] py-2 px-3 text-sm focus:border-[var(--color-brand-primary,#B4491F)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary,#B4491F)]"
              />
            </div>

            <div className="pt-3">
              <RazorpayCheckoutButton
                amountPaise={amountPaise}
                currency="INR"
                orderName="SPN Health Mix"
                description={`Order for ${customerName || "Customer"}`}
                customerName={customerName}
                customerEmail={customerEmail}
                customerPhone={customerPhone}
                buttonText={`Pay ₹${amountRupees} with Razorpay`}
                onSuccess={(data) => {
                  setLastPayment(data);
                }}
              />
            </div>

            {lastPayment && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs font-mono text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-body font-semibold mb-2 text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Verified Payment Response
                </div>
                <div><span className="text-emerald-700">Payment ID:</span> {lastPayment.razorpay_payment_id}</div>
                <div><span className="text-emerald-700">Order ID:</span> {lastPayment.razorpay_order_id}</div>
                <div><span className="text-emerald-700">Signature:</span> {lastPayment.razorpay_signature}</div>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-border,#E8DFD6)] bg-gray-50/50 p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted,#786B62)]">
              Secured with Razorpay Standard 256-bit SSL encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
