"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Package,
  LayoutGrid,
  Power,
  Tag,
  Plus,
  Search,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  Check,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";

type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: string | Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  variantCount: number;
  minPricePaise: number | null;
  maxPricePaise: number | null;
  totalStock: number;
  imageKey: string | null;
  imageUrl: string | null;
};

type CategoryOption = {
  id: string;
  name: string;
  slug?: string;
};

type ProductsStats = {
  total: number;
  active: number;
  inactive: number;
  categoriesCount: number;
};

type SortField =
  | "name"
  | "category"
  | "variants"
  | "price"
  | "stock"
  | "status";
type SortOrder = "asc" | "desc";

// Controlled two-line presentation for known product titles
const TWO_LINE_TITLES: Record<string, [string, string]> = {
  "nendram-raw-banana-powder": ["Nendram Raw", "Banana Powder"],
  "karuppu-kavuni-kanji-mix": ["Karuppu Kavuni", "Kanji Mix"],
  "abc-malt-nuts-mixed-powder": ["ABC Malt -", "Nuts Mixed Powder"],
  "moringa-leaves-sadham-podi": ["Moringa Leaves", "Sadham Podi"],
  "karuveppilai-sadham-podi": ["Karuveppilai", "Sadham Podi"],
};

export function ProductsList() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [stats, setStats] = useState<ProductsStats>({
    total: 0,
    active: 0,
    inactive: 0,
    categoriesCount: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<ProductListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load categories for dropdown & fallback stats
  useEffect(() => {
    fetch("/api/admin/categories", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) {
          setCategories(
            data.categories.map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            }))
          );
        }
      })
      .catch((err) => console.error("Could not fetch categories:", err));
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (statusFilter !== "") params.set("active", statusFilter);
      params.set("limit", String(pageSize));
      params.set("offset", String((page - 1) * pageSize));

      const res = await fetch(`/api/admin/products?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.error?.message || "Failed to load products catalogue."
        );
      }
      const data = await res.json();
      setProducts(data.products || []);
      setTotal(data.total || 0);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryFilter, statusFilter, pageSize, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle Search Input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setCategoryFilter("");
    setStatusFilter("");
    setPage(1);
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Sorted products for display
  const sortedProducts = useMemo(() => {
    const list = [...products];
    list.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "category":
          result = a.category.name.localeCompare(b.category.name);
          break;
        case "variants":
          result = a.variantCount - b.variantCount;
          break;
        case "price":
          result = (a.minPricePaise ?? 0) - (b.minPricePaise ?? 0);
          break;
        case "stock":
          result = a.totalStock - b.totalStock;
          break;
        case "status":
          result = Number(b.isActive) - Number(a.isActive);
          break;
      }
      return sortOrder === "asc" ? result : -result;
    });
    return list;
  }, [products, sortField, sortOrder]);

  // Checkbox selection
  const allCurrentSelected =
    sortedProducts.length > 0 &&
    sortedProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      const next = new Set(selectedIds);
      sortedProducts.forEach((p) => next.delete(p.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      sortedProducts.forEach((p) => next.add(p.id));
      setSelectedIds(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Toggle active status
  const toggleProductActive = async (p: ProductListItem) => {
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to update status.");
      }
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    }
  };

  // Delete product
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error?.message || "Could not delete product.");
      }

      setActionSuccess(`Product "${deleteTarget.name}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteTarget(null);
      await fetchProducts();
    } catch (err: any) {
      alert(err.message || "Could not delete product.");
    } finally {
      setDeleting(false);
    }
  };

  // Category badge styles
  const getCategoryBadgeClass = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes("health mix")) {
      return "bg-[#FDF3EE] text-[#BF5330] border border-[#BF5330]/25";
    }
    if (name.includes("podi")) {
      return "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]";
    }
    if (name.includes("masala") || name.includes("powder")) {
      return "bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]";
    }
    if (name.includes("snack") || name.includes("urundai")) {
      return "bg-[#F5F3FF] text-[#6D28D9] border border-[#DDD6FE]";
    }
    return "bg-[#FAF5EF] text-[#635850] border border-[#E8DFD4]";
  };

  const totalPages = Math.ceil(total / pageSize) || 1;
  const isFiltered = Boolean(searchQuery || categoryFilter || statusFilter !== "");

  return (
    <div className="space-y-6 pb-12 font-[family-name:var(--font-body)]">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div>
          <h1
            className="text-3xl sm:text-4xl lg:text-[42px] font-normal text-[#1A1614] leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Products
          </h1>
          <p className="text-xs sm:text-sm text-[#635850] mt-1.5 font-normal">
            Manage all your products, variants, stock and visibility.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all self-start sm:self-center shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Success Notification Alert */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 2. Product Summary Statistics Panel ─────────────────────────────── */}
      <div className="rounded-2xl border border-[#E8DFD4] bg-white p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x divide-[#E8DFD4]">
          {/* 1. Total Products */}
          <div className="flex items-center gap-3.5 lg:px-6 first:pl-2">
            <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
            </div>
            <div>
              <span
                className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stats.total || total}
              </span>
              <span className="block text-xs text-[#635850] font-medium mt-1">
                Total Products
              </span>
            </div>
          </div>

          {/* 2. Active */}
          <div className="flex items-center gap-3.5 lg:px-6">
            <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
            </div>
            <div>
              <span
                className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stats.active}
              </span>
              <span className="block text-xs text-[#635850] font-medium mt-1">
                Active
              </span>
            </div>
          </div>

          {/* 3. Inactive */}
          <div className="flex items-center gap-3.5 lg:px-6">
            <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
              <Power className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
            </div>
            <div>
              <span
                className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stats.inactive}
              </span>
              <span className="block text-xs text-[#635850] font-medium mt-1">
                Inactive
              </span>
            </div>
          </div>

          {/* 4. Categories */}
          <div className="flex items-center gap-3.5 lg:px-6 last:pr-2">
            <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5 stroke-[1.8]" aria-hidden="true" />
            </div>
            <div>
              <span
                className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {stats.categoriesCount || categories.length}
              </span>
              <span className="block text-xs text-[#635850] font-medium mt-1">
                Categories
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Search and Filter Toolbar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            className="w-4 h-4 text-[#8C7E72] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search products, SKU or category..."
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] placeholder:text-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] hover:text-[#1A1614] p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Dropdown */}
        <div className="relative shrink-0 sm:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-11 px-3.5 pr-8 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] focus:outline-none focus:border-[#BF5330] transition-all appearance-none cursor-pointer shadow-2xs"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="w-4 h-4 text-[#635850] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative shrink-0 sm:w-36">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full h-11 px-3.5 pr-8 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] focus:outline-none focus:border-[#BF5330] transition-all appearance-none cursor-pointer shadow-2xs"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <ChevronDown
            className="w-4 h-4 text-[#635850] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
        </div>

        {/* Clear Filters Button */}
        <button
          type="button"
          onClick={handleClearFilters}
          disabled={!isFiltered}
          className="h-11 px-4 rounded-xl border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] text-sm font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-3.5 h-3.5 text-[#635850]" aria-hidden="true" />
          <span>Clear Filters</span>
        </button>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.size > 0 && (
        <div className="p-3 px-4 rounded-xl bg-[#FAF5EF] border border-[#E8DFD4] flex items-center justify-between text-xs font-medium text-[#1A1614] shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#BF5330] text-white flex items-center justify-center text-[10px] font-bold">
              {selectedIds.size}
            </span>
            <span>
              {selectedIds.size} product{selectedIds.size > 1 ? "s" : ""} selected
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[#BF5330] hover:text-[#8F3E20] font-semibold cursor-pointer underline underline-offset-2"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* ── 4. Products Table Card ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E8DFD4] rounded-2xl shadow-xs overflow-hidden">
        {/* Loading Skeleton */}
        {loading && (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-9 w-full bg-[#FAF5EF] rounded-lg" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-14 bg-[#FAF5EF]/70 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error View */}
        {error && !loading && (
          <div className="p-10 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2
              className="text-xl font-bold text-[#1A1614] mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Failed to load products
            </h2>
            <p className="text-xs text-[#635850] max-w-sm mx-auto mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchProducts}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && products.length === 0 && (
          <div className="p-14 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#FAF5EF] border border-[#E8DFD4] text-[#8C7E72] flex items-center justify-center mb-4">
              <Package className="w-7 h-7" />
            </div>
            <h3
              className="text-xl font-bold text-[#1A1614] mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No products found
            </h3>
            <p className="text-xs text-[#635850] max-w-sm mx-auto mb-5">
              {isFiltered
                ? "No products match your current search and filter settings. Try adjusting or clearing filters."
                : "No products exist in the catalogue yet. Create your first product to get started."}
            </p>
            {isFiltered ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] hover:bg-[#FAF5EF] transition-colors cursor-pointer shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            ) : (
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add First Product</span>
              </Link>
            )}
          </div>
        )}

        {/* Table View */}
        {!loading && !error && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8DFD4] bg-[#FFFBF7]/80 text-[#635850] text-[12px] font-semibold select-none">
                  {/* Selection Checkbox */}
                  <th className="w-12 px-4 py-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-[#D4C5B5] text-[#BF5330] focus:ring-[#BF5330] accent-[#BF5330] cursor-pointer"
                      aria-label="Select all products on this page"
                    />
                  </th>

                  {/* Image */}
                  <th className="w-16 px-4 py-3.5 font-semibold text-[#635850]">
                    Image
                  </th>

                  {/* Product Name */}
                  <th
                    onClick={() => handleSort("name")}
                    className="px-4 py-3.5 min-w-[200px] font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Product Name
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Category */}
                  <th
                    onClick={() => handleSort("category")}
                    className="px-4 py-3.5 font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Category
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Variants */}
                  <th
                    onClick={() => handleSort("variants")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Variants
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Price Range */}
                  <th
                    onClick={() => handleSort("price")}
                    className="px-4 py-3.5 font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Price Range
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Stock */}
                  <th
                    onClick={() => handleSort("stock")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Stock
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Status */}
                  <th
                    onClick={() => handleSort("status")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Status
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Actions */}
                  <th className="px-4 py-3.5 text-center font-semibold text-[#635850]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E8DFD4]/70">
                {sortedProducts.map((p) => {
                  const hasPrice = p.minPricePaise !== null;
                  const priceLabel = hasPrice
                    ? p.minPricePaise === p.maxPricePaise
                      ? formatPrice(p.minPricePaise!)
                      : `${formatPrice(p.minPricePaise!)} – ${formatPrice(p.maxPricePaise!)}`
                    : "No price";

                  const twoLines = TWO_LINE_TITLES[p.slug];
                  const imgSrc =
                    p.imageUrl ||
                    (p.imageKey
                      ? p.imageKey.startsWith("http")
                        ? p.imageKey
                        : `/${p.imageKey}`
                      : `/products/${p.slug}/main.jpg`);

                  const isRowSelected = selectedIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#FAF5EF]/50 transition-colors ${
                        isRowSelected ? "bg-[#FAF5EF]/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectRow(p.id)}
                          className="w-4 h-4 rounded border-[#D4C5B5] text-[#BF5330] focus:ring-[#BF5330] accent-[#BF5330] cursor-pointer"
                          aria-label={`Select ${p.name}`}
                        />
                      </td>

                      {/* Image Thumbnail */}
                      <td className="w-16 px-4 py-3">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="w-11 h-11 rounded-lg bg-[#FAF5EF] border border-[#E8DFD4] overflow-hidden shrink-0 flex items-center justify-center p-0.5 hover:border-[#BF5330]/50 transition-colors block"
                        >
                          <img
                            src={imgSrc}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              // Fallback on image error
                              (e.currentTarget as HTMLElement).style.display =
                                "none";
                            }}
                          />
                        </Link>
                      </td>

                      {/* Product Name (STRICTLY NO SKU / CODE / METADATA UNDERNEATH) */}
                      <td className="px-4 py-3 min-w-[200px]">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="group block hover:text-[#BF5330] transition-colors focus-visible:outline-2 focus-visible:outline-[#BF5330] rounded max-w-[240px]"
                        >
                          {twoLines ? (
                            <>
                              <span
                                className="block text-[15px] sm:text-[16px] text-[#1A1614] group-hover:text-[#BF5330] font-normal leading-[1.2]"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                {twoLines[0]}
                              </span>
                              <span
                                className="block text-[15px] sm:text-[16px] text-[#1A1614] group-hover:text-[#BF5330] font-normal leading-[1.2]"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                {twoLines[1]}
                              </span>
                            </>
                          ) : (
                            <span
                              className="block text-[15px] sm:text-[16px] text-[#1A1614] group-hover:text-[#BF5330] font-normal leading-[1.2]"
                              style={{ fontFamily: "var(--font-heading)" }}
                            >
                              {p.name}
                            </span>
                          )}
                        </Link>
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 rounded-md text-[11.5px] font-semibold ${getCategoryBadgeClass(
                            p.category.name
                          )}`}
                        >
                          {p.category.name}
                        </span>
                      </td>

                      {/* Variants Count */}
                      <td className="px-4 py-3 text-center text-sm font-medium text-[#1A1614]">
                        {p.variantCount}
                      </td>

                      {/* Price Range */}
                      <td className="px-4 py-3 font-semibold text-sm font-[family-name:var(--font-price)] text-[#1A1614] whitespace-nowrap">
                        {priceLabel}
                      </td>

                      {/* Total Stock */}
                      <td className="px-4 py-3 text-center font-medium text-sm font-[family-name:var(--font-price)] text-[#1A1614]">
                        {p.totalStock}
                      </td>

                      {/* Status Toggle */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleProductActive(p)}
                          className={`inline-flex items-center justify-center px-3 py-0.5 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                            p.isActive
                              ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] hover:bg-emerald-100"
                              : "bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] hover:bg-rose-100"
                          }`}
                          title="Click to toggle active status"
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit button */}
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="w-8 h-8 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] flex items-center justify-center transition-colors shadow-2xs"
                            title="Edit product"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>

                          {/* View in storefront */}
                          <Link
                            href={`/products/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-8 h-8 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] flex items-center justify-center transition-colors shadow-2xs"
                            title="View product in storefront"
                            aria-label={`View ${p.name} on website`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Link>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="w-8 h-8 rounded-lg border border-[#FADCD5] bg-[#FFF5F2] hover:bg-[#FEEAE4] text-[#BF5330] hover:text-[#8F3E20] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                            title="Delete product"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ── 5. Table Footer / Pagination Controls ───────────────────────────── */}
      {!loading && !error && total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-1 text-sm font-medium text-[#635850]">
          {/* Page size & Total count */}
          <div className="flex items-center gap-2">
            <span>Show</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 px-2.5 pr-7 text-xs font-semibold rounded-lg border border-[#E8DFD4] bg-white text-[#1A1614] appearance-none cursor-pointer focus:outline-none focus:border-[#BF5330] shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <ChevronDown
                className="w-3 h-3 text-[#635850] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
            <span>of {total} products</span>
          </div>

          {/* Numeric Pagination */}
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
                // Show first, last, current, and neighbours
                return (
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - page) <= 1
                );
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
                      className={`w-8 h-8 rounded-lg text-sm font-semibold flex items-center justify-center transition-all cursor-pointer ${
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

      {/* ── 6. Delete Confirmation Modal ───────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-[#1A1614]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFD4] rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3
                  className="text-lg font-bold text-[#1A1614]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Delete Product
                </h3>
                <p className="text-xs text-[#635850]">
                  This action cannot be undone if completed.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#635850] leading-relaxed mb-5">
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#1A1614]">
                &ldquo;{deleteTarget.name}&rdquo;
              </span>
              ?
              <span className="block mt-2 p-2.5 rounded-lg bg-[#FAF5EF] border border-[#E8DFD4] text-[#8C7E72] text-[11.5px]">
                Note: If this product has ever been ordered by a customer, the
                database will protect order audit history and reject deletion. In
                that case, set the product to &ldquo;Inactive&rdquo; instead.
              </span>
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-[#E8DFD4] text-xs font-semibold text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EF] transition-colors cursor-pointer shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleting ? "Deleting..." : "Delete Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
