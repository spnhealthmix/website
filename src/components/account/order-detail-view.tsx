"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  MapPin,
  AlertCircle,
  Truck,
  Package,
  Check,
  CheckCircle2,
  ExternalLink,
  Clock,
  Home,
  Headphones,
  MessageSquare,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { AddressSnapshot } from "@/lib/db/schema";

interface TrackingEventData {
  id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurredAt: string;
}

interface ShipmentData {
  id?: string;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  events?: TrackingEventData[];
}

interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingAddress: AddressSnapshot;
  customerNote: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    sku: string;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
    imageUrl?: string | null;
  }[];
  shipments?: ShipmentData[];
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "confirmed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF5ED] text-[#2E7D32] border border-[#C8E6C9]">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Confirmed</span>
        </span>
      );
    case "processing":
    case "packed":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FDF4ED] text-[#BF5330] border border-[#F4DFD7]">
          <Package className="w-3.5 h-3.5" />
          <span>Processing</span>
        </span>
      );
    case "shipped":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EFF8FF] text-[#175CD3] border border-[#B2DDFF]">
          <Truck className="w-3.5 h-3.5" />
          <span>Shipped</span>
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#EBF5ED] text-[#2E7D32] border border-[#C8E6C9]">
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Delivered</span>
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Cancelled</span>
        </span>
      );
    case "pending_payment":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FFF4D6] text-[#D49434] border border-[#FCE19B]">
          <Clock className="w-3.5 h-3.5" />
          <span>Pending Confirmation</span>
        </span>
      );
  }
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadOrder() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/me/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404 || res.status === 401 || res.status === 403) {
            if (isMounted) setError("Order not found.");
            return;
          }
          throw new Error("Failed to load order");
        }
        const data = await res.json();
        if (isMounted) setOrder(data);
      } catch (err) {
        console.error("Order detail error:", err);
        if (isMounted) setError("We couldn't load this order. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  if (loading) {
    return (
      <div className="p-12 text-center text-[#786B62] font-[family-name:var(--font-body)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#BF5330] border-t-transparent" />
        <p className="mt-3 text-sm font-medium">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-8 sm:p-12 rounded-2xl border border-[#E8DFD4] bg-white text-center font-body max-w-lg mx-auto shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
        <div className="w-12 h-12 rounded-full bg-orange-50 text-[#BF5330] flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="font-heading text-xl font-normal text-[#1A1614] mb-2">
          Order Not Found
        </h2>
        <p className="text-xs sm:text-sm text-[#786B62] mb-6 leading-relaxed">
          The requested order could not be found or is not associated with your account.
        </p>
        <Link
          href="/account/orders"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs sm:text-sm font-semibold transition-colors shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Back to My Orders</span>
        </Link>
      </div>
    );
  }

  const placedDate = new Date(order.createdAt);
  const datePart = placedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = placedDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).toLowerCase();
  const dateStr = `Placed on ${datePart} at ${timePart}`;

  const addr = order.shippingAddress;
  const isCancelled = order.status === "cancelled";
  const isPending = order.status === "pending_payment";
  const isConfirmed = !isCancelled && !isPending;
  const isShipped = order.status === "shipped" || order.status === "delivered";
  const isDelivered = order.status === "delivered";

  const primaryShipment = order.shipments && order.shipments.length > 0 ? order.shipments[0] : null;

  return (
    <div className="space-y-6 sm:space-y-7 font-body">
      {/* Top Header Row */}
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#BF5330] hover:text-[#8F3E20] transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Orders</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl sm:text-[30px] font-normal text-[#1A1614] tracking-tight leading-tight">
                Order <span className="font-order-id font-bold">#{order.orderNumber}</span>
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-xs sm:text-sm text-[#786B62]">
              {dateStr}
            </p>
          </div>

          <div className="text-left sm:text-right pt-1 sm:pt-0">
            <span className="text-xs font-medium text-[#786B62] block">Total Paid</span>
            <span className="font-price text-2xl sm:text-[30px] font-extrabold text-[#BF5330] leading-tight block mt-0.5">
              {formatPrice(order.totalPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Row 1 Left: Delivery & Tracking (lg:col-span-7) */}
        <section
          aria-labelledby="tracking-heading"
          className="lg:col-span-7 rounded-2xl border border-[#E8DFD4] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-2.5">
              <Truck className="h-5 w-5 text-[#BF5330]" aria-hidden="true" />
              <h2
                id="tracking-heading"
                className="font-heading text-lg font-normal text-[#1A1614]"
              >
                Delivery &amp; Tracking
              </h2>
            </div>
            {primaryShipment?.awb && (
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#FAF5EF] border border-[#E8DFD4] text-[#635850]">
                AWB: {primaryShipment.awb}
              </span>
            )}
          </div>

          {/* 4-Step Progress Timeline */}
          <div className="relative pt-2 pb-2">
            <div className="grid grid-cols-4 relative">
              {/* Connecting Lines */}
              {/* Line 1 -> 2 */}
              <div
                className={`absolute top-4 left-[12.5%] right-[62.5%] h-0.5 ${
                  isConfirmed ? "bg-[#BF5330]" : "border-t-2 border-dashed border-[#E8DFD4]"
                }`}
              />
              {/* Line 2 -> 3 */}
              <div
                className={`absolute top-4 left-[37.5%] right-[37.5%] h-0.5 ${
                  isShipped ? "bg-[#BF5330]" : "border-t-2 border-dashed border-[#E8DFD4]"
                }`}
              />
              {/* Line 3 -> 4 */}
              <div
                className={`absolute top-4 left-[62.5%] right-[12.5%] h-0.5 ${
                  isDelivered ? "bg-[#BF5330]" : "border-t-2 border-dashed border-[#E8DFD4]"
                }`}
              />

              {/* Step 1: Order Confirmed */}
              <div className="flex flex-col items-center text-center relative z-10 px-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isConfirmed
                      ? "bg-[#BF5330] text-white shadow-2xs"
                      : "bg-white border-2 border-[#E8DFD4] text-[#A89D95]"
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span
                  className={`mt-2.5 text-xs font-semibold leading-tight ${
                    isConfirmed ? "text-[#1A1614]" : "text-[#786B62]"
                  }`}
                >
                  Order Confirmed
                </span>
              </div>

              {/* Step 2: Processing */}
              <div className="flex flex-col items-center text-center relative z-10 px-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isShipped
                      ? "bg-[#BF5330] text-white shadow-2xs"
                      : isConfirmed
                      ? "bg-white border-2 border-[#BF5330] text-[#BF5330] shadow-2xs"
                      : "bg-white border-2 border-[#E8DFD4] text-[#A89D95]"
                  }`}
                >
                  {isShipped ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Package className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`mt-2.5 text-xs font-semibold leading-tight ${
                    isConfirmed ? "text-[#1A1614]" : "text-[#786B62]"
                  }`}
                >
                  Processing
                </span>
              </div>

              {/* Step 3: Shipped */}
              <div className="flex flex-col items-center text-center relative z-10 px-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDelivered
                      ? "bg-[#BF5330] text-white shadow-2xs"
                      : isShipped
                      ? "bg-white border-2 border-[#BF5330] text-[#BF5330] shadow-2xs"
                      : "bg-white border-2 border-[#E8DFD4] text-[#A89D95]"
                  }`}
                >
                  {isDelivered ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Truck className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`mt-2.5 text-xs font-semibold leading-tight ${
                    isShipped ? "text-[#1A1614]" : "text-[#786B62]"
                  }`}
                >
                  Shipped
                </span>
              </div>

              {/* Step 4: Delivered */}
              <div className="flex flex-col items-center text-center relative z-10 px-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isDelivered
                      ? "bg-[#BF5330] text-white shadow-2xs"
                      : "bg-white border-2 border-[#E8DFD4] text-[#A89D95]"
                  }`}
                >
                  {isDelivered ? (
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  ) : (
                    <Home className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`mt-2.5 text-xs font-semibold leading-tight ${
                    isDelivered ? "text-[#1A1614]" : "text-[#786B62]"
                  }`}
                >
                  Delivered
                </span>
              </div>
            </div>
          </div>

          {/* Status Callout Banner */}
          <div className="mt-6 p-4 rounded-xl bg-[#FDF6F0] border border-[#F4EAE0] flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-white border border-[#E8DFD4] flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              {isDelivered ? (
                <CheckCircle2 className="w-5 h-5 text-[#247B49]" />
              ) : isShipped ? (
                <Truck className="w-5 h-5 text-[#BF5330]" />
              ) : isCancelled ? (
                <AlertCircle className="w-5 h-5 text-[#B42318]" />
              ) : (
                <Package className="w-5 h-5 text-[#BF5330]" />
              )}
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="font-semibold text-sm text-[#1A1614] leading-snug">
                {isDelivered
                  ? "Your order has been delivered successfully."
                  : isShipped
                  ? `Dispatched${primaryShipment?.courierName ? ` via ${primaryShipment.courierName}` : ""}${primaryShipment?.awb ? ` (AWB: ${primaryShipment.awb})` : ""}.`
                  : isCancelled
                  ? "This order was cancelled."
                  : "Your order is being processed for packing and dispatch."}
              </p>
              <p className="text-xs text-[#786B62] leading-relaxed">
                {isDelivered ? (
                  "Thank you for shopping with SPN Health Mix!"
                ) : isShipped ? (
                  primaryShipment?.trackingUrl ? (
                    <a
                      href={primaryShipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#BF5330] hover:underline font-medium mt-0.5"
                    >
                      <span>Track package on courier website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    "Your package is in transit with the courier."
                  )
                ) : isCancelled ? (
                  "If you have questions regarding a refund, please contact customer support."
                ) : (
                  "We will notify you once your order is shipped and share tracking details."
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Row 1 Right: Delivery Address (lg:col-span-5) */}
        <section
          aria-labelledby="address-heading"
          className="lg:col-span-5 rounded-2xl border border-[#E8DFD4] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-[#BF5330]" aria-hidden="true" />
              <h2
                id="address-heading"
                className="font-heading text-lg font-normal text-[#1A1614]"
              >
                Delivery Address
              </h2>
            </div>
          </div>

          {addr ? (
            <div className="text-xs sm:text-sm space-y-1 text-[#4A3B32] leading-relaxed">
              <p className="font-bold text-sm sm:text-base text-[#1A1614] mb-2">
                {addr.fullName}
              </p>
              <p>{addr.line1}</p>
              {addr.line2 && <p>{addr.line2}</p>}
              {addr.landmark && (
                <p className="text-[#786B62]">
                  Landmark: {addr.landmark}
                </p>
              )}
              <p>
                {addr.city}, {addr.state} – {addr.pincode}
              </p>
              <p className="pt-3 text-[#786B62] border-t border-[#E8DFD4]/60 mt-3 font-medium">
                Phone: +91 {addr.phone}
              </p>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-[#786B62]">
              Address details unavailable.
            </p>
          )}
        </section>

        {/* Row 2 Left: Items in This Order (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <section
            aria-labelledby="items-heading"
            className="rounded-2xl border border-[#E8DFD4] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <Package className="h-5 w-5 text-[#BF5330]" aria-hidden="true" />
              <h2
                id="items-heading"
                className="font-heading text-lg font-normal text-[#1A1614]"
              >
                Items in This Order
              </h2>
            </div>

            {/* List of items */}
            <div className="divide-y divide-[#E8DFD4]/70">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="py-4 sm:py-4.5 flex items-center justify-between gap-4 first:pt-4"
                >
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-[#E8DFD4] bg-[#FFFBF7] shrink-0 overflow-hidden flex items-center justify-center p-1">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.productName}
                          fill
                          className="object-contain p-1"
                          unoptimized
                        />
                      ) : (
                        <Package className="w-7 h-7 text-[#D9C6AA]" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <h3 className="font-body font-[family-name:var(--font-manrope)] font-bold text-[15px] sm:text-[17px] text-[#1A1614] leading-snug line-clamp-2">
                        {item.productName}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#786B62]">
                        {item.variantLabel} &times; {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-auto">
                    <span className="font-bold text-sm sm:text-base text-[#1A1614] font-price block leading-tight">
                      {formatPrice(item.lineTotalPaise)}
                    </span>
                    <span className="text-xs text-[#786B62] font-price block mt-0.5 font-normal">
                      ({formatPrice(item.unitPricePaise)} each)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Subtotal & Totals Breakdown */}
            <div className="border-t border-[#E8DFD4] pt-4.5 space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between text-[#786B62]">
                <span>Items Subtotal</span>
                <span className="font-medium text-[#1A1614] font-price">
                  {formatPrice(order.subtotalPaise)}
                </span>
              </div>

              {order.discountPaise > 0 && (
                <div className="flex justify-between text-[#247B49]">
                  <span>Discount</span>
                  <span className="font-medium font-price">
                    −{formatPrice(order.discountPaise)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#786B62]">
                <span>Shipping</span>
                <span className="font-medium text-[#1A1614] font-price">
                  {order.shippingPaise === 0 ? "Free" : formatPrice(order.shippingPaise)}
                </span>
              </div>
            </div>

            {/* Total Amount Bottom Banner */}
            <div className="-mx-6 -mb-6 mt-5 px-6 py-4 bg-[#FDF6F0] border-t border-[#F4EAE0] flex items-center justify-between rounded-b-2xl">
              <span className="font-bold text-sm sm:text-base text-[#1A1614]">
                Total Amount
              </span>
              <span className="font-extrabold text-xl sm:text-2xl text-[#BF5330] font-price">
                {formatPrice(order.totalPaise)}
              </span>
            </div>
          </section>

          {/* Customer Delivery Note if present */}
          {order.customerNote && (
            <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-xs text-[#4A3B32]">
              <span className="font-bold text-[#1A1614] block mb-1">Customer Delivery Instructions:</span>
              <p className="italic text-[#635850]">&ldquo;{order.customerNote}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Row 2 Right: Need Assistance With This Order (lg:col-span-5) */}
        <section
          aria-labelledby="help-heading"
          className="lg:col-span-5 rounded-2xl border border-[#E8DFD4] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-2.5">
              <Headphones className="h-5 w-5 text-[#BF5330]" aria-hidden="true" />
              <h2
                id="help-heading"
                className="font-heading text-base sm:text-lg font-normal text-[#1A1614]"
              >
                Need assistance with this order?
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-[#786B62] leading-relaxed mt-2">
              For questions regarding your order, please mention your order reference{" "}
              <strong className="text-[#1A1614] font-semibold font-order-id">#{order.orderNumber}</strong> when contacting our team.
            </p>
          </div>

          <Link
            href={`/contact?order=${encodeURIComponent(order.orderNumber)}`}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-sm font-semibold shadow-xs transition-all active:scale-[0.99]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Contact Support</span>
          </Link>
        </section>
      </div>
    </div>
  );
}
