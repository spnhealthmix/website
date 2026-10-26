"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  RefreshCw,
  Package,
  AlertCircle,
  IndianRupee,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  FolderKanban,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

type DashboardData = {
  ordersByStatus: Record<string, number>;
  toFulfil: number;
  openRefunds: number;
  last30Days: {
    paidOrders: number;
    revenuePaise: number;
  };
  lowStockVariants: number;
};

type AdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: "admin";
};

interface DashboardViewProps {
  profile?: AdminProfile | null;
}

const STATUS_ITEMS = [
  {
    key: "confirmed",
    label: "Confirmed",
    icon: Package,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 border-blue-100",
    pillBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    key: "processing",
    label: "Processing",
    icon: Package,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50 border-amber-100",
    pillBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    key: "packed",
    label: "Packed",
    icon: ShoppingBag,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-50 border-purple-100",
    pillBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    key: "shipped",
    label: "Shipped",
    icon: Truck,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50 border-sky-100",
    pillBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    key: "delivered",
    label: "Delivered",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50 border-emerald-100",
    pillBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    key: "pending_payment",
    label: "Pending Payment",
    icon: Clock,
    iconColor: "text-stone-600",
    iconBg: "bg-stone-50 border-stone-200",
    pillBg: "bg-stone-100 text-stone-700 border-stone-200",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    icon: XCircle,
    iconColor: "text-rose-600",
    iconBg: "bg-rose-50 border-rose-100",
    pillBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
  {
    key: "refunded",
    label: "Refunded",
    icon: IndianRupee,
    iconColor: "text-orange-600",
    iconBg: "bg-orange-50 border-orange-100",
    pillBg: "bg-orange-50 text-orange-700 border-orange-200",
  },
] as const;

export function DashboardView({ profile }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load dashboard operational metrics.");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-36 bg-white border border-[#E8DFD4] rounded-2xl" />
        {/* 4 Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white border border-[#E8DFD4] rounded-2xl" />
          ))}
        </div>
        {/* Orders Breakdown Skeleton */}
        <div className="h-48 bg-white border border-[#E8DFD4] rounded-2xl" />
        {/* Quick Actions Skeleton */}
        <div className="h-36 bg-white border border-[#E8DFD4] rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 rounded-2xl border border-rose-200 bg-white text-center shadow-xs">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1A1614] mb-2">
          Failed to Load Dashboard Data
        </h2>
        <p className="text-sm text-[#635850] max-w-md mx-auto mb-5">{error}</p>
        <button
          type="button"
          onClick={fetchDashboard}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors cursor-pointer shadow-xs"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  const d = data || {
    ordersByStatus: {},
    toFulfil: 0,
    openRefunds: 0,
    last30Days: { paidOrders: 0, revenuePaise: 0 },
    lowStockVariants: 0,
  };

  return (
    <div className="space-y-6 pb-2">
      {/* ── Operations Dashboard Header Banner ──────────────────────────────── */}
      <div className="relative rounded-2xl sm:rounded-[22px] border border-[#E8DFD4] bg-white p-6 sm:p-8 lg:p-9 shadow-xs overflow-hidden">
        {/* Right Photographic Grain Art Visual Element */}
        <div
          className="absolute right-0 top-0 bottom-0 w-full sm:w-3/5 lg:w-1/2 pointer-events-none select-none overflow-hidden"
          aria-hidden="true"
        >
          <div className="relative w-full h-full">
            <Image
              src="/categories/health-mix.jpg"
              alt="Traditional South Indian grains and wholesome ingredients"
              fill
              priority
              className="object-cover object-right opacity-90"
            />
            {/* Elegant fade into white background */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 sm:via-white/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-white/30" />
          </div>
        </div>

        {/* Left Editorial Narrative */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#BF5330] mb-2 block font-[family-name:var(--font-body)]">
              WELCOME BACK
            </span>
            <h1
              className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl lg:text-[44px] text-[#1A1614] leading-[1.1] font-normal tracking-tight mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Operations Dashboard
            </h1>
            <p className="font-[family-name:var(--font-body)] text-xs sm:text-sm text-[#635850] leading-relaxed">
              Real-time fulfilment, inventory levels, and order pipeline.
            </p>
          </div>

          {/* Refresh Action Button */}
          <div className="shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={fetchDashboard}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E8DFD4] bg-white text-xs font-semibold text-[#1A1614] hover:bg-[#FAF5EF] hover:border-[#BF5330]/40 transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#BF5330]" : "text-[#635850]"}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Four Summary KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
        {/* Card 1: To Fulfil */}
        <Link
          href="/admin/orders"
          className="rounded-2xl border border-[#E8DFD4] bg-white p-5 sm:p-6 shadow-xs hover:border-[#BF5330]/40 hover:shadow-sm transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-[#1A1614]">
                To Fulfil
              </span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-heading)] text-[#1A1614]">
              {d.toFulfil}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#635850]">
            Confirmed, processing, or packed
          </p>
        </Link>

        {/* Card 2: Low Stock Items */}
        <Link
          href="/admin/products"
          className="rounded-2xl border border-[#E8DFD4] bg-white p-5 sm:p-6 shadow-xs hover:border-[#BF5330]/40 hover:shadow-sm transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-[#1A1614]">
                Low Stock Items
              </span>
            </div>
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.lowStockVariants > 0 ? "bg-amber-500" : "bg-stone-300"}`}
              aria-hidden="true"
            />
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-heading)] text-amber-800">
              {d.lowStockVariants}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#635850]">
            Active variants with stock &le; 5
          </p>
        </Link>

        {/* Card 3: Needs Attention */}
        <Link
          href="/admin/orders?attention=true"
          className="rounded-2xl border border-[#E8DFD4] bg-white p-5 sm:p-6 shadow-xs hover:border-[#BF5330]/40 hover:shadow-sm transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-[#1A1614]">
                Needs Attention
              </span>
            </div>
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.openRefunds > 0 ? "bg-rose-500" : "bg-emerald-500"}`}
              aria-hidden="true"
            />
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-heading)] text-rose-800">
              {d.openRefunds}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#635850]">
            Pending refund or fulfillment flags
          </p>
        </Link>

        {/* Card 4: Last 30 Days (Paid) */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-base">
                ₹
              </div>
              <span className="text-xs sm:text-[13px] font-semibold text-[#1A1614]">
                Last 30 Days (Paid)
              </span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
              {d.last30Days.paidOrders} orders
            </span>
          </div>

          <div className="my-3">
            <span className="text-3xl sm:text-4xl font-bold font-[family-name:var(--font-heading)] text-emerald-800">
              {formatPrice(d.last30Days.revenuePaise)}
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#635850]">
            Fulfilled and active captured orders
          </p>
        </div>
      </div>

      {/* ── Orders Status Breakdown Section ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E8DFD4] bg-white p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2
              className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-normal text-[#1A1614]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Orders Status Breakdown
            </h2>
            <p className="text-xs sm:text-[13px] text-[#635850] mt-0.5">
              Full distribution of orders in the database.
            </p>
          </div>

          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-1 text-xs sm:text-[13px] font-semibold text-[#BF5330] hover:text-[#8F3E20] hover:underline transition-colors shrink-0 self-start sm:self-auto"
          >
            <span>View all orders</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* 8 Status Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {STATUS_ITEMS.map((item) => {
            const count = d.ordersByStatus[item.key] ?? 0;
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={`/admin/orders?status=${item.key}`}
                className="p-3.5 rounded-xl border border-[#E8DFD4] bg-[#FFFBF7]/60 hover:bg-[#FAF5EF] hover:border-[#BF5330]/40 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg ${item.iconBg} ${item.iconColor} border flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[11.5px] font-semibold px-2 py-0.5 rounded-md border ${item.pillBg} truncate`}
                  >
                    {item.label}
                  </span>
                </div>

                <span className="text-base sm:text-lg font-bold font-[family-name:var(--font-heading)] text-[#1A1614] shrink-0 pl-1">
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Catalogue & Fulfilment Operations Section ───────────────────────── */}
      <div className="rounded-2xl border border-[#E8DFD4] bg-white p-6 sm:p-7 shadow-xs">
        <div className="mb-4">
          <h2
            className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-normal text-[#1A1614]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Catalogue &amp; Fulfilment Operations
          </h2>
          <p className="text-xs sm:text-[13px] text-[#635850] mt-0.5">
            Quick access to essential operational tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Action 1: Add New Product */}
          <Link
            href="/admin/products/new"
            className="p-4 rounded-xl border border-[#E8DFD4] bg-[#FFFBF7]/60 hover:bg-[#FAF5EF] hover:border-[#BF5330]/40 transition-all flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#BF5330]/10 border border-[#BF5330]/20 text-[#BF5330] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <Plus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[#1A1614] group-hover:text-[#BF5330] transition-colors truncate">
                  Add New Product
                </span>
                <span className="block text-xs text-[#635850] mt-0.5 truncate">
                  Create title, slug, and product details
                </span>
              </div>
            </div>

            <span className="w-6 h-6 rounded-full bg-[#BF5330]/10 text-[#BF5330] group-hover:bg-[#BF5330] group-hover:text-white flex items-center justify-center text-xs transition-all shrink-0">
              &rarr;
            </span>
          </Link>

          {/* Action 2: Manage Categories */}
          <Link
            href="/admin/categories"
            className="p-4 rounded-xl border border-[#E8DFD4] bg-[#FFFBF7]/60 hover:bg-[#FAF5EF] hover:border-[#BF5330]/40 transition-all flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#BF5330]/10 border border-[#BF5330]/20 text-[#BF5330] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[#1A1614] group-hover:text-[#BF5330] transition-colors truncate">
                  Manage Categories
                </span>
                <span className="block text-xs text-[#635850] mt-0.5 truncate">
                  Organise and order store taxonomy
                </span>
              </div>
            </div>

            <span className="w-6 h-6 rounded-full bg-[#BF5330]/10 text-[#BF5330] group-hover:bg-[#BF5330] group-hover:text-white flex items-center justify-center text-xs transition-all shrink-0">
              &rarr;
            </span>
          </Link>

          {/* Action 3: Process Orders */}
          <Link
            href="/admin/orders"
            className="p-4 rounded-xl border border-[#E8DFD4] bg-[#FFFBF7]/60 hover:bg-[#FAF5EF] hover:border-[#BF5330]/40 transition-all flex items-center justify-between gap-3 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#BF5330]/10 border border-[#BF5330]/20 text-[#BF5330] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-bold text-[#1A1614] group-hover:text-[#BF5330] transition-colors truncate">
                  Process Orders
                </span>
                <span className="block text-xs text-[#635850] mt-0.5 truncate">
                  Update status, dispatch, and add tracking
                </span>
              </div>
            </div>

            <span className="w-6 h-6 rounded-full bg-[#BF5330]/10 text-[#BF5330] group-hover:bg-[#BF5330] group-hover:text-white flex items-center justify-center text-xs transition-all shrink-0">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
