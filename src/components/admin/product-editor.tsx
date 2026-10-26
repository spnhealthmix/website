"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/utils";

type Variant = {
  id: string;
  productId: string;
  sku: string;
  label: string;
  weightGrams: number | null;
  mrpPaise: number;
  pricePaise: number;
  stock: number;
  isActive: boolean;
};

type ProductImage = {
  id: string;
  productId: string;
  key: string;
  url: string | null;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  ingredients: string | null;
  usage: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  variants: Variant[];
  images: ProductImage[];
};

type CategoryOption = {
  id: string;
  name: string;
};

export function ProductEditor({ productId }: { productId: string }) {
  const searchParams = useSearchParams();
  const justCreated = searchParams.get("created") === "true";

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(
    justCreated ? "Product created successfully. Please add variants and images below." : null
  );

  // Tab State: "details" | "variants" | "images"
  const [activeTab, setActiveTab] = useState<"details" | "variants" | "images">("details");

  // Product Edit Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [usage, setUsage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Variant Modal State
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [varSku, setVarSku] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const [varWeightGrams, setVarWeightGrams] = useState<string>("");
  const [varMrpRupees, setVarMrpRupees] = useState<string>("");
  const [varPriceRupees, setVarPriceRupees] = useState<string>("");
  const [varStock, setVarStock] = useState<string>("0");
  const [varStockDelta, setVarStockDelta] = useState<string>("");
  const [useDeltaAdjustment, setUseDeltaAdjustment] = useState(false);
  const [varIsActive, setVarIsActive] = useState(true);
  const [savingVariant, setSavingVariant] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  // Variant Delete Modal
  const [deleteVariantTarget, setDeleteVariantTarget] = useState<Variant | null>(null);
  const [deletingVariant, setDeletingVariant] = useState(false);

  // Image Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageAlt, setImageAlt] = useState("");
  const [imagePrimary, setImagePrimary] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProduct = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load product.");
      }
      const data: ProductDetail = await res.json();
      setProduct(data);

      // Populate edit fields
      setName(data.name);
      setSlug(data.slug);
      setCategoryId(data.category.id);
      setShortDescription(data.shortDescription || "");
      setDescription(data.description || "");
      setIngredients(data.ingredients || "");
      setUsage(data.usage || "");
      setIsActive(data.isActive);
      setIsFeatured(data.isFeatured);
      setSortOrder(data.sortOrder);
    } catch (err: any) {
      setError(err.message || "Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchProduct();
  }, [productId]);

  // Handle Product Details Update
  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDetails(true);
    setDetailsError(null);

    const payload = {
      categoryId,
      name: name.trim(),
      slug: slug.trim() || undefined,
      shortDescription: shortDescription.trim() || null,
      description: description.trim() || null,
      ingredients: ingredients.trim() || null,
      usage: usage.trim() || null,
      isActive,
      isFeatured,
      sortOrder: Number(sortOrder),
    };

    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error?.message || "Failed to update product details.");
      }

      setActionSuccess("Product details updated successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchProduct();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to update product");
    } finally {
      setSavingDetails(false);
    }
  };

  // Open Add Variant
  const openAddVariant = () => {
    setEditingVariant(null);
    setVarSku("");
    setVarLabel("");
    setVarWeightGrams("");
    setVarMrpRupees("");
    setVarPriceRupees("");
    setVarStock("10");
    setVarStockDelta("");
    setUseDeltaAdjustment(false);
    setVarIsActive(true);
    setVariantError(null);
    setVariantModalOpen(true);
  };

  // Open Edit Variant
  const openEditVariant = (v: Variant) => {
    setEditingVariant(v);
    setVarSku(v.sku);
    setVarLabel(v.label);
    setVarWeightGrams(v.weightGrams ? String(v.weightGrams) : "");
    setVarMrpRupees(String(v.mrpPaise / 100));
    setVarPriceRupees(String(v.pricePaise / 100));
    setVarStock(String(v.stock));
    setVarStockDelta("");
    setUseDeltaAdjustment(false);
    setVarIsActive(v.isActive);
    setVariantError(null);
    setVariantModalOpen(true);
  };

  // Save Variant (Create or Update)
  const handleSaveVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVariant(true);
    setVariantError(null);

    const mrpPaise = Math.round(parseFloat(varMrpRupees) * 100);
    const pricePaise = Math.round(parseFloat(varPriceRupees) * 100);

    if (isNaN(mrpPaise) || mrpPaise <= 0) {
      setVariantError("Please enter a valid MRP in rupees.");
      setSavingVariant(false);
      return;
    }

    if (isNaN(pricePaise) || pricePaise <= 0) {
      setVariantError("Please enter a valid selling price in rupees.");
      setSavingVariant(false);
      return;
    }

    if (pricePaise > mrpPaise) {
      setVariantError("Selling price cannot exceed MRP.");
      setSavingVariant(false);
      return;
    }

    try {
      if (editingVariant) {
        // Update variant
        const patchPayload: any = {
          sku: varSku.trim(),
          label: varLabel.trim(),
          weightGrams: varWeightGrams ? parseInt(varWeightGrams, 10) : null,
          mrpPaise,
          pricePaise,
          isActive: varIsActive,
        };

        if (useDeltaAdjustment && varStockDelta.trim() !== "") {
          patchPayload.stockDelta = parseInt(varStockDelta, 10);
        } else {
          patchPayload.stock = parseInt(varStock, 10);
        }

        const res = await fetch(`/api/admin/variants/${editingVariant.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify(patchPayload),
        });

        const resData = await res.json().catch(() => null);
        if (!res.ok) throw new Error(resData?.error?.message || "Failed to update variant.");

        setActionSuccess("Variant updated successfully.");
      } else {
        // Create variant
        const createPayload = {
          sku: varSku.trim(),
          label: varLabel.trim(),
          weightGrams: varWeightGrams ? parseInt(varWeightGrams, 10) : null,
          mrpPaise,
          pricePaise,
          stock: parseInt(varStock, 10) || 0,
          isActive: varIsActive,
        };

        const res = await fetch(`/api/admin/products/${productId}/variants`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify(createPayload),
        });

        const resData = await res.json().catch(() => null);
        if (!res.ok) throw new Error(resData?.error?.message || "Failed to add variant.");

        setActionSuccess("Variant created successfully.");
      }

      setVariantModalOpen(false);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchProduct();
    } catch (err: any) {
      setVariantError(err.message || "Operation failed");
    } finally {
      setSavingVariant(false);
    }
  };

  // Delete Variant
  const handleDeleteVariant = async () => {
    if (!deleteVariantTarget) return;
    setDeletingVariant(true);
    try {
      const res = await fetch(`/api/admin/variants/${deleteVariantTarget.id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resData?.error?.message || "Could not delete variant.");

      setActionSuccess(`Variant ${deleteVariantTarget.label} (${deleteVariantTarget.sku}) deleted.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteVariantTarget(null);
      await fetchProduct();
    } catch (err: any) {
      alert(err.message || "Failed to delete variant");
    } finally {
      setDeletingVariant(false);
    }
  };

  // Image Upload
  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      setImageError("Please select an image file to upload.");
      return;
    }

    const file = fileInputRef.current.files[0];
    if (file.size > 5 * 1024 * 1024) {
      setImageError("File size exceeds 5MB limit.");
      return;
    }

    setUploadingImage(true);
    setImageError(null);

    const formData = new FormData();
    formData.append("file", file);
    if (imageAlt.trim()) formData.append("alt", imageAlt.trim());
    if (imagePrimary || (product?.images.length === 0)) formData.append("primary", "true");

    try {
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: {
          Origin: window.location.origin,
        },
        body: formData,
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resData?.error?.message || "Failed to upload image.");

      setActionSuccess("Image uploaded to storage successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      setImageAlt("");
      setImagePrimary(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchProduct();
    } catch (err: any) {
      setImageError(err.message || "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  };

  // Set Primary Image
  const handleSetPrimaryImage = async (img: ProductImage) => {
    try {
      const res = await fetch(`/api/admin/images/${img.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to set primary image.");
      }
      await fetchProduct();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Image
  const handleDeleteImage = async (img: ProductImage) => {
    if (!confirm("Are you sure you want to delete this image?")) return;
    try {
      const res = await fetch(`/api/admin/images/${img.id}`, {
        method: "DELETE",
        headers: {
          Origin: window.location.origin,
        },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to delete image.");
      }
      setActionSuccess("Image deleted.");
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchProduct();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-stone-200 animate-pulse rounded" />
        <div className="h-8 w-64 bg-stone-200 animate-pulse rounded" />
        <div className="h-96 bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-6 rounded-lg border border-rose-200 bg-rose-50 text-rose-800">
        <h2 className="text-sm font-semibold mb-1">Could not load product</h2>
        <p className="text-xs mb-3">{error || "Product not found."}</p>
        <Link
          href="/admin/products"
          className="inline-block px-3 py-1.5 text-xs font-semibold rounded bg-rose-700 text-white hover:bg-rose-800"
        >
          Back to Products List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/admin/products" className="hover:text-[var(--color-brand-primary)]">
          Products
        </Link>
        <span>&gt;</span>
        <span className="text-[var(--color-text-primary)] font-medium truncate max-w-xs">{product.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[var(--color-border-subtle)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              {product.name}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                product.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-stone-100 text-stone-600 border border-stone-200"
              }`}
            >
              {product.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 font-mono">
            /{product.slug} &bull; Category: {product.category.name}
          </p>
        </div>

        <Link
          href={`/products/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3 py-1.5 text-xs font-medium rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-warm)] transition-colors shadow-2xs"
        >
          <span>Preview on Storefront</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
      </div>

      {/* Global Action Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {/* Warning if no variants exist yet */}
      {product.variants.length === 0 && (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="font-bold">Storefront Visibility Notice:</span> This product currently has 0 variants. According to catalogue visibility rules, a product will NOT be displayed to customers on the storefront until it has at least one active variant with price and stock configured. Switch to the <strong>Variants &amp; Pricing</strong> tab below to add one.
          </div>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex border-b border-[var(--color-border-subtle)] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Product Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("variants")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "variants"
              ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <span>Variants &amp; Pricing</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-surface-warm)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
            {product.variants.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("images")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "images"
              ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <span>Images &amp; Media</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--color-surface-warm)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
            {product.images.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PRODUCT DETAILS FORM */}
      {activeTab === "details" && (
        <form onSubmit={handleSaveDetails} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-6 space-y-6 text-xs shadow-2xs">
          {detailsError && (
            <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {detailsError}
            </div>
          )}

          <div>
            <label htmlFor="p-cat" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Category *
            </label>
            <select
              id="p-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="p-name" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Product Title *
              </label>
              <input
                id="p-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-sm"
              />
            </div>

            <div>
              <label htmlFor="p-slug" className="block font-medium text-[var(--color-text-primary)] mb-1">
                URL Slug
              </label>
              <input
                id="p-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label htmlFor="p-short" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Short Summary
            </label>
            <input
              id="p-short"
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
            />
          </div>

          <div>
            <label htmlFor="p-desc" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Full Description
            </label>
            <textarea
              id="p-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="p-ing" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Ingredients List
              </label>
              <textarea
                id="p-ing"
                rows={3}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
              />
            </div>

            <div>
              <label htmlFor="p-usage" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Usage Instructions
              </label>
              <textarea
                id="p-usage"
                rows={3}
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label htmlFor="p-sort" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Sort Order
              </label>
              <input
                id="p-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
              />
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
                />
                <span className="font-medium text-[var(--color-text-primary)]">
                  Active in Catalogue
                </span>
              </label>
            </div>

            <div className="pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
                />
                <span className="font-medium text-[var(--color-text-primary)]">
                  Featured on Homepage
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--color-border-subtle)]">
            <button
              type="submit"
              disabled={savingDetails}
              className="px-5 py-2 rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] font-semibold transition-colors disabled:opacity-50"
            >
              {savingDetails ? "Saving Changes..." : "Save Product Details"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: VARIANTS & PRICING */}
      {activeTab === "variants" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
                Product Variants &amp; Stock
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Weights, SKUs, MRP and selling price in integer paise, and live inventory counts
              </p>
            </div>
            <button
              type="button"
              onClick={openAddVariant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] transition-colors shadow-2xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Variant</span>
            </button>
          </div>

          {product.variants.length === 0 ? (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-8 text-center">
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                No variants found for this product. Products cannot be purchased without variants.
              </p>
              <button
                type="button"
                onClick={openAddVariant}
                className="px-4 py-2 text-xs font-semibold rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)]"
              >
                Add First Variant (e.g. 500 g)
              </button>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--color-surface-warm)]/60 border-b border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-medium">
                      <th className="py-3 px-4">Variant Label / Weight</th>
                      <th className="py-3 px-4">SKU</th>
                      <th className="py-3 px-4">MRP</th>
                      <th className="py-3 px-4">Selling Price</th>
                      <th className="py-3 px-4">Discount</th>
                      <th className="py-3 px-4 text-center">Stock</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {product.variants.map((v) => {
                      const discount = v.mrpPaise > v.pricePaise
                        ? Math.round(((v.mrpPaise - v.pricePaise) / v.mrpPaise) * 100)
                        : 0;

                      return (
                        <tr key={v.id} className="hover:bg-[var(--color-surface-warm)]/30 transition-colors">
                          <td className="py-3 px-4 font-semibold text-[var(--color-text-primary)]">
                            {v.label}
                            {v.weightGrams ? (
                              <span className="block text-[11px] font-normal text-[var(--color-text-muted)]">
                                {v.weightGrams} g
                              </span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 font-mono text-[var(--color-text-secondary)]">
                            {v.sku}
                          </td>
                          <td className="py-3 px-4 text-[var(--color-text-muted)] line-through">
                            {formatPrice(v.mrpPaise)}
                          </td>
                          <td className="py-3 px-4 font-bold text-[var(--color-text-primary)]">
                            {formatPrice(v.pricePaise)}
                          </td>
                          <td className="py-3 px-4">
                            {discount > 0 ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {discount}% OFF
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-muted)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                                v.stock === 0
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : v.stock <= 5
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {v.stock}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                                v.isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-stone-100 text-stone-600 border-stone-200"
                              }`}
                            >
                              {v.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openEditVariant(v)}
                              className="px-2.5 py-1 rounded text-xs font-medium text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-warm)] transition-colors"
                            >
                              Edit / Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteVariantTarget(v)}
                              className="px-2.5 py-1 rounded text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: IMAGES & MEDIA */}
      {activeTab === "images" && (
        <div className="space-y-6">
          {/* Upload Card */}
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-5">
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] mb-1">
              Upload Product Image
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Stored securely in Cloudflare R2. Max 5MB per image. Formats: JPEG, PNG, WebP, GIF.
            </p>

            {imageError && (
              <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {imageError}
              </div>
            )}

            <form onSubmit={handleUploadImage} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block font-medium text-[var(--color-text-primary)] mb-1">
                    Select File *
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[var(--color-surface-warm)] file:text-[var(--color-brand-primary)] hover:file:bg-[var(--color-border-subtle)]"
                  />
                </div>

                <div>
                  <label htmlFor="img-alt" className="block font-medium text-[var(--color-text-primary)] mb-1">
                    Alt Text (Accessibility)
                  </label>
                  <input
                    id="img-alt"
                    type="text"
                    value={imageAlt}
                    onChange={(e) => setImageAlt(e.target.value)}
                    placeholder="e.g. Front view of 500g package"
                    className="w-full px-3 py-1.5 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)]"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={imagePrimary}
                      onChange={(e) => setImagePrimary(e.target.checked)}
                      className="rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                    />
                    <span className="font-medium text-[var(--color-text-primary)]">
                      Primary
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={uploadingImage}
                    className="ml-auto px-4 py-1.5 rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] font-semibold transition-colors disabled:opacity-50"
                  >
                    {uploadingImage ? "Uploading..." : "Upload Image"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Image Gallery Grid */}
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] mb-3">
              Gallery Images ({product.images.length})
            </h3>

            {product.images.length === 0 ? (
              <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-8 text-center text-xs text-[var(--color-text-muted)]">
                No images uploaded yet. Upload images above to show product photography on the storefront.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {product.images.map((img) => (
                  <div
                    key={img.id}
                    className={`relative rounded-lg border bg-[var(--color-surface-elevated)] overflow-hidden flex flex-col ${
                      img.isPrimary ? "border-[var(--color-brand-primary)] ring-1 ring-[var(--color-brand-primary)]" : "border-[var(--color-border-subtle)]"
                    }`}
                  >
                    {/* Primary Badge */}
                    {img.isPrimary && (
                      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-brand-primary)] text-white shadow-xs">
                        Primary
                      </span>
                    )}

                    <div className="aspect-square bg-[var(--color-surface-warm)] flex items-center justify-center overflow-hidden">
                      {img.url ? (
                        <img src={img.url} alt={img.alt || product.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)] p-2 break-all text-center">
                          {img.key}
                        </span>
                      )}
                    </div>

                    <div className="p-3 bg-[var(--color-surface-elevated)] border-t border-[var(--color-border-subtle)] space-y-2 mt-auto">
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate" title={img.alt || "No alt text"}>
                        {img.alt || "(No alt text)"}
                      </p>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        {!img.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(img)}
                            className="text-[11px] font-semibold text-[var(--color-brand-primary)] hover:underline"
                          >
                            Set Primary
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(img)}
                          className="ml-auto text-[11px] font-medium text-rose-600 hover:text-rose-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Variant Modal */}
      {variantModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg max-w-md w-full p-6 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)] mb-4">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
                {editingVariant ? `Edit Variant: ${editingVariant.label}` : "Add Product Variant"}
              </h2>
              <button
                type="button"
                onClick={() => setVariantModalOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {variantError && (
              <div className="mb-4 p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {variantError}
              </div>
            )}

            <form onSubmit={handleSaveVariant} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="v-sku" className="block font-medium text-[var(--color-text-primary)] mb-1">
                    SKU Code *
                  </label>
                  <input
                    id="v-sku"
                    type="text"
                    required
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value.toUpperCase())}
                    placeholder="e.g. SPN-HM-500"
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] font-mono text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="v-label" className="block font-medium text-[var(--color-text-primary)] mb-1">
                    Label / Weight *
                  </label>
                  <input
                    id="v-label"
                    type="text"
                    required
                    value={varLabel}
                    onChange={(e) => setVarLabel(e.target.value)}
                    placeholder="e.g. 500 g or 1 kg"
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="v-grams" className="block font-medium text-[var(--color-text-primary)] mb-1">
                  Weight in Grams (Optional)
                </label>
                <input
                  id="v-grams"
                  type="number"
                  value={varWeightGrams}
                  onChange={(e) => setVarWeightGrams(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--color-surface-warm)]/40 rounded border border-[var(--color-border-subtle)]">
                <div>
                  <label htmlFor="v-mrp" className="block font-medium text-[var(--color-text-primary)] mb-1">
                    MRP (₹) *
                  </label>
                  <input
                    id="v-mrp"
                    type="number"
                    step="0.01"
                    required
                    value={varMrpRupees}
                    onChange={(e) => setVarMrpRupees(e.target.value)}
                    placeholder="e.g. 350.00"
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] focus:outline-none focus:border-[var(--color-brand-primary)] font-bold text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="v-price" className="block font-medium text-[var(--color-text-primary)] mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    id="v-price"
                    type="number"
                    step="0.01"
                    required
                    value={varPriceRupees}
                    onChange={(e) => setVarPriceRupees(e.target.value)}
                    placeholder="e.g. 299.00"
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] focus:outline-none focus:border-[var(--color-brand-primary)] font-bold text-sm text-[var(--color-brand-primary)]"
                  />
                </div>
              </div>

              {/* Stock Management Section */}
              <div className="p-3 bg-[var(--color-surface-warm)]/40 rounded border border-[var(--color-border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    Inventory Stock
                  </span>
                  {editingVariant && (
                    <button
                      type="button"
                      onClick={() => setUseDeltaAdjustment(!useDeltaAdjustment)}
                      className="text-[11px] text-[var(--color-brand-primary)] underline"
                    >
                      {useDeltaAdjustment ? "Set exact count" : "Add/Remove delta"}
                    </button>
                  )}
                </div>

                {editingVariant && useDeltaAdjustment ? (
                  <div>
                    <label htmlFor="v-stock-delta" className="block text-[11px] text-[var(--color-text-muted)] mb-1">
                      Current: {editingVariant.stock} units. Enter stock adjustment (+/-):
                    </label>
                    <input
                      id="v-stock-delta"
                      type="number"
                      value={varStockDelta}
                      onChange={(e) => setVarStockDelta(e.target.value)}
                      placeholder="e.g. +10 to add, -5 to reduce"
                      className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] focus:outline-none focus:border-[var(--color-brand-primary)] font-mono text-xs"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="v-stock" className="block text-[11px] text-[var(--color-text-muted)] mb-1">
                      Available Stock Count
                    </label>
                    <input
                      id="v-stock"
                      type="number"
                      min="0"
                      value={varStock}
                      onChange={(e) => setVarStock(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] focus:outline-none focus:border-[var(--color-brand-primary)] font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={varIsActive}
                    onChange={(e) => setVarIsActive(e.target.checked)}
                    className="rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
                  />
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Variant is Active &amp; Purchasable
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => setVariantModalOpen(false)}
                  disabled={savingVariant}
                  className="px-3 py-2 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-warm)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVariant}
                  className="px-4 py-2 rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] font-semibold disabled:opacity-50"
                >
                  {savingVariant ? "Saving..." : editingVariant ? "Update Variant" : "Add Variant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Variant Modal */}
      {deleteVariantTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg max-w-sm w-full p-6 shadow-lg">
            <h3 className="font-[family-name:var(--font-heading)] text-base font-bold text-rose-800 mb-2">
              Delete Variant
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              Are you sure you want to delete <span className="font-semibold text-[var(--color-text-primary)]">"{deleteVariantTarget.label} ({deleteVariantTarget.sku})"</span>?
              <span className="block mt-2 font-medium text-stone-600">
                Note: If this variant has ever been ordered before, the database will refuse deletion to protect order accounting records. Deactivate it instead.
              </span>
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteVariantTarget(null)}
                disabled={deletingVariant}
                className="px-3 py-1.5 rounded border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-warm)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVariant}
                disabled={deletingVariant}
                className="px-3 py-1.5 rounded bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingVariant ? "Deleting..." : "Delete Variant"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
