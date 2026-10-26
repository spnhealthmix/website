"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CategoryOption = {
  id: string;
  name: string;
};

export function ProductForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form fields
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [usage, setUsage] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState<number>(0);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/categories", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.categories && data.categories.length > 0) {
          setCategories(data.categories);
          setCategoryId(data.categories[0].id);
        }
      })
      .catch((err) => console.error("Could not fetch categories:", err))
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: any = {
      categoryId,
      name: name.trim(),
      shortDescription: shortDescription.trim() ? shortDescription.trim() : null,
      description: description.trim() ? description.trim() : null,
      ingredients: ingredients.trim() ? ingredients.trim() : null,
      usage: usage.trim() ? usage.trim() : null,
      isActive,
      isFeatured,
      sortOrder: Number(sortOrder),
    };

    if (slug.trim()) {
      payload.slug = slug.trim();
    }

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(resData?.error?.message || "Failed to create product.");
      }

      // Navigate to product editor where variants and images can be added
      router.push(`/admin/products/${resData.id}?created=true`);
    } catch (err: any) {
      setError(err.message || "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/admin/products" className="hover:text-[var(--color-brand-primary)]">
          Products
        </Link>
        <span>&gt;</span>
        <span className="text-[var(--color-text-primary)] font-medium">Add New Product</span>
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-[var(--color-border-subtle)]">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
          Add New Product
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Create product details. Variants (weights, SKUs, prices) and images are configured in the next step.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
          {error}
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-6 space-y-6 text-xs">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border-subtle)]">
            Primary Details
          </h2>

          <div>
            <label htmlFor="prod-category" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Category *
            </label>
            {loadingCategories ? (
              <div className="h-9 bg-stone-100 animate-pulse rounded border border-[var(--color-border-subtle)]" />
            ) : categories.length === 0 ? (
              <div className="text-rose-600 text-xs">
                No categories found. Please create a category first.
              </div>
            ) : (
              <select
                id="prod-category"
                required
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
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prod-name" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Product Title *
              </label>
              <input
                id="prod-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Traditional Multigrain Health Mix"
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-sm"
              />
            </div>

            <div>
              <label htmlFor="prod-slug" className="block font-medium text-[var(--color-text-primary)] mb-1">
                URL Slug (Optional — auto-generated from title)
              </label>
              <input
                id="prod-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. traditional-health-mix"
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Product Descriptions */}
        <div className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border-subtle)]">
            Product Descriptions &amp; Information
          </h2>

          <div>
            <label htmlFor="prod-short-desc" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Short Summary (Display on Cards)
            </label>
            <input
              id="prod-short-desc"
              type="text"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="One-line summary for shop cards and search listings"
              className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
            />
          </div>

          <div>
            <label htmlFor="prod-desc" className="block font-medium text-[var(--color-text-primary)] mb-1">
              Full Product Description
            </label>
            <textarea
              id="prod-desc"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the product, heritage, and health benefits..."
              className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="prod-ingredients" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Ingredients List
              </label>
              <textarea
                id="prod-ingredients"
                rows={3}
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="e.g. Ragi, Bajra, Jowar, Wheat, Green Gram, Almonds, Cardamom..."
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
              />
            </div>

            <div>
              <label htmlFor="prod-usage" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Usage / Preparation Instructions
              </label>
              <textarea
                id="prod-usage"
                rows={3}
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                placeholder="e.g. Mix 2 tablespoons in 200ml milk or water. Boil for 3-5 minutes stirring continuously..."
                className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 focus:outline-none focus:border-[var(--color-brand-primary)] text-xs"
              />
            </div>
          </div>
        </div>

        {/* Visibility & Sorting */}
        <div className="space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border-subtle)]">
            Storefront Visibility
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label htmlFor="prod-sort" className="block font-medium text-[var(--color-text-primary)] mb-1">
                Display Sort Order
              </label>
              <input
                id="prod-sort"
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
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 ml-5">
                Requires at least 1 active variant to show in shop
              </p>
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
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border-subtle)]">
          <Link
            href="/admin/products"
            className="px-4 py-2 rounded border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-warm)] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || categories.length === 0}
            className="px-5 py-2 rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] font-semibold transition-colors disabled:opacity-50 shadow-xs"
          >
            {submitting ? "Creating Product..." : "Save and Add Variants &rarr;"}
          </button>
        </div>
      </form>
    </div>
  );
}
