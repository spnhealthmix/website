"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";
import { slugify } from "@/lib/admin/slug";

export type IncludedItem = {
  id?: string;
  productId?: string | null;
  productVariantId?: string | null;
  itemTitle: string;
  quantity: number;
  unit?: string | null;
  sortOrder: number;
};

export type ComboOfferAdminItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  offerBadge?: string | null;
  packageLabel?: string | null;
  categoryId?: string | null;
  imageUrl?: string | null;
  desktopImageUrl: string;
  mobileImageUrl: string;
  destinationUrl: string;
  pricePaise: number;
  mrpPaise?: number | null;
  savingsPaise?: number;
  discountPercentage?: number;
  stock: number;
  allowAddToCart: boolean;
  packageHighlights: string[];
  variantId?: string | null;
  displayOrder: number;
  isActive: boolean;
  items?: IncludedItem[];
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  name: string;
  slug: string;
};

const BADGE_PRESETS = [
  "Super Saver",
  "Fast Moving",
  "Festive Pack",
  "Authentic Taste",
  "Limited Time",
  "Crispy & Fresh",
  "Diwali Special",
];

function formatRupee(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

export function ComboOffersManager() {
  const [offers, setOffers] = useState<ComboOfferAdminItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal / Form state
  const [editingOffer, setEditingOffer] = useState<ComboOfferAdminItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "images" | "highlights" | "items" | "pricing">("basic");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields: Basic
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [offerBadge, setOfferBadge] = useState("Super Saver");
  const [packageLabel, setPackageLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("/combo-offers");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Form fields: Images
  const [imageUrl, setImageUrl] = useState("");
  const [desktopImageUrl, setDesktopImageUrl] = useState("");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [desktopUploading, setDesktopUploading] = useState(false);
  const [mobileUploading, setMobileUploading] = useState(false);

  // Form fields: Highlights
  const [highlights, setHighlights] = useState<string[]>([]);
  const [newHighlightText, setNewHighlightText] = useState("");

  // Form fields: What's Inside (Included Products)
  const [includedItems, setIncludedItems] = useState<IncludedItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState("");

  // Form fields: Pricing & Availability
  const [sellingPriceRupees, setSellingPriceRupees] = useState<string>("0");
  const [mrpRupees, setMrpRupees] = useState<string>("");
  const [stock, setStock] = useState<number>(50);
  const [allowAddToCart, setAllowAddToCart] = useState<boolean>(true);

  // File input refs
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Delete target modal
  const [deleteTarget, setDeleteTarget] = useState<ComboOfferAdminItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lightbox preview for full image
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Calculate live savings and discount percentage
  const numSellingPrice = Math.max(0, parseFloat(sellingPriceRupees) || 0);
  const numMrp = mrpRupees ? Math.max(0, parseFloat(mrpRupees) || 0) : 0;
  const liveSavings = numMrp > numSellingPrice ? numMrp - numSellingPrice : 0;
  const liveDiscountPercent = numMrp > numSellingPrice ? Math.round(((numMrp - numSellingPrice) / numMrp) * 100) : 0;

  const fetchOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/combo-offers", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load combo offers.");
      }
      const data = await res.json();
      setOffers(data.comboOffers || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch combo offers.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/admin/categories", { cache: "no-store" }),
        fetch("/api/admin/products?limit=100", { cache: "no-store" }),
      ]);

      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setAvailableProducts(prodData.products || []);
      }
    } catch (err) {
      console.error("Could not fetch categories or products:", err);
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchDependencies();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setName("");
    setSlug("");
    setSlugEditedManually(false);
    setShortDescription("");
    setDescription("");
    setOfferBadge("Super Saver");
    setPackageLabel("");
    setCategoryId(categories.length > 0 ? categories[0].id : "");
    setDestinationUrl("/combo-offers");
    setDisplayOrder(offers.length > 0 ? Math.max(...offers.map((o) => o.displayOrder)) + 1 : 0);
    setIsActive(true);
    setImageUrl("");
    setDesktopImageUrl("");
    setMobileImageUrl("");
    setHighlights([]);
    setNewHighlightText("");
    setIncludedItems([]);
    setSellingPriceRupees("999");
    setMrpRupees("1599");
    setStock(50);
    setAllowAddToCart(true);
    setActiveTab("basic");
    setFormError(null);
    setIsCreating(true);
  };

  const openEditModal = (offer: ComboOfferAdminItem) => {
    setEditingOffer(offer);
    setName(offer.name);
    setSlug(offer.slug);
    setSlugEditedManually(true);
    setShortDescription(offer.shortDescription || "");
    setDescription(offer.description || "");
    setOfferBadge(offer.offerBadge || "");
    setPackageLabel(offer.packageLabel || "");
    setCategoryId(offer.categoryId || "");
    setDestinationUrl(offer.destinationUrl || `/combo-offers/${offer.slug}`);
    setDisplayOrder(offer.displayOrder ?? 0);
    setIsActive(offer.isActive);
    setImageUrl(offer.imageUrl || "");
    setDesktopImageUrl(offer.desktopImageUrl);
    setMobileImageUrl(offer.mobileImageUrl);
    setHighlights(offer.packageHighlights || []);
    setNewHighlightText("");
    setIncludedItems(offer.items || []);
    setSellingPriceRupees(String(Math.round((offer.pricePaise || 0) / 100)));
    setMrpRupees(offer.mrpPaise ? String(Math.round(offer.mrpPaise / 100)) : "");
    setStock(offer.stock ?? 50);
    setAllowAddToCart(offer.allowAddToCart ?? true);
    setActiveTab("basic");
    setFormError(null);
    setIsCreating(false);
  };

  const closeModal = () => {
    setIsCreating(false);
    setEditingOffer(null);
    setFormError(null);
  };

  // Auto-slugify when name changes if not manually modified
  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEditedManually) {
      setSlug(slugify(val));
    }
  };

  // Highlights handlers
  const addHighlight = () => {
    const trimmed = newHighlightText.trim();
    if (!trimmed) return;
    if (highlights.includes(trimmed)) {
      setFormError("This highlight is already added.");
      return;
    }
    setHighlights([...highlights, trimmed]);
    setNewHighlightText("");
    setFormError(null);
  };

  const removeHighlight = (idx: number) => {
    setHighlights(highlights.filter((_, i) => i !== idx));
  };

  const moveHighlight = (idx: number, dir: "up" | "down") => {
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === highlights.length - 1) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    const next = [...highlights];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setHighlights(next);
  };

  // Included Products handlers
  const handleSelectProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const found = availableProducts.find((p) => p.id === prodId);
    if (found && !newItemTitle) {
      setNewItemTitle(found.name);
    }
  };

  const addIncludedItem = () => {
    const title = newItemTitle.trim();
    if (!title) {
      setFormError("Please enter a title for the included product.");
      return;
    }

    const newItem: IncludedItem = {
      productId: selectedProductId || null,
      itemTitle: title,
      quantity: Math.max(1, newItemQuantity),
      unit: newItemUnit.trim() || null,
      sortOrder: includedItems.length,
    };

    setIncludedItems([...includedItems, newItem]);
    setSelectedProductId("");
    setNewItemTitle("");
    setNewItemQuantity(1);
    setNewItemUnit("");
    setFormError(null);
  };

  const removeIncludedItem = (idx: number) => {
    setIncludedItems(includedItems.filter((_, i) => i !== idx));
  };

  const moveIncludedItem = (idx: number, dir: "up" | "down") => {
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === includedItems.length - 1) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    const next = [...includedItems];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setIncludedItems(next);
  };

  // Image Upload handler
  const handleImageUpload = async (file: File | undefined, type: "main" | "desktop" | "mobile") => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError("File size exceeds 5MB limit.");
      return;
    }

    if (type === "main") setImageUploading(true);
    else if (type === "desktop") setDesktopUploading(true);
    else setMobileUploading(true);
    setFormError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/combo-offers/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to upload image.");
      }

      if (type === "main") {
        setImageUrl(data.url);
      } else if (type === "desktop") {
        setDesktopImageUrl(data.url);
      } else {
        setMobileImageUrl(data.url);
      }
    } catch (err: any) {
      setFormError(err.message || "Upload failed. Please try again.");
    } finally {
      if (type === "main") setImageUploading(false);
      else if (type === "desktop") setDesktopUploading(false);
      else setMobileUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setActiveTab("basic");
      setFormError("Offer name is required.");
      return;
    }

    const cleanSlug = slug.trim() ? slugify(slug.trim()) : slugify(name);
    if (!cleanSlug) {
      setActiveTab("basic");
      setFormError("A valid URL slug is required.");
      return;
    }

    if (!desktopImageUrl) {
      setActiveTab("images");
      setFormError("Desktop promotional poster is required.");
      return;
    }

    if (!mobileImageUrl) {
      setActiveTab("images");
      setFormError("Mobile promotional poster is required.");
      return;
    }

    const pricePaise = Math.round((parseFloat(sellingPriceRupees) || 0) * 100);
    const mrpPaise = mrpRupees.trim() ? Math.round(parseFloat(mrpRupees) * 100) : null;

    if (pricePaise < 0) {
      setActiveTab("pricing");
      setFormError("Selling price must be 0 or greater.");
      return;
    }

    if (mrpPaise !== null && mrpPaise > 0 && pricePaise > mrpPaise) {
      setActiveTab("pricing");
      setFormError("Selling price cannot exceed the original price / MRP.");
      return;
    }

    setFormSubmitting(true);

    const payload = {
      name: name.trim(),
      slug: cleanSlug,
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      offerBadge: offerBadge.trim() || null,
      packageLabel: packageLabel.trim() || null,
      categoryId: categoryId || null,
      imageUrl: imageUrl.trim() || null,
      desktopImageUrl: desktopImageUrl.trim(),
      mobileImageUrl: mobileImageUrl.trim(),
      destinationUrl: destinationUrl.trim() || `/combo-offers/${cleanSlug}`,
      pricePaise,
      mrpPaise,
      stock: Number(stock) || 0,
      allowAddToCart,
      packageHighlights: highlights,
      displayOrder: Number(displayOrder) || 0,
      isActive,
      includedItems: includedItems.map((item, idx) => ({
        productId: item.productId || null,
        productVariantId: item.productVariantId || null,
        itemTitle: item.itemTitle,
        quantity: item.quantity,
        unit: item.unit || null,
        sortOrder: idx,
      })),
    };

    try {
      const endpoint = editingOffer ? `/api/admin/combo-offers/${editingOffer.id}` : "/api/admin/combo-offers";
      const method = editingOffer ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(resData?.error?.message || "Failed to save combo offer.");
      }

      setActionSuccess(editingOffer ? "Combo offer updated successfully." : "New combo offer created successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      closeModal();
      await fetchOffers();
    } catch (err: any) {
      setFormError(err.message || "Failed to save combo offer.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/combo-offers/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to delete combo offer.");
      }

      setActionSuccess(`Combo offer "${deleteTarget.name}" deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteTarget(null);
      await fetchOffers();
    } catch (err: any) {
      setError(err.message || "Failed to delete combo offer.");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (offer: ComboOfferAdminItem) => {
    try {
      const res = await fetch(`/api/admin/combo-offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error?.message || "Failed to update status.");
      }

      setOffers((prev) =>
        prev.map((item) => (item.id === offer.id ? { ...item, isActive: !item.isActive } : item))
      );
      setActionSuccess(`Offer "${offer.name}" ${!offer.isActive ? "activated" : "deactivated"}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to toggle status.");
    }
  };

  // Filtered offers list
  const filteredOffers = offers.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.offerBadge && item.offerBadge.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" ? true : statusFilter === "active" ? item.isActive : !item.isActive;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#E8DFD4]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1614] font-[family-name:var(--font-heading)]">
              Combo Offers Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF5EE] text-[#BF5330] border border-[#E8DFD4]">
              {offers.length} {offers.length === 1 ? "Offer" : "Offers"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#7A6E65]">
            Create and manage promotional posters, pricing, included products, and festival bundles for the homepage and combo offers page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/combo-offers"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs font-semibold text-[#1A1614] shadow-2xs hover:bg-[#FAF5EE] transition-all"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#7A6E65]" /> View Storefront Page
          </Link>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#BF5330] text-white text-sm font-bold shadow-xs hover:bg-[#A84524] active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Combo Offer
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-[10px] bg-[#EBF7EE] border border-[#CBE7D3] px-4 py-3 text-sm text-[#247B49] animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-[10px] bg-[#FDF3EE] border border-[#F2D6C9] px-4 py-3 text-sm text-[#BF5330]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-semibold underline hover:text-[#8F3E20]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-[12px] border border-[#E8DFD4] shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7A6E65]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by offer name, slug, badge..."
            className="w-full pl-9 pr-3 py-1.5 rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] placeholder-[#7A6E65] focus:outline-none focus:border-[#BF5330] focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#7A6E65] hover:text-[#1A1614]"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-[#7A6E65]">Status:</span>
          <div className="inline-flex rounded-[8px] bg-[#FAF5EE] p-0.5 border border-[#E8DFD4]">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-[6px] text-xs font-bold capitalize transition-all cursor-pointer ${
                  statusFilter === s ? "bg-white text-[#BF5330] shadow-2xs" : "text-[#7A6E65] hover:text-[#1A1614]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchOffers}
            disabled={loading}
            className="p-2 rounded-[8px] bg-white border border-[#E8DFD4] text-[#7A6E65] hover:text-[#1A1614] hover:bg-[#FAF5EE] transition-all cursor-pointer"
            title="Refresh offers list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Offers Table */}
      <div className="bg-white rounded-[16px] border border-[#E8DFD4] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#7A6E65] gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#BF5330]" />
            <span className="text-sm font-medium">Loading combo offers...</span>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="py-16 text-center text-[#7A6E65] px-4">
            <Package className="h-10 w-10 mx-auto mb-3 text-[#D6C7BA]" />
            <h3 className="font-semibold text-base text-[#1A1614] mb-1">No combo offers found</h3>
            <p className="text-xs sm:text-sm max-w-md mx-auto text-[#7A6E65] mb-5">
              {searchTerm || statusFilter !== "all"
                ? "No combo offers match your search and filter criteria."
                : "You haven't configured any combo offers yet. Create your first combo offer with promotional posters and included products."}
            </p>
            {searchTerm || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
                className="text-xs font-bold text-[#BF5330] underline hover:text-[#8F3E20]"
              >
                Clear Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#BF5330] text-white text-xs font-bold shadow-xs hover:bg-[#A84524]"
              >
                <Plus className="h-4 w-4" /> Add First Combo Offer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-[#FAF5EE] border-b border-[#E8DFD4] text-[#7A6E65] font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Thumbnails</th>
                  <th className="py-3.5 px-4">Offer Details</th>
                  <th className="py-3.5 px-4">Pricing & MRP</th>
                  <th className="py-3.5 px-4 text-center">Included Items</th>
                  <th className="py-3.5 px-4 text-center">Order</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD4]">
                {filteredOffers.map((offer) => {
                  const savings =
                    offer.mrpPaise && offer.mrpPaise > offer.pricePaise
                      ? offer.mrpPaise - offer.pricePaise
                      : 0;
                  const discount =
                    offer.mrpPaise && offer.mrpPaise > offer.pricePaise
                      ? Math.round(((offer.mrpPaise - offer.pricePaise) / offer.mrpPaise) * 100)
                      : 0;

                  return (
                    <tr
                      key={offer.id}
                      className="hover:bg-[#FAF5EE]/40 transition-colors group"
                    >
                      {/* Image Thumbnails */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: offer.imageUrl || offer.desktopImageUrl,
                                title: `${offer.name} (Offer Image)`,
                              })
                            }
                            className="relative h-12 w-16 rounded-[8px] overflow-hidden bg-[#FAF5EE] border border-[#E8DFD4] shrink-0 group-hover:border-[#BF5330] transition-colors cursor-zoom-in"
                            title="Click to zoom image"
                          >
                            <Image
                              src={offer.imageUrl || offer.desktopImageUrl}
                              alt={offer.name}
                              fill
                              className="object-contain"
                            />
                          </button>
                          <div className="hidden sm:flex flex-col gap-1 text-[10px] text-[#7A6E65]">
                            <span
                              onClick={() =>
                                setPreviewImage({
                                  url: offer.desktopImageUrl,
                                  title: `${offer.name} (Desktop Poster)`,
                                })
                              }
                              className="hover:text-[#BF5330] cursor-pointer"
                            >
                              Desktop
                            </span>
                            <span
                              onClick={() =>
                                setPreviewImage({
                                  url: offer.mobileImageUrl,
                                  title: `${offer.name} (Mobile Poster)`,
                                })
                              }
                              className="hover:text-[#BF5330] cursor-pointer"
                            >
                              Mobile
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Offer Details */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#1A1614] hover:text-[#BF5330] transition-colors">
                              {offer.name}
                            </span>
                            {offer.offerBadge && (
                              <span className="px-2 py-0.5 rounded-[4px] bg-[#FAF5EE] text-[#BF5330] border border-[#E8DFD4] text-[10px] font-bold">
                                {offer.offerBadge}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#7A6E65]">
                            <code className="text-[11px] bg-[#FAF5EE] px-1.5 py-0.5 rounded text-[#7A6E65] border border-[#E8DFD4]">
                              /{offer.slug}
                            </code>
                            {offer.packageLabel && (
                              <span className="text-[11px] font-medium text-[#56634A]">
                                • {offer.packageLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Pricing & MRP */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-[family-name:var(--font-price)] font-bold text-[#BF5330] text-sm">
                              {formatRupee(offer.pricePaise)}
                            </span>
                            {offer.mrpPaise && offer.mrpPaise > offer.pricePaise && (
                              <span className="font-[family-name:var(--font-price)] text-xs text-[#7A6E65] line-through">
                                {formatRupee(offer.mrpPaise)}
                              </span>
                            )}
                          </div>
                          {savings > 0 && (
                            <span className="text-[10px] font-semibold text-[#247B49] block">
                              Save {formatRupee(savings)} ({discount}% off)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Included Items Count */}
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FAF5EE] text-[#1A1614] border border-[#E8DFD4]">
                          {offer.items?.length || 0} items
                        </span>
                      </td>

                      {/* Order */}
                      <td className="py-3 px-4 text-center font-semibold text-xs text-[#7A6E65]">
                        #{offer.displayOrder}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(offer)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            offer.isActive
                              ? "bg-[#EBF7EE] text-[#247B49] border border-[#CBE7D3]"
                              : "bg-[#FAF5EE] text-[#7A6E65] border border-[#E8DFD4]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              offer.isActive ? "bg-[#247B49]" : "bg-[#7A6E65]"
                            }`}
                          />
                          {offer.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/combo-offers/${offer.slug}`}
                            target="_blank"
                            className="p-1.5 rounded-[6px] hover:bg-[#FAF5EE] text-[#7A6E65] hover:text-[#BF5330] transition-colors"
                            title="Preview on Storefront"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(offer)}
                            className="p-1.5 rounded-[6px] hover:bg-[#FAF5EE] text-[#7A6E65] hover:text-[#1A1614] transition-colors cursor-pointer"
                            title="Edit Offer"
                          >
                            <span className="text-xs font-semibold underline">Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(offer)}
                            className="p-1.5 rounded-[6px] hover:bg-[#FDF3EE] text-[#7A6E65] hover:text-[#BF5330] transition-colors cursor-pointer"
                            title="Delete Offer"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* ========================================================================= */}
      {/* ADD / EDIT COMBO OFFER MODAL                                              */}
      {/* ========================================================================= */}
      <AdminModal
        isOpen={isCreating || editingOffer !== null}
        onClose={closeModal}
        title={editingOffer ? `Edit Combo Offer: ${editingOffer.name}` : "Create New Combo Offer"}
      >
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {formError && (
            <div className="rounded-[8px] bg-[#FDF3EE] border border-[#F2D6C9] p-3 text-xs text-[#BF5330] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Modal Tabs */}
          <div className="flex items-center gap-1 border-b border-[#E8DFD4] pb-2 overflow-x-auto">
            {[
              { id: "basic", label: "1. Basic Details" },
              { id: "images", label: "2. Images & Posters" },
              { id: "highlights", label: "3. Highlights" },
              { id: "items", label: `4. What's Inside (${includedItems.length})` },
              { id: "pricing", label: "5. Pricing & Stock" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#BF5330] text-white shadow-2xs"
                    : "text-[#7A6E65] hover:text-[#1A1614] hover:bg-[#FAF5EE]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ================= TAB 1: BASIC DETAILS ================= */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Offer Name <span className="text-[#BF5330]">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Family Combo Offer"
                    required
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    URL Slug <span className="text-[#BF5330]">*</span>
                  </label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugEditedManually(true);
                    }}
                    placeholder="e.g. family-combo-offer"
                    required
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm font-mono text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Offer Badge
                  </label>
                  <input
                    type="text"
                    value={offerBadge}
                    onChange={(e) => setOfferBadge(e.target.value)}
                    placeholder="e.g. Super Saver"
                    list="badge-presets"
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                  <datalist id="badge-presets">
                    {BADGE_PRESETS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Package Label
                  </label>
                  <input
                    type="text"
                    value={packageLabel}
                    onChange={(e) => setPackageLabel(e.target.value)}
                    placeholder="e.g. 12-in-1 Pack"
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Category (Optional)
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  >
                    <option value="">None / General</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1614] mb-1">
                  Short Description
                </label>
                <textarea
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief summary displayed on the card and hero slider..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1614] mb-1">
                  Full Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed information displayed on the individual offer detail page..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1A1614] mb-1">
                  Destination Page / URL
                </label>
                <input
                  type="text"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder={`/combo-offers/${slug || "offer-slug"}`}
                  className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                />
                <p className="mt-1 text-[11px] text-[#7A6E65]">
                  Defaults to `/combo-offers/${slug || "offer-slug"}`. Poster clicks will navigate here.
                </p>
              </div>
            </div>
          )}

          {/* ================= TAB 2: IMAGES & POSTERS ================= */}
          {activeTab === "images" && (
            <div className="space-y-6">
              {/* Customer-Facing Main Offer Image */}
              <div className="p-4 rounded-[12px] bg-[#FAF5EE] border border-[#E8DFD4] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1614]">
                      Customer-Facing Offer Image
                    </h4>
                    <p className="text-[11px] text-[#7A6E65]">
                      Displayed on the `/combo-offers` listing and `/combo-offers/[slug]` detail page.
                    </p>
                  </div>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-xs text-[#BF5330] hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {imageUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-28 rounded-[8px] overflow-hidden bg-white border border-[#E8DFD4] shrink-0">
                      <Image src={imageUrl} alt="Offer Main" fill className="object-contain" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-white border border-[#E8DFD4] text-xs text-[#7A6E65]"
                      />
                      <button
                        type="button"
                        onClick={() => mainImageInputRef.current?.click()}
                        className="text-xs font-bold text-[#BF5330] hover:underline cursor-pointer"
                      >
                        Replace Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => mainImageInputRef.current?.click()}
                    className="border-2 border-dashed border-[#D6C7BA] rounded-[10px] p-6 text-center cursor-pointer hover:border-[#BF5330] hover:bg-white transition-all"
                  >
                    {imageUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#BF5330]" />
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 mx-auto mb-1 text-[#7A6E65]" />
                        <span className="text-xs font-semibold text-[#1A1614] block">
                          Click to upload customer-facing image
                        </span>
                        <span className="text-[11px] text-[#7A6E65]">PNG, JPG, WebP up to 5MB</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={mainImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0], "main")}
                />
              </div>

              {/* Desktop Promotional Poster */}
              <div className="p-4 rounded-[12px] bg-[#FAF5EE] border border-[#E8DFD4] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1614]">
                      Desktop Promotional Poster <span className="text-[#BF5330]">*</span>
                    </h4>
                    <p className="text-[11px] text-[#7A6E65]">
                      Optimized for desktop carousel and large screens.
                    </p>
                  </div>
                  {desktopImageUrl && (
                    <button
                      type="button"
                      onClick={() => desktopFileInputRef.current?.click()}
                      className="text-xs font-bold text-[#BF5330] hover:underline cursor-pointer"
                    >
                      Replace
                    </button>
                  )}
                </div>

                {desktopImageUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-32 rounded-[8px] overflow-hidden bg-white border border-[#E8DFD4] shrink-0">
                      <Image src={desktopImageUrl} alt="Desktop Poster" fill className="object-contain" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <input
                        type="text"
                        value={desktopImageUrl}
                        onChange={(e) => setDesktopImageUrl(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-white border border-[#E8DFD4] text-xs text-[#7A6E65]"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => desktopFileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#D6C7BA] rounded-[10px] p-6 text-center cursor-pointer hover:border-[#BF5330] hover:bg-white transition-all"
                  >
                    {desktopUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#BF5330]" />
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 mx-auto mb-1 text-[#7A6E65]" />
                        <span className="text-xs font-semibold text-[#1A1614] block">
                          Upload Desktop Poster (Required)
                        </span>
                        <span className="text-[11px] text-[#7A6E65]">PNG, JPG, WebP up to 5MB</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={desktopFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0], "desktop")}
                />
              </div>

              {/* Mobile Promotional Poster */}
              <div className="p-4 rounded-[12px] bg-[#FAF5EE] border border-[#E8DFD4] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1A1614]">
                      Mobile Promotional Poster <span className="text-[#BF5330]">*</span>
                    </h4>
                    <p className="text-[11px] text-[#7A6E65]">
                      Optimized for phone screens so text and products stay sharp and readable.
                    </p>
                  </div>
                  {mobileImageUrl && (
                    <button
                      type="button"
                      onClick={() => mobileFileInputRef.current?.click()}
                      className="text-xs font-bold text-[#BF5330] hover:underline cursor-pointer"
                    >
                      Replace
                    </button>
                  )}
                </div>

                {mobileImageUrl ? (
                  <div className="flex items-center gap-4">
                    <div className="relative h-20 w-20 rounded-[8px] overflow-hidden bg-white border border-[#E8DFD4] shrink-0">
                      <Image src={mobileImageUrl} alt="Mobile Poster" fill className="object-contain" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <input
                        type="text"
                        value={mobileImageUrl}
                        onChange={(e) => setMobileImageUrl(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-white border border-[#E8DFD4] text-xs text-[#7A6E65]"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => mobileFileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#D6C7BA] rounded-[10px] p-6 text-center cursor-pointer hover:border-[#BF5330] hover:bg-white transition-all"
                  >
                    {mobileUploading ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#BF5330]" />
                    ) : (
                      <>
                        <UploadCloud className="h-6 w-6 mx-auto mb-1 text-[#7A6E65]" />
                        <span className="text-xs font-semibold text-[#1A1614] block">
                          Upload Mobile Poster (Required)
                        </span>
                        <span className="text-[11px] text-[#7A6E65]">PNG, JPG, WebP up to 5MB</span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files?.[0], "mobile")}
                />
              </div>
            </div>
          )}

          {/* ================= TAB 3: HIGHLIGHTS ================= */}
          {activeTab === "highlights" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1A1614] mb-1">
                  Add Package Highlight
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newHighlightText}
                    onChange={(e) => setNewHighlightText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHighlight();
                      }
                    }}
                    placeholder="e.g. Traditional Health Mix, Pure Cow Ghee, Zero Refined Sugar"
                    className="flex-1 px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                  <button
                    type="button"
                    onClick={addHighlight}
                    className="px-4 py-2 rounded-[8px] bg-[#BF5330] text-white text-xs font-bold hover:bg-[#A84524] cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {highlights.length === 0 ? (
                <div className="py-8 text-center text-[#7A6E65] border border-dashed border-[#E8DFD4] rounded-[10px]">
                  <p className="text-xs">No highlights added yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {highlights.map((hl, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-[8px] bg-[#FAF5EE] border border-[#E8DFD4]"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-[#247B49] shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-[#1A1614]">{hl}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveHighlight(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 text-[#7A6E65] hover:text-[#1A1614] disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHighlight(idx, "down")}
                          disabled={idx === highlights.length - 1}
                          className="p-1 text-[#7A6E65] hover:text-[#1A1614] disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeHighlight(idx)}
                          className="p-1 text-[#BF5330] hover:text-[#8F3E20]"
                          title="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 4: WHAT'S INSIDE ================= */}
          {activeTab === "items" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[12px] bg-[#FAF5EE] border border-[#E8DFD4] space-y-3">
                <h4 className="text-xs font-bold text-[#1A1614]">
                  Add Included Product / Flavour
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Select Existing Product
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => handleSelectProductChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-[6px] bg-white border border-[#E8DFD4] text-xs text-[#1A1614]"
                    >
                      <option value="">-- Choose from catalogue --</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Item Title
                    </label>
                    <input
                      type="text"
                      value={newItemTitle}
                      onChange={(e) => setNewItemTitle(e.target.value)}
                      placeholder="e.g. Paruppu Podi"
                      className="w-full px-2.5 py-1.5 rounded-[6px] bg-white border border-[#E8DFD4] text-xs text-[#1A1614]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-[#7A6E65] mb-1">
                      Pack / Unit
                    </label>
                    <input
                      type="text"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      placeholder="e.g. 250 g"
                      className="w-full px-2.5 py-1.5 rounded-[6px] bg-white border border-[#E8DFD4] text-xs text-[#1A1614]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-[#7A6E65]">Quantity:</label>
                    <input
                      type="number"
                      min={1}
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(Number(e.target.value) || 1)}
                      className="w-16 px-2 py-1 rounded-[6px] bg-white border border-[#E8DFD4] text-xs text-center font-bold"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={addIncludedItem}
                    className="px-3.5 py-1.5 rounded-[6px] bg-[#BF5330] text-white text-xs font-bold hover:bg-[#A84524] cursor-pointer"
                  >
                    Add Item to Offer
                  </button>
                </div>
              </div>

              {includedItems.length === 0 ? (
                <div className="py-8 text-center text-[#7A6E65] border border-dashed border-[#E8DFD4] rounded-[10px]">
                  <p className="text-xs">No items included yet. Add items above.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {includedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-[8px] bg-white border border-[#E8DFD4]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="h-5 w-5 rounded-full bg-[#FAF5EE] text-[#BF5330] flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-[#1A1614]">
                            {item.itemTitle}
                          </span>
                          {item.unit && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAF5EE] text-[#56634A] border border-[#E8DFD4]">
                              {item.unit}
                            </span>
                          )}
                          {item.quantity > 1 && (
                            <span className="ml-2 text-xs text-[#7A6E65]">Qty: {item.quantity}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveIncludedItem(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 text-[#7A6E65] hover:text-[#1A1614] disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveIncludedItem(idx, "down")}
                          disabled={idx === includedItems.length - 1}
                          className="p-1 text-[#7A6E65] hover:text-[#1A1614] disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeIncludedItem(idx)}
                          className="p-1 text-[#BF5330] hover:text-[#8F3E20]"
                          title="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 5: PRICING & STOCK ================= */}
          {activeTab === "pricing" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Selling Price (₹) <span className="text-[#BF5330]">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={sellingPriceRupees}
                    onChange={(e) => setSellingPriceRupees(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm font-bold text-[#BF5330] focus:outline-none focus:border-[#BF5330]"
                  />
                  <p className="mt-1 text-[11px] text-[#7A6E65]">
                    Stored in integer paise (₹{sellingPriceRupees || 0} = {Math.round((parseFloat(sellingPriceRupees) || 0) * 100)} paise)
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Original Price / MRP (₹) (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={mrpRupees}
                    onChange={(e) => setMrpRupees(e.target.value)}
                    placeholder="e.g. 1599"
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614] focus:outline-none focus:border-[#BF5330]"
                  />
                  <p className="mt-1 text-[11px] text-[#7A6E65]">
                    Leave empty if no discount display is needed.
                  </p>
                </div>
              </div>

              {/* Live Savings Calculation Banner */}
              {liveSavings > 0 && (
                <div className="p-3.5 rounded-[10px] bg-[#EBF7EE] border border-[#CBE7D3] flex items-center justify-between text-xs text-[#247B49] font-bold">
                  <span>Customer Savings: ₹{liveSavings.toLocaleString("en-IN")}</span>
                  <span>{liveDiscountPercent}% OFF</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Stock Available
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1A1614] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs sm:text-sm text-[#1A1614]"
                  />
                  <p className="mt-1 text-[11px] text-[#7A6E65]">Lower numbers appear first in the carousel.</p>
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowAddToCart}
                    onChange={(e) => setAllowAddToCart(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E8DFD4] text-[#BF5330] focus:ring-[#BF5330]"
                  />
                  <span className="text-xs font-semibold text-[#1A1614]">
                    Allow Add to Cart directly from combo offers page
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E8DFD4] text-[#BF5330] focus:ring-[#BF5330]"
                  />
                  <span className="text-xs font-semibold text-[#1A1614]">
                    Offer is Active (visible on homepage carousel and combo offers page)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8DFD4]">
            <button
              type="button"
              onClick={closeModal}
              disabled={formSubmitting}
              className="px-4 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs font-bold text-[#7A6E65] hover:bg-[#FAF5EE] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#BF5330] text-white text-xs font-bold shadow-xs hover:bg-[#A84524] disabled:opacity-60 cursor-pointer"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving Combo Offer...</span>
                </>
              ) : (
                <span>{editingOffer ? "Save Changes" : "Create Combo Offer"}</span>
              )}
            </button>
          </div>
        </form>
      </AdminModal>

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      <AdminModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#4A3B32]">
            Are you sure you want to delete the combo offer{" "}
            <strong className="text-[#1A1614]">&quot;{deleteTarget?.name}&quot;</strong>?
          </p>
          <p className="text-xs text-[#7A6E65]">
            This will remove the offer from the homepage carousel and combo offers storefront page. Any unreferenced uploaded poster images will be cleaned up safely.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8DFD4]">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-[8px] bg-white border border-[#E8DFD4] text-xs font-bold text-[#7A6E65] hover:bg-[#FAF5EE]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#BF5330] text-white text-xs font-bold hover:bg-[#A84524] disabled:opacity-60"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Offer</span>
              )}
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ========================================================================= */}
      {/* IMAGE PREVIEW LIGHTBOX                                                    */}
      {/* ========================================================================= */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-[16px] overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-[#E8DFD4]">
              <span className="text-xs font-bold text-[#1A1614]">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 text-[#7A6E65] hover:text-[#1A1614]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative w-full aspect-[4/3] max-h-[75vh]">
              <Image
                src={previewImage.url}
                alt={previewImage.title}
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
