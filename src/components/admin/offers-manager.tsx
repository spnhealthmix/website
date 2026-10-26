"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/utils";

type OfferItem = {
  id: string;
  name: string;
  scope: "product" | "category";
  productId: string | null;
  categoryId: string | null;
  discountType: "percentage" | "flat";
  value: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  productName: string | null;
  categoryName: string | null;
};

type OptionItem = { id: string; name: string };

export function OffersManager() {
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Reference data for scope dropdowns
  const [productsList, setProductsList] = useState<OptionItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<OptionItem[]>([]);

  // Modal / Form state
  const [editingOffer, setEditingOffer] = useState<OfferItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form values
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"product" | "category">("product");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [valueDisplay, setValueDisplay] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<OfferItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOffers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/offers", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load offers.");
      }
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch offers.");
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/admin/products", { cache: "no-store" }),
        fetch("/api/admin/categories", { cache: "no-store" }),
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        setProductsList((pData.products || []).map((p: any) => ({ id: p.id, name: p.name })));
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCategoriesList((cData.categories || []).map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch {
      // Non-critical background load
    }
  };

  useEffect(() => {
    fetchOffers();
    fetchReferenceData();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setName("");
    setScope("product");
    setProductId(productsList[0]?.id || "");
    setCategoryId(categoriesList[0]?.id || "");
    setDiscountType("percentage");
    setValueDisplay("10");

    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(nextWeek.toISOString().slice(0, 16));
    setIsActive(true);

    setFormError(null);
    setIsCreating(true);
  };

  const openEditModal = (o: OfferItem) => {
    setEditingOffer(o);
    setName(o.name);
    setScope(o.scope);
    setProductId(o.productId || productsList[0]?.id || "");
    setCategoryId(o.categoryId || categoriesList[0]?.id || "");
    setDiscountType(o.discountType);
    setValueDisplay(o.discountType === "percentage" ? String(o.value) : String(o.value / 100));
    setStartsAt(new Date(o.startsAt).toISOString().slice(0, 16));
    setEndsAt(new Date(o.endsAt).toISOString().slice(0, 16));
    setIsActive(o.isActive);

    setFormError(null);
    setIsCreating(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const numVal = parseFloat(valueDisplay);
      if (isNaN(numVal) || numVal <= 0) {
        throw new Error("Enter a valid discount value greater than 0.");
      }

      const calculatedValue = discountType === "percentage" ? Math.round(numVal) : Math.round(numVal * 100);

      if (discountType === "percentage" && (calculatedValue < 1 || calculatedValue > 100)) {
        throw new Error("Percentage discount must be between 1% and 100%.");
      }

      const sDate = new Date(startsAt);
      const eDate = new Date(endsAt);
      if (eDate <= sDate) {
        throw new Error("End date must be strictly after start date.");
      }

      const payload: any = {
        name: name.trim(),
        scope,
        productId: scope === "product" ? productId : null,
        categoryId: scope === "category" ? categoryId : null,
        discountType,
        value: calculatedValue,
        startsAt: sDate.toISOString(),
        endsAt: eDate.toISOString(),
        isActive,
      };

      const url = editingOffer ? `/api/admin/offers/${editingOffer.id}` : "/api/admin/offers";
      const method = editingOffer ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to save offer.");
      }

      setActionSuccess(editingOffer ? `Offer "${name}" updated.` : `Offer "${name}" created.`);
      setEditingOffer(null);
      setIsCreating(false);
      await fetchOffers();
    } catch (err: any) {
      setFormError(err.message || "An error occurred.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (o: OfferItem) => {
    try {
      const res = await fetch(`/api/admin/offers/${o.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !o.isActive }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to update offer state.");
      }
      setActionSuccess(`Offer "${o.name}" ${o.isActive ? "deactivated" : "activated"}.`);
      await fetchOffers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/offers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to delete offer.");
      }
      setActionSuccess(`Offer "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await fetchOffers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (o: OfferItem) => {
    const now = new Date();
    const s = new Date(o.startsAt);
    const e = new Date(o.endsAt);

    if (!o.isActive) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">Inactive</span>;
    }
    if (now < s) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Upcoming</span>;
    }
    if (now > e) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Expired</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
            Offers & Promotions
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Configure automatic product and category level discounts applied in cart and checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-[var(--color-brand-primary)] text-white text-xs font-semibold hover:bg-[var(--color-brand-secondary)] transition-colors shadow-xs"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New Offer</span>
        </button>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Offers Table */}
      <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--color-text-muted)]">Loading offers...</div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--color-text-muted)]">
            No promotional offers configured. Click &quot;Create New Offer&quot; to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-warm)]/40 text-[var(--color-text-secondary)] font-semibold">
                  <th className="py-3 px-4">Offer Name</th>
                  <th className="py-3 px-4">Scope & Target</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Validity Window</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-[var(--color-surface-warm)]/20 transition-colors">
                    <td className="py-3 px-4 font-semibold">{o.name}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-mono text-[11px] text-[var(--color-brand-secondary)] font-medium">
                        [{o.scope}]
                      </span>{" "}
                      <span>{o.scope === "product" ? o.productName || "Product" : o.categoryName || "Category"}</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">
                      {o.discountType === "percentage" ? `${o.value}% OFF` : `-${formatPrice(o.value)}`}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-[var(--color-text-secondary)]">
                      <div>From: {new Date(o.startsAt).toLocaleDateString()}</div>
                      <div>To: {new Date(o.endsAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(o)}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(o)}
                        className={`text-[11px] font-medium px-2 py-1 rounded border transition-colors ${
                          o.isActive
                            ? "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100"
                            : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        {o.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(o)}
                        className="text-[11px] font-medium px-2 py-1 rounded border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(o)}
                        className="text-[11px] font-medium px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Offer */}
      {(isCreating || editingOffer) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
              <h2 className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
                {editingOffer ? "Edit Offer" : "Create New Offer"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setEditingOffer(null);
                  setIsCreating(false);
                }}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg"
              >
                &times;
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-[var(--color-text-secondary)] mb-1">
                  Offer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Summer Health Mix 10% Off"
                  className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">Scope</label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  >
                    <option value="product">Specific Product</option>
                    <option value="category">Whole Category</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">Target</label>
                  {scope === "product" ? (
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    >
                      {productsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                    >
                      {categoriesList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">
                    {discountType === "percentage" ? "Percentage Value (%)" : "Flat Discount (₹)"}
                  </label>
                  <input
                    type="number"
                    step={discountType === "percentage" ? "1" : "0.01"}
                    required
                    min="1"
                    value={valueDisplay}
                    onChange={(e) => setValueDisplay(e.target.value)}
                    placeholder={discountType === "percentage" ? "e.g. 15" : "e.g. 50"}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[var(--color-text-secondary)] mb-1">End Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full px-3 py-2 rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="offerIsActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)]"
                />
                <label htmlFor="offerIsActive" className="font-medium text-[var(--color-text-primary)]">
                  Offer is Active and Available to Customers
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border-subtle)]">
                <button
                  type="button"
                  onClick={() => {
                    setEditingOffer(null);
                    setIsCreating(false);
                  }}
                  className="px-4 py-2 rounded border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-secondary)] font-medium disabled:opacity-50"
                >
                  {formSubmitting ? "Saving..." : editingOffer ? "Update Offer" : "Create Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg max-w-sm w-full p-5 shadow-xl space-y-4 text-xs">
            <h3 className="font-bold text-sm text-rose-700">Delete Offer?</h3>
            <p className="text-[var(--color-text-secondary)]">
              Are you sure you want to delete offer &quot;{deleteTarget.name}&quot;? Customers will no longer receive this discount.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 rounded border border-stone-200 bg-white text-stone-700 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
