"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { AdminModal } from "@/components/admin/admin-modal";

type CouponItem = {
  id: string;
  code: string;
  discountType: "percentage" | "flat";
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export function CouponsManager() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form values
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [valueDisplay, setValueDisplay] = useState("");
  const [minOrderRupees, setMinOrderRupees] = useState("");
  const [maxDiscountRupees, setMaxDiscountRupees] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/coupons", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load coupons.");
      }
      const data = await res.json();
      setCoupons(data.coupons || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch coupons.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const openCreateModal = () => {
    setEditingCoupon(null);
    setCode("");
    setDiscountType("percentage");
    setValueDisplay("10");
    setMinOrderRupees("0");
    setMaxDiscountRupees("");
    setMaxUses("");

    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 86400000);
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(nextMonth.toISOString().slice(0, 16));
    setIsActive(true);

    setFormError(null);
    setIsCreating(true);
  };

  const openEditModal = (c: CouponItem) => {
    setEditingCoupon(c);
    setCode(c.code);
    setDiscountType(c.discountType);
    setValueDisplay(c.discountType === "percentage" ? String(c.value) : String(c.value / 100));
    setMinOrderRupees(String(c.minOrderPaise / 100));
    setMaxDiscountRupees(c.maxDiscountPaise !== null ? String(c.maxDiscountPaise / 100) : "");
    setMaxUses(c.maxUses !== null ? String(c.maxUses) : "");
    setStartsAt(c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : "");
    setEndsAt(c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : "");
    setIsActive(c.isActive);

    setFormError(null);
    setIsCreating(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode.length < 2) {
        throw new Error("Coupon code must be at least 2 characters.");
      }

      const numVal = parseFloat(valueDisplay);
      if (isNaN(numVal) || numVal <= 0) {
        throw new Error("Enter a valid discount value greater than 0.");
      }

      const calculatedValue = discountType === "percentage" ? Math.round(numVal) : Math.round(numVal * 100);
      if (discountType === "percentage" && (calculatedValue < 1 || calculatedValue > 100)) {
        throw new Error("Percentage discount must be between 1% and 100%.");
      }

      const minOrderVal = minOrderRupees ? Math.round(parseFloat(minOrderRupees) * 100) : 0;
      const maxDiscountVal = maxDiscountRupees ? Math.round(parseFloat(maxDiscountRupees) * 100) : null;
      const maxUsesVal = maxUses ? parseInt(maxUses, 10) : null;

      const sDate = startsAt ? new Date(startsAt) : null;
      const eDate = endsAt ? new Date(endsAt) : null;
      if (sDate && eDate && eDate <= sDate) {
        throw new Error("End date must be strictly after start date.");
      }

      const payload: any = {
        code: normalizedCode,
        discountType,
        value: calculatedValue,
        minOrderPaise: minOrderVal,
        maxDiscountPaise: maxDiscountVal,
        maxUses: maxUsesVal,
        startsAt: sDate ? sDate.toISOString() : null,
        endsAt: eDate ? eDate.toISOString() : null,
        isActive,
      };

      const url = editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : "/api/admin/coupons";
      const method = editingCoupon ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to save coupon.");
      }

      setActionSuccess(editingCoupon ? `Coupon "${normalizedCode}" updated.` : `Coupon "${normalizedCode}" created.`);
      setEditingCoupon(null);
      setIsCreating(false);
      await fetchCoupons();
    } catch (err: any) {
      setFormError(err.message || "An error occurred.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (c: CouponItem) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to update coupon state.");
      }
      setActionSuccess(`Coupon "${c.code}" ${c.isActive ? "deactivated" : "activated"}.`);
      await fetchCoupons();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to delete coupon.");
      }
      if (data.deactivated) {
        setActionSuccess(`Coupon "${deleteTarget.code}" has prior orders and was safely deactivated.`);
      } else {
        setActionSuccess(`Coupon "${deleteTarget.code}" removed.`);
      }
      setDeleteTarget(null);
      await fetchCoupons();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (c: CouponItem) => {
    const now = new Date();
    const s = c.startsAt ? new Date(c.startsAt) : null;
    const e = c.endsAt ? new Date(c.endsAt) : null;

    if (!c.isActive) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-100 text-stone-600 border border-stone-200">Inactive</span>;
    }
    if (c.maxUses !== null && c.usedCount >= c.maxUses) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Usage Limit Met</span>;
    }
    if (s && now < s) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Upcoming</span>;
    }
    if (e && now > e) {
      return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Expired</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold text-[#1A1614]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Coupon Codes
          </h1>
          <p className="text-xs text-[#635850] mt-1">
            Create and manage customer discount vouchers with usage limits, minimum orders, and caps.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Create New Coupon</span>
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

      {/* Coupons Table */}
      <div className="bg-white border border-[#E8DFD4] rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#8C7E72]">Loading coupons...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#8C7E72]">
            No coupon codes configured. Click &quot;Create New Coupon&quot; to issue one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8DFD4] bg-[#FFFBF7] text-[#635850] font-semibold">
                  <th className="py-3.5 px-4">Coupon Code</th>
                  <th className="py-3.5 px-4">Discount</th>
                  <th className="py-3.5 px-4">Min. Order</th>
                  <th className="py-3.5 px-4">Max. Cap</th>
                  <th className="py-3.5 px-4">Usage</th>
                  <th className="py-3.5 px-4">Validity</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD4] text-[#1A1614]">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF5EF]/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#BF5330]">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#1A1614]">
                      {c.discountType === "percentage" ? `${c.value}% OFF` : `-${formatPrice(c.value)}`}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#635850]">
                      {c.minOrderPaise > 0 ? formatPrice(c.minOrderPaise) : "None"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#635850]">
                      {c.maxDiscountPaise ? formatPrice(c.maxDiscountPaise) : "No Cap"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#635850]">
                      {c.usedCount} {c.maxUses !== null ? `/ ${c.maxUses}` : "uses (unlimited)"}
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-[#635850]">
                      {c.endsAt ? (
                        <span>Until {new Date(c.endsAt).toLocaleDateString()}</span>
                      ) : (
                        <span>No Expiry</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(c)}</td>
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                          c.isActive
                            ? "border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100"
                            : "border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        {c.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#E8DFD4] bg-white text-[#635850] hover:bg-[#FAF5EF] hover:text-[#1A1614] transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(c)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
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

      {/* Modal: Create or Edit Coupon */}
      <AdminModal
        isOpen={Boolean(isCreating || editingCoupon)}
        onClose={() => {
          setEditingCoupon(null);
          setIsCreating(false);
          setFormError(null);
        }}
        title={editingCoupon ? "Edit Coupon" : "Create New Coupon"}
        description={
          editingCoupon
            ? "Modify coupon discount type, order thresholds, and expiry limits."
            : "Create a promotional discount code to share with customers."
        }
        maxWidthClass="max-w-[540px]"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label htmlFor="coupon-code" className="block text-xs font-semibold text-[#1A1614] mb-1.5">
                Coupon Code <span className="text-[#BF5330]">*</span>
              </label>
              <input
                id="coupon-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SPN10, WELCOME50"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] font-mono uppercase font-semibold text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="coupon-discount-type" className="block text-xs font-semibold text-[#1A1614] mb-1.5">
                  Discount Type <span className="text-[#BF5330]">*</span>
                </label>
                <select
                  id="coupon-discount-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs cursor-pointer"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat Amount (₹)</option>
                </select>
              </div>

              <div>
                <label htmlFor="coupon-discount-value" className="block text-xs font-semibold text-[#1A1614] mb-1.5">
                  {discountType === "percentage" ? "Percentage Value (%)" : "Flat Discount (₹)"}{" "}
                  <span className="text-[#BF5330]">*</span>
                </label>
                <input
                  id="coupon-discount-value"
                  type="number"
                  step={discountType === "percentage" ? "1" : "0.01"}
                  required
                  min="1"
                  value={valueDisplay}
                  onChange={(e) => setValueDisplay(e.target.value)}
                  placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 100"}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="coupon-min-order" className="text-xs font-semibold text-[#1A1614]">
                    Min. Order (₹)
                  </label>
                  <span className="text-[11px] text-[#8C7E72]">Optional</span>
                </div>
                <input
                  id="coupon-min-order"
                  type="number"
                  min="0"
                  step="1"
                  value={minOrderRupees}
                  onChange={(e) => setMinOrderRupees(e.target.value)}
                  placeholder="0 (No min)"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="coupon-max-cap" className="text-xs font-semibold text-[#1A1614]">
                    Max Cap (₹)
                  </label>
                  <span className="text-[11px] text-[#8C7E72]">Optional</span>
                </div>
                <input
                  id="coupon-max-cap"
                  type="number"
                  min="0"
                  step="1"
                  value={maxDiscountRupees}
                  onChange={(e) => setMaxDiscountRupees(e.target.value)}
                  placeholder="No cap"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="coupon-max-uses" className="text-xs font-semibold text-[#1A1614]">
                    Max Uses
                  </label>
                  <span className="text-[11px] text-[#8C7E72]">Optional</span>
                </div>
                <input
                  id="coupon-max-uses"
                  type="number"
                  min="1"
                  step="1"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="coupon-start-date" className="text-xs font-semibold text-[#1A1614]">
                    Start Date & Time
                  </label>
                  <span className="text-[11px] text-[#8C7E72]">Optional</span>
                </div>
                <input
                  id="coupon-start-date"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="coupon-end-date" className="text-xs font-semibold text-[#1A1614]">
                    End Date & Time
                  </label>
                  <span className="text-[11px] text-[#8C7E72]">Optional</span>
                </div>
                <input
                  id="coupon-end-date"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFFBF7] border border-[#E8DFD4]">
              <input
                type="checkbox"
                id="couponIsActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[#E8DFD4] text-[#BF5330] focus:ring-[#BF5330] cursor-pointer"
              />
              <label htmlFor="couponIsActive" className="text-xs font-semibold text-[#1A1614] cursor-pointer select-none">
                Coupon is Active and Redeemable
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#E8DFD4]">
              <button
                type="button"
                onClick={() => {
                  setEditingCoupon(null);
                  setIsCreating(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-[#E8DFD4] bg-[#FAF5EF] text-[#635850] hover:bg-white hover:text-[#1A1614] font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formSubmitting ? "Saving..." : editingCoupon ? "Update Coupon" : "Create Coupon"}
              </button>
            </div>
          </form>
        </div>
      </AdminModal>

      {/* Modal: Delete Confirmation */}
      <AdminModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Coupon?"
        description="Accounting records preservation notice."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#635850]">
            Are you sure you want to delete coupon <span className="font-mono font-semibold text-[#1A1614]">&quot;{deleteTarget?.code}&quot;</span>? If customers have already used this coupon on historical orders, it will be safely deactivated to preserve accounting records.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-[#E8DFD4]">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl border border-[#E8DFD4] bg-[#FAF5EF] text-[#635850] hover:bg-white hover:text-[#1A1614] font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {deleting ? "Processing..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
