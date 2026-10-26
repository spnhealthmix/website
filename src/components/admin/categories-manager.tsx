"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import {
  Tag,
  Check,
  Package,
  PieChart,
  Plus,
  Search,
  ChevronDown,
  ChevronsUpDown,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  AlertCircle,
  Folder,
} from "lucide-react";

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  imageKey: string | null;
  imageUrl: string | null;
  productCount: number;
  createdAt: string;
};

type SortField = "order" | "name" | "slug" | "products" | "status";
type SortOrder = "asc" | "desc";

// Dedicated thumbnail fallbacks for established categories matching reference design
const CATEGORY_THUMBNAILS: Record<string, string> = {
  "health-mix-powders": "/categories/cat-health-mix.jpg",
  "podi-varieties": "/categories/cat-podi.jpg",
  "masalas-and-powders": "/categories/cat-masalas.jpg",
  "snacks": "/categories/cat-snacks.jpg",
  "thokku": "/categories/cat-thokku.jpg",
};

export function CategoriesManager() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("order");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal / Form state
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form values
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrderValue, setSortOrderValue] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch categories
  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load categories.");
      }
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const totalProducts = categories.reduce(
      (sum, c) => sum + (c.productCount || 0),
      0
    );
    const empty = categories.filter((c) => (c.productCount || 0) === 0).length;
    return { total, active, totalProducts, empty };
  }, [categories]);

  // Sorting Handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filtered and Sorted Categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesSlug = c.slug.toLowerCase().includes(q);
        const matchesDesc = (c.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesDesc) return false;
      }
      if (statusFilter === "true" && !c.isActive) return false;
      if (statusFilter === "false" && c.isActive) return false;
      return true;
    });
  }, [categories, searchQuery, statusFilter]);

  const sortedCategories = useMemo(() => {
    const list = [...filteredCategories];
    list.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case "order":
          result = a.sortOrder - b.sortOrder;
          break;
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "slug":
          result = a.slug.localeCompare(b.slug);
          break;
        case "products":
          result = (a.productCount || 0) - (b.productCount || 0);
          break;
        case "status":
          result = Number(b.isActive) - Number(a.isActive);
          break;
      }
      return sortOrder === "asc" ? result : -result;
    });
    return list;
  }, [filteredCategories, sortField, sortOrder]);

  // Paginated list
  const totalPages = Math.ceil(sortedCategories.length / pageSize) || 1;
  const paginatedCategories = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedCategories.slice(start, start + pageSize);
  }, [sortedCategories, page, pageSize]);

  // Checkbox Selection
  const allCurrentSelected =
    paginatedCategories.length > 0 &&
    paginatedCategories.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allCurrentSelected) {
      const next = new Set(selectedIds);
      paginatedCategories.forEach((c) => next.delete(c.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedCategories.forEach((c) => next.add(c.id));
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

  // Open Create Modal
  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setSlug("");
    setDescription("");
    setSortOrderValue(categories.length);
    setIsActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setSortOrderValue(cat.sortOrder);
    setIsActive(cat.isActive);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Close Modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormError(null);
  };

  // Form Submit (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    const payload: any = {
      name: name.trim(),
      description: description.trim() ? description.trim() : null,
      sortOrder: Number(sortOrderValue),
      isActive,
    };
    if (slug.trim()) {
      payload.slug = slug.trim();
    }

    try {
      const url = editingCategory
        ? `/api/admin/categories/${editingCategory.id}`
        : "/api/admin/categories";
      const method = editingCategory ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error?.message || "Operation failed.");
      }

      setActionSuccess(
        editingCategory
          ? "Category updated successfully."
          : "Category created successfully."
      );
      setTimeout(() => setActionSuccess(null), 4000);
      closeModal();
      await fetchCategories();
    } catch (err: any) {
      setFormError(err.message || "An error occurred.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Category
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error?.message || "Could not delete category.");
      }

      setActionSuccess(`Category "${deleteTarget.name}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteTarget(null);
      await fetchCategories();
    } catch (err: any) {
      alert(err.message || "Could not delete category.");
    } finally {
      setDeleting(false);
    }
  };

  // Toggle Active Status
  const toggleActiveStatus = async (cat: CategoryItem) => {
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(
          errJson?.error?.message || "Failed to update category status."
        );
      }
      await fetchCategories();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isFiltered = Boolean(searchQuery || statusFilter !== "");

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPage(1);
  };

  // Helper to resolve category image src
  const getCategoryImage = (cat: CategoryItem): string => {
    if (cat.imageUrl) return cat.imageUrl;
    if (cat.imageKey) {
      return cat.imageKey.startsWith("http")
        ? cat.imageKey
        : `/${cat.imageKey}`;
    }
    if (CATEGORY_THUMBNAILS[cat.slug]) {
      return CATEGORY_THUMBNAILS[cat.slug];
    }
    return `/categories/${cat.slug}.jpg`;
  };

  return (
    <div className="space-y-6 pb-12 font-[family-name:var(--font-body)]">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
        <div>
          <h1
            className="text-3xl sm:text-4xl lg:text-[40px] font-normal text-[#1A1614] leading-[1.1] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Category Management
          </h1>
          <p className="text-xs sm:text-sm text-[#635850] mt-1.5 font-normal">
            Taxonomy and ordering of products across the SPN Health Mix catalogue.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] transition-all self-start sm:self-center shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          <span>Add Category</span>
        </button>
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

      {/* ── 2. Summary Statistics Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Categories */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.total}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Total Categories
            </span>
          </div>
        </div>

        {/* Card 2: Active Categories */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] flex items-center justify-center shrink-0">
            <Check className="w-5 h-5 stroke-[2.4]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.active}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Active Categories
            </span>
          </div>
        </div>

        {/* Card 3: Total Products */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.totalProducts}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Total Products
            </span>
          </div>
        </div>

        {/* Card 4: Empty Categories */}
        <div className="rounded-2xl border border-[#E8DFD4] bg-white p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0">
            <PieChart className="w-5 h-5 stroke-[1.9]" aria-hidden="true" />
          </div>
          <div>
            <span
              className="block text-2xl sm:text-3xl font-bold text-[#1A1614] leading-none"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {stats.empty}
            </span>
            <span className="block text-xs text-[#635850] font-medium mt-1.5">
              Empty Categories
            </span>
          </div>
        </div>
      </div>

      {/* ── 3. Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[#8C7E72] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search categories by name or slug..."
            className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7E72] hover:text-[#1A1614] p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative shrink-0 sm:w-44">
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
              {selectedIds.size} categor{selectedIds.size > 1 ? "ies" : "y"} selected
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

      {/* ── 4. Categories Table Card ───────────────────────────────────────── */}
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
              Failed to load categories
            </h2>
            <p className="text-xs text-[#635850] max-w-sm mx-auto mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchCategories}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && categories.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center mb-3">
              <Folder className="w-6 h-6" />
            </div>
            <h2
              className="text-lg font-bold text-[#1A1614] mb-1"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No categories created yet
            </h2>
            <p className="text-xs text-[#635850] mb-4">
              Get started by organizing your catalogue with product categories.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add First Category</span>
            </button>
          </div>
        )}

        {/* Filtered Empty State */}
        {!loading && !error && categories.length > 0 && paginatedCategories.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-[#1A1614] mb-1">
              No categories match your filters
            </p>
            <p className="text-xs text-[#635850] mb-4">
              Try adjusting your search terms or clearing the status filter.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E8DFD4] text-xs font-semibold text-[#635850] hover:bg-[#FAF5EF] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}

        {/* Table View */}
        {!loading && !error && paginatedCategories.length > 0 && (
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
                      aria-label="Select all categories on this page"
                    />
                  </th>

                  {/* Order */}
                  <th
                    onClick={() => handleSort("order")}
                    className="w-20 px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Order
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Category Name */}
                  <th
                    onClick={() => handleSort("name")}
                    className="px-4 py-3.5 min-w-[220px] font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Category Name
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Slug */}
                  <th
                    onClick={() => handleSort("slug")}
                    className="px-4 py-3.5 font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      Slug
                      <ChevronsUpDown className="w-3.5 h-3.5 text-[#8C7E72]" />
                    </span>
                  </th>

                  {/* Products */}
                  <th
                    onClick={() => handleSort("products")}
                    className="px-4 py-3.5 text-center font-semibold text-[#635850] hover:text-[#1A1614] cursor-pointer transition-colors"
                  >
                    <span className="inline-flex items-center gap-1 justify-center">
                      Products
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
                {paginatedCategories.map((cat) => {
                  const isRowSelected = selectedIds.has(cat.id);
                  const thumbnailSrc = getCategoryImage(cat);

                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-[#FAF5EF]/50 transition-colors ${
                        isRowSelected ? "bg-[#FAF5EF]/60" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-12 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectRow(cat.id)}
                          className="w-4 h-4 rounded border-[#D4C5B5] text-[#BF5330] focus:ring-[#BF5330] accent-[#BF5330] cursor-pointer"
                          aria-label={`Select ${cat.name}`}
                        />
                      </td>

                      {/* Order */}
                      <td className="px-4 py-3 text-center text-[13px] font-medium text-[#635850]">
                        {cat.sortOrder}
                      </td>

                      {/* Category Name & Thumbnail */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-[#E8DFD4] bg-[#FAF5EF] shrink-0">
                            <Image
                              src={thumbnailSrc}
                              alt={cat.name}
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <span
                              className="block text-[15px] font-bold text-[#1A1614] leading-snug"
                              style={{ fontFamily: "var(--font-heading)" }}
                            >
                              {cat.name}
                            </span>
                            {cat.description && (
                              <span className="block text-[11px] text-[#8C7E72] mt-0.5 max-w-xs truncate">
                                {cat.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Slug */}
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-1 rounded-md text-[11.5px] font-mono text-[#635850] bg-[#FAF5EF] border border-[#E8DFD4]/70">
                          /{cat.slug}
                        </span>
                      </td>

                      {/* Products Count */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11.5px] font-medium bg-[#FFFBF7] text-[#635850] border border-[#E8DFD4]">
                          {cat.productCount} {cat.productCount === 1 ? "item" : "items"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleActiveStatus(cat)}
                          className={`inline-flex items-center justify-center px-3 py-0.5 rounded-md text-[11.5px] font-semibold transition-colors cursor-pointer ${
                            cat.isActive
                              ? "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] hover:bg-emerald-100"
                              : "bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3] hover:bg-rose-100"
                          }`}
                          title="Click to toggle active status"
                        >
                          {cat.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            className="w-8 h-8 rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                            title="Edit category"
                            aria-label={`Edit ${cat.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cat)}
                            className="w-8 h-8 rounded-lg border border-[#FADCD5] bg-[#FFF5F2] hover:bg-[#FEEAE4] text-[#BF5330] hover:text-[#8F3E20] flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                            title="Delete category"
                            aria-label={`Delete ${cat.name}`}
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

      {/* ── 5. Table Footer / Pagination ───────────────────────────────────── */}
      {!loading && !error && filteredCategories.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-1 text-sm font-medium text-[#635850]">
          {/* Showing Selector */}
          <div className="flex items-center gap-2">
            <span>Showing</span>
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
              </select>
              <ChevronDown
                className="w-3 h-3 text-[#635850] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
            </div>
            <span>of {filteredCategories.length} categories</span>
          </div>

          {/* Pagination Navigation if multiple pages */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 select-none">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              >
                Previous
              </button>
              <span className="text-xs px-2 text-[#1A1614] font-semibold">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 text-xs rounded-lg border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 6. Create / Edit Category Modal ────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1A1614]/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFD4] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#E8DFD4] mb-5">
              <div>
                <h2
                  className="text-2xl font-bold text-[#1A1614]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {editingCategory ? "Edit Category" : "Add New Category"}
                </h2>
                <p className="text-xs text-[#635850] mt-0.5">
                  {editingCategory
                    ? "Update category taxonomy, description and ordering."
                    : "Create a new product category for your store."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-lg text-[#8C7E72] hover:text-[#1A1614] hover:bg-[#FAF5EF] flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label
                  htmlFor="cat-name"
                  className="block font-semibold text-[#1A1614] mb-1.5"
                >
                  Category Name <span className="text-[#BF5330]">*</span>
                </label>
                <input
                  id="cat-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Traditional Health Mixes"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                />
              </div>

              <div>
                <label
                  htmlFor="cat-slug"
                  className="block font-semibold text-[#1A1614] mb-1.5"
                >
                  URL Slug{" "}
                  <span className="text-[#8C7E72] font-normal">
                    (Optional — auto-generated if blank)
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7E72] font-mono text-xs">
                    /
                  </span>
                  <input
                    id="cat-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="health-mix-powders"
                    className="w-full h-10 pl-7 pr-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] font-mono text-xs focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="cat-desc"
                  className="block font-semibold text-[#1A1614] mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="cat-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description displayed in storefront headers and category listings"
                  className="w-full p-3 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label
                    htmlFor="cat-order"
                    className="block font-semibold text-[#1A1614] mb-1.5"
                  >
                    Display Order
                  </label>
                  <input
                    id="cat-order"
                    type="number"
                    value={sortOrderValue}
                    onChange={(e) => setSortOrderValue(Number(e.target.value))}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-[#D4C5B5] text-[#BF5330] focus:ring-[#BF5330] accent-[#BF5330] cursor-pointer"
                    />
                    <span className="font-semibold text-xs text-[#1A1614]">
                      Visible in Store
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-5 border-t border-[#E8DFD4]">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl border border-[#E8DFD4] text-xs font-semibold text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EF] transition-colors cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {formSubmitting
                    ? "Saving..."
                    : editingCategory
                    ? "Update Category"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. Delete Confirmation Modal ───────────────────────────────────── */}
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
                  Delete Category
                </h3>
                <p className="text-xs text-[#635850]">
                  This action cannot be undone if completed.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#635850] leading-relaxed mb-4">
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#1A1614]">
                &ldquo;{deleteTarget.name}&rdquo;
              </span>
              ?
            </p>

            {deleteTarget.productCount > 0 ? (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11.5px] leading-relaxed">
                <span className="font-bold block mb-0.5">
                  Restricted Action: {deleteTarget.productCount} associated product(s)
                </span>
                The database will protect products and reject deletion until they
                are moved to another category or deleted. Consider deactivating
                the category instead.
              </div>
            ) : (
              <div className="mb-5 p-3 rounded-xl bg-[#FAF5EF] border border-[#E8DFD4] text-[#635850] text-[11.5px]">
                This category has 0 associated products and can be safely removed.
              </div>
            )}

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
                {deleting ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
