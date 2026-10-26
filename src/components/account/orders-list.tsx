"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, AlertCircle, ShoppingBag, Package } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";
import type { AddressSnapshot } from "@/lib/db/schema";

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: string;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingAddress: AddressSnapshot;
  customerNote: string | null;
  expiresAt: string | null;
  createdAt: string;
  itemsCount?: number;
  imageUrl?: string | null;
  productName?: string | null;
  deliveredAt?: string | null;
  shippedAt?: string | null;
}

export type FilterTab = "all" | "pending" | "shipped" | "delivered" | "cancelled";

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All Orders" },
  { id: "pending", label: "Pending" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export function OrderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending_payment":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#FEF3C7] text-[#92400E]">
          Pending Payment
        </span>
      );
    case "confirmed":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#DCFCE7] text-[#166534]">
          Confirmed
        </span>
      );
    case "processing":
    case "packed":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#FEF3C7] text-[#92400E]">
          Processing
        </span>
      );
    case "shipped":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#DBEAFE] text-[#1E40AF]">
          Shipped
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#DCFCE7] text-[#166534]">
          Delivered
        </span>
      );
    case "cancelled":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#FEE2E2] text-[#991B1B]">
          Cancelled
        </span>
      );
    case "refunded":
    case "refund_required":
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#F3F4F6] text-[#4B5563]">
          Refunded
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#F5EFE8] text-[#4A3B32]">
          {status}
        </span>
      );
  }
}

function formatPlacementDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatExpectedDate(shippedAtStr: string | null | undefined): string {
  if (!shippedAtStr) return "";
  try {
    const d = new Date(shippedAtStr);
    if (isNaN(d.getTime())) return "";
    // Typical estimated delivery 3 days after dispatch
    const expected = new Date(d.getTime() + 3 * 24 * 60 * 60 * 1000);
    return expected.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function OrdersList({ limit }: { limit?: number }) {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = limit ? `/api/me/orders?limit=${limit}` : "/api/me/orders";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign-in required to view orders.");
          return;
        }
        const errData = await res.json().catch(() => null);
        setError(errData?.message || "We couldn't load your orders. Please try again.");
        return;
      }
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      setError("We couldn't load your orders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [limit]);

  // Filter orders based on the active tab
  const filteredOrders = orders.filter((order) => {
    if (activeTab === "all") return true;
    if (activeTab === "pending") {
      return ["pending_payment", "confirmed", "processing", "packed"].includes(order.status);
    }
    if (activeTab === "shipped") {
      return order.status === "shipped";
    }
    if (activeTab === "delivered") {
      return order.status === "delivered";
    }
    if (activeTab === "cancelled") {
      return ["cancelled", "refunded"].includes(order.status);
    }
    return true;
  });

  return (
    <div className="w-full font-[family-name:var(--font-body)]">
      {/* Order status filter tabs with responsive spacing & horizontal scrolling */}
      <div className="w-full overflow-x-auto scrollbar-none pb-2 pt-0.5 mb-5 sm:mb-6 select-none">
        <div
          className="flex items-center gap-2 sm:gap-2.5 min-w-max"
          role="tablist"
          aria-label="Filter orders by status"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-8 sm:h-9 px-3 sm:px-4 rounded-lg sm:rounded-[10px] text-xs sm:text-[13.5px] font-medium transition-all shrink-0 cursor-pointer inline-flex items-center justify-center whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
                  isActive
                    ? "bg-[#BF5330] text-white shadow-2xs font-semibold"
                    : "bg-[#F5EFE8] text-[#4A3B32] hover:bg-[#EFE7DD] hover:text-[#1A1614] border border-[#E8DFD4]/70"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && orders.length === 0 && (
        <div className="space-y-3 sm:space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-[#E8DFD4] bg-white animate-pulse flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 shadow-[0_1px_4px_rgba(42,24,16,0.02)]"
            >
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-[#FAF5EE] shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 sm:w-40 bg-[#FAF5EE] rounded" />
                  <div className="h-3 w-24 sm:w-28 bg-[#FAF5EE] rounded" />
                  <div className="h-3 w-40 sm:w-52 bg-[#FAF5EE] rounded" />
                </div>
              </div>
              <div className="flex md:flex-col items-center md:items-end justify-between border-t border-[#E8DFD4]/60 md:border-0 pt-3 md:pt-0 gap-3">
                <div className="h-4 w-16 bg-[#FAF5EE] rounded" />
                <div className="h-10 sm:h-8 w-24 bg-[#FAF5EE] rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-8 rounded-2xl border border-[#E8DFD4] bg-white text-center max-w-md mx-auto my-4 shadow-xs">
          <AlertCircle className="h-8 w-8 text-[#BF5330] mx-auto mb-3" />
          <p className="text-sm text-[#4A3B32] mb-4">
            {error}
          </p>
          <button
            type="button"
            onClick={fetchOrders}
            className="inline-flex items-center justify-center px-4.5 py-2 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs font-semibold active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] shadow-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="py-12 px-6 rounded-2xl border border-dashed border-[#E8DFD4] bg-white text-center max-w-md mx-auto my-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#BF5330]/20 flex items-center justify-center mx-auto mb-3.5 text-[#BF5330]">
            <ShoppingBag className="h-6 w-6 stroke-[1.75]" />
          </div>
          <h3 className="font-heading text-lg sm:text-xl text-[#1A1614] mb-1 font-normal">
            {activeTab === "all" ? "No orders yet" : "No orders found"}
          </h3>
          <p className="text-xs text-[#786B62] mb-5 max-w-xs mx-auto leading-relaxed">
            {activeTab === "all"
              ? "Your orders will appear here after you place your first order."
              : `There are currently no orders under the "${TABS.find((t) => t.id === activeTab)?.label}" tab.`}
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] shadow-xs"
          >
            Browse Products
          </Link>
        </div>
      )}

      {/* Orders List matching reference cards */}
      {!loading && !error && filteredOrders.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {filteredOrders.map((order) => {
            const dateStr = formatPlacementDate(order.createdAt);
            const deliveredDateStr = formatPlacementDate(order.deliveredAt);
            const expectedDateStr = formatExpectedDate(order.shippedAt);

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl sm:rounded-2xl border border-[#E8DFD4] p-3.5 sm:p-5 hover:border-[#D6C7BA] transition-all shadow-[0_1px_4px_rgba(42,24,16,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-5"
              >
                {/* Left & Middle Wrapper */}
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  {/* Product Thumbnail */}
                  <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-[84px] lg:h-[84px] rounded-lg bg-[#FAF5EE] border border-[#E8DFD4]/70 overflow-hidden shrink-0 flex items-center justify-center p-1.5 relative">
                    {order.imageUrl ? (
                      <Image
                        src={order.imageUrl}
                        alt={order.productName || `Order #${order.orderNumber}`}
                        width={84}
                        height={84}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#BF5330]/70">
                        <Package className="w-6 h-6 stroke-[1.5]" />
                      </div>
                    )}
                  </div>

                  {/* Middle Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Order Reference ID + Status Badge */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                      <span className="font-semibold text-sm sm:text-[15px] text-[#1A1614] tracking-tight font-order-id">
                        #{order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    {/* Order placement date */}
                    <p className="text-xs text-[#786B62]">
                      Placed on {dateStr}
                    </p>

                    {/* Item count & Destination / Fulfillment Status */}
                    <div className="text-xs text-[#635850] pt-0.5 space-y-0.5 leading-relaxed">
                      <div className="flex flex-wrap items-center gap-x-2">
                        {order.itemsCount !== undefined && order.itemsCount > 0 && (
                          <span>
                            {order.itemsCount} {order.itemsCount === 1 ? "item" : "items"}
                          </span>
                        )}
                        {order.itemsCount !== undefined && order.itemsCount > 0 && (order.status === "delivered" || order.status === "shipped") && (
                          <span className="text-[#C5B4A2]" aria-hidden="true">•</span>
                        )}
                        {order.status === "delivered" && deliveredDateStr ? (
                          <span className="text-[#166534] font-medium">Delivered on {deliveredDateStr}</span>
                        ) : order.status === "shipped" && expectedDateStr ? (
                          <span className="text-[#1E40AF] font-medium">Expected delivery: {expectedDateStr}</span>
                        ) : null}
                      </div>

                      {order.shippingAddress?.fullName && (
                        <p className="text-[#635850] break-words">
                          <span className="block sm:inline text-[#786B62]">Delivering to:</span>
                          <span className="block sm:inline sm:ml-1 font-medium text-[#1A1614]">
                            {order.shippingAddress.fullName}
                          </span>
                          {order.shippingAddress.city ? (
                            <span className="hidden sm:inline"> ({order.shippingAddress.city})</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Section: Total & View Order button */}
                <div className="flex md:flex-col items-center md:items-end justify-between border-t border-[#E8DFD4]/70 md:border-t-0 md:border-l md:border-[#E8DFD4]/70 pt-3 md:pt-0 md:pl-6 lg:pl-8 gap-3 shrink-0">
                  <div className="md:text-right">
                    <span className="text-[10.5px] sm:text-[11px] text-[#786B62] font-normal uppercase tracking-wider block leading-none mb-0.5 sm:mb-1">
                      Total
                    </span>
                    <span className="font-[family-name:var(--font-price)] font-bold text-base sm:text-lg md:text-[20px] text-[#BF5330] leading-tight">
                      {formatPrice(order.totalPaise)}
                    </span>
                  </div>

                  <Link
                    href={`/account/orders/${order.id}`}
                    className="h-11 sm:h-9 px-4 sm:px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E8DFD4] hover:border-[#BF5330] hover:text-[#BF5330] bg-[#FFFBF7]/80 hover:bg-white text-xs sm:text-[13px] font-semibold text-[#1A1614] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] active:scale-[0.98] shadow-2xs cursor-pointer shrink-0"
                  >
                    <span>View Order</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

