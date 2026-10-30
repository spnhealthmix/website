"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Package,
  Clock,
  AlertCircle,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  X,
  Printer,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { AddressSnapshot } from "@/lib/db/schema";
import { DEFAULT_BUSINESS_SETTINGS, type BusinessSettings } from "@/lib/settings/types";

type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  totalPaise: number;
  createdAt: string;
  attentionReason: string | null;
  needsAttention: boolean;
  itemCount: number;
  customer: {
    id: string;
    name: string | null;
    email: string;
  };
  shipTo: string | null;
  shipCity: string | null;
  shippingAddress?: AddressSnapshot | null;
};

type SummaryStats = {
  totalOrders: number;
  pendingPayment: number;
  needsAttention: number;
  revenuePaise: number;
};

type SortField =
  | "date"
  | "customer"
  | "shipTo"
  | "items"
  | "total"
  | "status"
  | null;
type SortOrder = "asc" | "desc";

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string }
> = {
  confirmed: {
    label: "Confirmed",
    badgeClass: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
  },
  processing: {
    label: "Processing",
    badgeClass: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
  },
  packed: {
    label: "Packed",
    badgeClass: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
  },
  shipped: {
    label: "Shipped",
    badgeClass: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
  },
  delivered: {
    label: "Delivered",
    badgeClass: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]",
  },
  pending_payment: {
    label: "Pending Payment",
    badgeClass: "bg-[#F5F2EC] text-[#635850] border-[#E2DAD0]",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]",
  },
  refunded: {
    label: "Refunded",
    badgeClass: "bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]",
  },
};

function formatOrderDateTime(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: "—", time: "" };
    const date = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const time = d
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
    return { date: `${date},`, time };
  } catch {
    return { date: "—", time: "" };
  }
}

function AddressSlipCard({
  order,
  businessSettings,
  isPreview = false,
}: {
  order: AdminOrderListItem;
  businessSettings: BusinessSettings;
  isPreview?: boolean;
}) {
  const address = order.shippingAddress;
  const recipientName = address?.fullName || order.shipTo || order.customer.name || "Customer";
  const recipientPhone = address?.phone || "Not provided";
  const orderDate = new Date(order.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      className={`w-[520px] max-w-full bg-white border-2 border-black rounded-[6px] p-5 space-y-0 text-black box-border ${
        isPreview ? "shadow-md" : ""
      }`}
      style={{
        fontFamily:
          'var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* ── 1. Header Section ── */}
      <div className="flex items-start justify-between pb-3">
        <div>
          <h1
            className="text-[18px] font-[800] tracking-tight text-black uppercase leading-tight m-0"
            style={{
              fontFamily: 'var(--font-inter), "Inter", sans-serif',
              fontWeight: 800,
            }}
          >
            {businessSettings.businessName || "SPN HEALTH MIX"}
          </h1>
          <p className="text-[11.5px] font-medium text-black mt-0.5 m-0 leading-tight">
            Delivery Address Slip
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#374151] block leading-tight">
            ORDER ID
          </span>
          <span className="text-[13px] font-bold text-black mt-0.5 block leading-tight">
            {order.orderNumber}
          </span>
        </div>
      </div>

      {/* Solid black divider underneath header */}
      <div className="border-t-2 border-black w-full" />

      {/* ── 2. Delivery Address Section (DELIVER TO) ── */}
      <div className="pt-3.5 pb-3.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-black block leading-none mb-1">
            DELIVER TO:
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#4B5563]">
            Order Date: {orderDate}
          </span>
        </div>
        <div
          className="text-[16.5px] font-bold text-black leading-snug"
          style={{ fontFamily: 'var(--font-pt-serif), "PT Serif", Georgia, serif' }}
        >
          {recipientName}
        </div>
        {address?.line1 ? (
          <div className="text-[13px] font-normal text-black leading-tight">
            {address.line1}
          </div>
        ) : (
          !address && order.shipTo && (
            <div className="text-[13px] font-normal text-black leading-tight">
              {order.shipTo}
            </div>
          )
        )}
        {address?.line2 && (
          <div className="text-[13px] font-normal text-black leading-tight">
            {address.line2}
          </div>
        )}
        {address?.landmark && (
          <div className="text-[12.5px] font-normal text-black leading-tight italic">
            Landmark: {address.landmark}
          </div>
        )}
        <div className="text-[14px] font-bold text-black leading-tight pt-0.5">
          {[address?.city || order.shipCity, address?.state]
            .filter(Boolean)
            .join(", ")}
          {address?.pincode ? ` - ${address.pincode}` : ""}
        </div>

        {/* Customer Phone & Email */}
        <div className="pt-2 flex items-center gap-4 text-[12.5px]">
          <div>
            <span className="text-[10px] font-bold uppercase text-[#4B5563] block">
              CUSTOMER PHONE / MOBILE:
            </span>
            <span className="text-[13px] font-bold text-black tracking-wide">
              {recipientPhone}
            </span>
          </div>
          {order.customer.email && (
            <div className="border-l border-[#9CA3AF] pl-4">
              <span className="text-[10px] font-bold uppercase text-[#4B5563] block">
                CUSTOMER EMAIL:
              </span>
              <span className="text-[11.5px] font-medium text-black">
                {order.customer.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Thin light-gray dashed divider */}
      <div className="border-t border-dashed border-[#9CA3AF] w-full" />

      {/* ── 3. From / Company Address & Phone Number Section ── */}
      <div className="py-3">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#374151] block leading-none mb-1">
          FROM (SENDER / RETURN ADDRESS):
        </span>
        <div className="text-[13px] font-bold text-black leading-tight">
          {businessSettings.businessName || "SPN Health Mix"}
        </div>
        <div className="text-[12px] font-normal text-black leading-tight mt-1">
          {[
            businessSettings.address?.line1,
            businessSettings.address?.line2,
            businessSettings.address?.city,
            businessSettings.address?.state,
          ]
            .filter(Boolean)
            .join(", ")}
          {businessSettings.address?.pincode ? ` - ${businessSettings.address.pincode}` : ""}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-black mt-1.5 font-medium">
          {businessSettings.phone && (
            <div>
              <span className="font-bold">Phone:</span> {businessSettings.phone}
            </div>
          )}
          {businessSettings.supportEmail && (
            <div>
              <span className="font-bold">Email:</span> {businessSettings.supportEmail}
            </div>
          )}
          {businessSettings.fssaiNumber && (
            <div>
              <span className="font-bold">FSSAI:</span> {businessSettings.fssaiNumber}
            </div>
          )}
        </div>
      </div>

      {/* Solid divider */}
      <div className="border-t border-black w-full" />

      {/* ── 4. Footer Section ── */}
      <div className="pt-2.5 flex items-center justify-between text-[10.5px] font-normal text-black">
        <div>
          Total Items:{" "}
          <span className="font-bold">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </span>
        </div>
        <div>
          Order Status:{" "}
          <span className="font-bold uppercase">
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OrdersList() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";
  const initialAttention = searchParams.get("attention") === "true";

  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Business settings for print slip
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [printingOrder, setPrintingOrder] = useState<AdminOrderListItem | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings/business", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setBusinessSettings((prev) => ({
            ...prev,
            ...data,
            address: {
              ...prev.address,
              ...(data.address || {}),
            },
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handlePrintOrder = (order: AdminOrderListItem) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Summary Metrics State
  const [stats, setStats] = useState<SummaryStats>({
    totalOrders: 0,
    pendingPayment: 0,
    needsAttention: 0,
    revenuePaise: 0,
  });

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [attentionFilter, setAttentionFilter] = useState(initialAttention);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Client-Side Sorting
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Fetch Orders and Dashboard Statistics
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (attentionFilter) params.set("attention", "true");
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const [ordersRes, dashRes] = await Promise.all([
        fetch(`/api/admin/orders?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/admin/dashboard", { cache: "no-store" }).catch(() => null),
      ]);

      if (!ordersRes.ok) {
        const errJson = await ordersRes.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load orders.");
      }

      const data = await ordersRes.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);

      if (dashRes && dashRes.ok) {
        const dashData = await dashRes.json();
        const byStatus = dashData.ordersByStatus || {};
        const totalAll = Object.values(byStatus).reduce(
          (a: any, b: any) => a + Number(b),
          0
        ) as number;

        setStats({
          totalOrders: totalAll || data.total || 0,
          pendingPayment: byStatus.pending_payment ?? 0,
          needsAttention: dashData.openRefunds ?? 0,
          revenuePaise: dashData.last30Days?.revenuePaise ?? 0,
        });
      } else {
        // Fallback calculations if dashboard endpoint is unreachable
        setStats((prev) => ({
          ...prev,
          totalOrders: data.total || 0,
        }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, attentionFilter, searchQuery, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle Search Submission
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setStatusFilter("");
    setAttentionFilter(false);
    setPage(1);
  };

  const isFiltered = Boolean(
    searchQuery || statusFilter || attentionFilter
  );

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Sorted Orders List
  const sortedOrders = useMemo(() => {
    if (!sortField) return orders;
    const list = [...orders];
    list.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "date":
          result =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "customer": {
          const nameA = (a.customer.name || a.customer.email).toLowerCase();
          const nameB = (b.customer.name || b.customer.email).toLowerCase();
          result = nameA.localeCompare(nameB);
          break;
        }
        case "shipTo": {
          const shipA = (a.shippingAddress?.fullName || a.shipTo || "").toLowerCase();
          const shipB = (b.shippingAddress?.fullName || b.shipTo || "").toLowerCase();
          result = shipA.localeCompare(shipB);
          break;
        }
        case "items":
          result = a.itemCount - b.itemCount;
          break;
        case "total":
          result = a.totalPaise - b.totalPaise;
          break;
        case "status":
          result = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === "asc" ? result : -result;
    });
    return list;
  }, [orders, sortField, sortOrder]);

  const totalPages = Math.ceil(total / pageSize) || 1;
  const startItem = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, total);

  return (
    <>
      <div className="space-y-6 pb-12 font-[family-name:var(--font-body)] print:hidden">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div>
          <h1
            className="text-3xl sm:text-4xl lg:text-[40px] font-normal text-[#1A1614] leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Orders Management
          </h1>
          <p className="text-xs sm:text-sm text-[#635850] mt-1.5 font-normal">
            Track customer orders, fulfilment progress, payments, and dispatch status
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-xs font-semibold text-[#1A1614] transition-colors shadow-2xs self-start sm:self-center shrink-0 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#635850] ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── 2. Search and Filter Toolbar ───────────────────────────────────── */}
      <div className="bg-white border border-[#E8DFD4] rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <form
          onSubmit={handleFilterSubmit}
          className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3"
        >
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#8C7E72] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by order #, customer name, email, or phone..."
              className="w-full h-11 pl-10 pr-9 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] hover:text-[#1A1614] p-0.5"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Status Dropdown */}
            <div className="relative shrink-0 w-full sm:w-44">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-11 px-3.5 pr-8 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] focus:outline-none focus:border-[#BF5330] transition-all appearance-none cursor-pointer shadow-2xs"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>
                    {cfg.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="w-4 h-4 text-[#635850] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* Needs Attention Toggle Pill */}
            <button
              type="button"
              onClick={() => {
                setAttentionFilter(!attentionFilter);
                setPage(1);
              }}
              className={`h-11 px-4 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0 select-none ${
                attentionFilter
                  ? "bg-[#FDF3EE] border-[#BF5330] text-[#BF5330] font-semibold"
                  : "bg-white border-[#E8DFD4] text-[#635850] hover:bg-[#FAF5EF]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  attentionFilter ? "bg-[#BF5330]" : "bg-[#8C7E72]"
                }`}
                aria-hidden="true"
              />
              <span>Needs Attention</span>
            </button>

            {/* Terracotta Filter Button */}
            <button
              type="submit"
              className="h-11 px-5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-sm font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all shrink-0"
            >
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Filter</span>
            </button>

            {/* Clear / Reset Filters */}
            {isFiltered && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── 3. Summary Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.totalOrders}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Total Orders
            </span>
          </div>
        </div>

        {/* Card 2: Pending Payment */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.pendingPayment}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Pending Payment
            </span>
          </div>
        </div>

        {/* Card 3: Needs Attention */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.needsAttention}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Needs Attention
            </span>
          </div>
        </div>

        {/* Card 4: Revenue (30 days) */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {formatPrice(stats.revenuePaise)}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Revenue (30 days)
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Orders Table Card ───────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8DFD4] rounded-2xl shadow-xs overflow-hidden">
        {/* Loading Skeleton */}
        {loading && (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-9 w-full bg-[#FAF5EF] rounded-lg" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-[#FAF5EF]/70 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2
              className="text-xl font-bold text-[#1A1614] mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Failed to load orders
            </h2>
            <p className="text-xs text-[#635850] max-w-sm mx-auto mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && orders.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h2
              className="text-lg font-bold text-[#1A1614] mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No orders found
            </h2>
            <p className="text-xs text-[#635850] mb-4">
              {isFiltered
                ? "No orders match your filter criteria. Try resetting filters."
                : "Customer orders will appear here as purchases are completed."}
            </p>
            {isFiltered && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-[#E8DFD4] text-[#635850] hover:bg-[#FAF5EF] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        )}

        {/* Table View */}
        {!loading && !error && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8DFD4] bg-[#FFFBF7]/80 text-[#635850] text-[12px] font-semibold select-none">
                  {/* Serial Number */}
                  <th className="w-12 px-4 py-3.5 text-center font-semibold text-[#635850] whitespace-nowrap">
                    #
                  </th>

                  {/* Order ID */}
                  <th className="px-5 py-3.5 font-semibold text-[#635850] whitespace-nowrap">
                    Order ID
                  </th>

                  {/* Date */}
                  <th
                    onClick={() => handleSort("date")}
                    className="px-5 py-3.5 font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      Date
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Customer */}
                  <th
                    onClick={() => handleSort("customer")}
                    className="px-5 py-3.5 min-w-[170px] font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Customer
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Delivery Address */}
                  <th
                    onClick={() => handleSort("shipTo")}
                    className="px-5 py-3.5 min-w-[260px] max-w-[320px] font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Delivery Address
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Items */}
                  <th
                    onClick={() => handleSort("items")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Items
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Total */}
                  <th
                    onClick={() => handleSort("total")}
                    className="px-5 py-3.5 font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      Total
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Status */}
                  <th
                    onClick={() => handleSort("status")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Status
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Action */}
                  <th className="px-5 py-3.5 text-right font-semibold text-[#635850] whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E8DFD4]/70">
                {sortedOrders.map((o, idx) => {
                  const serialNum = (page - 1) * pageSize + idx + 1;
                  const cfg = STATUS_CONFIG[o.status] || {
                    label: o.status,
                    badgeClass: "bg-[#F5F2EC] text-[#635850] border-[#E2DAD0]",
                  };
                  const { date, time } = formatOrderDateTime(o.createdAt);

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-[#FAF5EF]/50 transition-colors"
                    >
                      {/* Serial Number */}
                      <td className="w-12 px-4 py-4 text-center whitespace-nowrap text-[12px] font-medium text-[#8C7E72]">
                        {serialNum}
                      </td>

                      {/* Order ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="font-order-id font-bold text-[13px] text-[#1A1614] hover:text-[#BF5330] transition-colors"
                        >
                          {o.orderNumber}
                        </Link>
                        {o.needsAttention && (
                          <span
                            className="block text-[11px] text-rose-700 font-semibold mt-0.5 truncate max-w-xs"
                            title={o.attentionReason || "Attention required"}
                          >
                            ⚠️ {o.attentionReason || "Needs attention"}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 whitespace-nowrap leading-snug">
                        <span className="block text-[12.5px] font-medium text-[#1A1614]">
                          {date}
                        </span>
                        <span className="block text-[11.5px] text-[#8C7E72]">
                          {time}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-5 py-4 leading-snug">
                        <div className="font-bold text-[13px] text-[#1A1614] truncate max-w-xs">
                          {o.customer.name || "Customer"}
                        </div>
                        <div className="text-[11.5px] text-[#8C7E72] truncate max-w-xs">
                          {o.customer.email}
                        </div>
                      </td>

                      {/* Delivery Address */}
                      <td className="px-5 py-4 leading-snug min-w-[240px] max-w-[320px]">
                        {o.shippingAddress ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[13px] text-[#1A1614]">
                                {o.shippingAddress.fullName || o.shipTo || o.customer.name || "Recipient"}
                              </span>
                              {o.shippingAddress.phone && (
                                <span className="text-[11px] font-medium text-[#BF5330] bg-[#FDF3EE] px-1.5 py-0.5 rounded border border-[#F6DFD5]">
                                  {o.shippingAddress.phone}
                                </span>
                              )}
                            </div>
                            <div className="text-[11.5px] text-[#635850] space-y-0.5">
                              <div className="truncate" title={o.shippingAddress.line1}>
                                {o.shippingAddress.line1}
                              </div>
                              {o.shippingAddress.line2 && (
                                <div className="truncate text-[#8C7E72]" title={o.shippingAddress.line2}>
                                  {o.shippingAddress.line2}
                                </div>
                              )}
                              {o.shippingAddress.landmark && (
                                <div className="text-[11px] italic text-[#8C7E72] truncate" title={`Landmark: ${o.shippingAddress.landmark}`}>
                                  Landmark: {o.shippingAddress.landmark}
                                </div>
                              )}
                              <div className="font-medium text-[#1A1614] text-[12px]">
                                {[o.shippingAddress.city, o.shippingAddress.state].filter(Boolean).join(", ")}
                                {o.shippingAddress.pincode ? ` - ${o.shippingAddress.pincode}` : ""}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[#8C7E72] text-[12px] italic">
                            {o.shipTo ? `${o.shipTo}${o.shipCity ? `, ${o.shipCity}` : ""}` : "No address available"}
                          </div>
                        )}
                      </td>

                      {/* Items */}
                      <td className="px-4 py-4 text-center text-[13px] font-medium text-[#635850]">
                        {o.itemCount}
                      </td>

                      {/* Total */}
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-[14px] text-[#1A1614]">
                        {formatPrice(o.totalPaise)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 rounded-md text-[11.5px] font-medium border ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintOrder(o)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#BF5330] hover:text-[#8F3E20] text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                            title={`Print delivery address slip for order ${o.orderNumber}`}
                          >
                            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Print</span>
                          </button>
                          <Link
                            href={`/admin/orders/${o.id}`}
                            className="text-xs font-semibold text-[#635850] hover:text-[#1A1614] transition-colors inline-flex items-center gap-1 px-1.5 py-1.5"
                          >
                            <span>View</span>
                            <span aria-hidden="true">&rarr;</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. Pagination & Results Count ─────────────────────────────────── */}
      {!loading && !error && total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-1 text-sm font-medium text-[#635850]">
          {/* Results Summary */}
          <div>
            Showing {startItem}–{endItem} of {total} orders
          </div>

          {/* Numeric Pagination Navigation */}
          <div className="flex items-center gap-1.5 select-none">
            {/* Prev button */}
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                return p === 1 || p === totalPages || Math.abs(p - page) <= 1;
              })
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;

                return (
                  <div key={p} className="flex items-center gap-1.5">
                    {showEllipsis && (
                      <span className="w-6 text-center text-[#8C7E72]">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                        p === page
                          ? "bg-[#BF5330] text-white shadow-xs"
                          : "border border-[#E8DFD4] bg-white text-[#635850] hover:bg-[#FAF5EF] hover:text-[#1A1614] shadow-2xs"
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

            {/* Next button */}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      </div>

      {/* ── Screen Modal: Print Preview ── */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-[#E8DFD4] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8DFD4] bg-[#FFFBF7]">
              <div>
                <h2
                  className="text-base font-bold text-[#1A1614]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Print Delivery Address
                </h2>
                <p className="text-xs text-[#635850] mt-0.5">
                  Order Reference:{" "}
                  <span className="font-semibold text-[#BF5330] font-order-id">
                    {printingOrder.orderNumber}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingOrder(null)}
                  className="p-1.5 text-[#8C7E72] hover:text-[#1A1614] rounded-lg hover:bg-[#FAF5EF] transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-[#F9F6F0]/40 flex justify-center">
              <AddressSlipCard
                order={printingOrder}
                businessSettings={businessSettings}
                isPreview
              />
            </div>

            <div className="px-6 py-3 border-t border-[#E8DFD4] bg-[#FFFBF7] flex items-center justify-between text-xs text-[#635850]">
              <span>
                Tip: In the print dialog, select <strong>Save as PDF</strong> or choose your label printer.
              </span>
              <button
                type="button"
                onClick={() => setPrintingOrder(null)}
                className="px-3 py-1.5 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] font-semibold text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dedicated Print-Only Shipping Address Slip ── */}
      {printingOrder && (
        <div
          id="admin-address-slip-wrapper"
          className="hidden print:block print:w-full print:m-0 print:p-0 text-black bg-white"
        >
          <AddressSlipCard
            order={printingOrder}
            businessSettings={businessSettings}
          />
        </div>
      )}
    </>
  );
}
