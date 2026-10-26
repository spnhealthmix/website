"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  Check,
  MapPin,
  AlertCircle,
  X,
  Home,
  Phone,
  Loader2,
} from "lucide-react";
import { INDIAN_STATES } from "@/lib/customers/validation";
import { useToast } from "@/components/ui/toast";

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export function AccountAddresses() {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form inputs
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Tamil Nadu");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/addresses", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses ?? []);
      }
    } catch (err) {
      console.error("Failed to load addresses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFullName("");
    setPhone("");
    setLine1("");
    setLine2("");
    setLandmark("");
    setCity("");
    setState("Tamil Nadu");
    setPincode("");
    setIsDefault(addresses.length === 0);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setFullName(addr.fullName);
    setPhone(addr.phone);
    setLine1(addr.line1);
    setLine2(addr.line2 ?? "");
    setLandmark(addr.landmark ?? "");
    setCity(addr.city);
    setState(addr.state);
    setPincode(addr.pincode);
    setIsDefault(addr.isDefault);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (fullName.trim().length < 2) {
      setFormError("Please enter full name (at least 2 characters).");
      return;
    }
    const cleanPhone = phone.replace(/[\s\-().]/g, "");
    if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      setFormError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (line1.trim().length < 5) {
      setFormError("Please enter complete street address (at least 5 characters).");
      return;
    }
    if (city.trim().length < 2) {
      setFormError("Please enter a valid city name.");
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pincode.trim())) {
      setFormError("Please enter a valid 6-digit Indian PIN code.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        fullName: fullName.trim(),
        phone: cleanPhone,
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        state,
        pincode: pincode.trim(),
        isDefault,
      };

      const url = editingAddress
        ? `/api/me/addresses/${editingAddress.id}`
        : "/api/me/addresses";
      const method = editingAddress ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || "Failed to save address.");
        showToast("Could not save address.", "error");
        return;
      }

      await fetchAddresses();
      setFormOpen(false);
      showToast(
        editingAddress ? "Address updated successfully." : "Address added successfully.",
        "success"
      );
    } catch (err) {
      console.error("Save address error:", err);
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    try {
      const res = await fetch(`/api/me/addresses/${addrId}/default`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchAddresses();
        showToast("Default address updated.", "success");
      } else {
        showToast("Could not set as default address.", "error");
      }
    } catch (err) {
      console.error("Set default error:", err);
      showToast("Network error.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/me/addresses/${deletingId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAddresses();
        showToast("Address deleted.", "success");
        setDeletingId(null);
      } else {
        const data = await res.json();
        showToast(data.message || "Could not delete address.", "error");
      }
    } catch (err) {
      console.error("Delete address error:", err);
      showToast("Network error while deleting address.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading skeleton matching the reference design
  if (loading && addresses.length === 0) {
    return (
      <div className="space-y-3 sm:space-y-4 font-[family-name:var(--font-body)]">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-[#E8DFD4] bg-white animate-pulse"
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#FAF6F1] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 sm:w-36 bg-[#FAF6F1] rounded" />
                  <div className="h-4 w-14 sm:w-18 bg-[#FAF6F1] rounded-full" />
                </div>
                <div className="h-3 w-48 sm:w-56 bg-[#FAF6F1] rounded" />
                <div className="h-3 w-40 sm:w-48 bg-[#FAF6F1] rounded" />
                <div className="h-3 w-28 sm:w-32 bg-[#FAF6F1] rounded" />
              </div>
            </div>
            <div className="border-t border-[#E8DFD4]/70 mt-3 pt-2.5 flex justify-between items-center">
              <div className="h-3 w-24 bg-[#FAF6F1] rounded" />
              <div className="h-7 w-24 bg-[#FAF6F1] rounded" />
            </div>
          </div>
        ))}

        {/* Bottom Button Skeleton */}
        <div className="mt-5 sm:mt-7 flex justify-center">
          <div className="h-11 w-full sm:w-44 bg-[#FAF6F1] rounded-xl sm:rounded-[10px] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="font-[family-name:var(--font-body)]">
      {/* Address List or Empty State */}
      {addresses.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-[#E8DFD4] bg-[#FAF6F1]/50 text-center max-w-md mx-auto my-4">
          <div className="w-12 h-12 rounded-full bg-[#FDF3EE] border border-[#BF5330]/20 flex items-center justify-center mx-auto mb-3.5">
            <MapPin className="h-6 w-6 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h3 className="font-heading font-normal text-xl sm:text-[22px] text-[#1A1614] mb-1.5">
            No Saved Delivery Addresses
          </h3>
          <p className="text-xs sm:text-[13px] text-[#786B62] mb-6 leading-relaxed">
            You have not saved any delivery addresses yet. Add one to enable fast, seamless checkout.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs sm:text-[13px] font-medium transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Address</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="space-y-3 sm:space-y-5">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="p-3.5 sm:p-6 rounded-xl sm:rounded-2xl border border-[#E8DFD4] bg-white hover:border-[#D6C7BA] transition-all shadow-2xs"
              >
                  {/* Main Card Top Section: Icon + Details */}
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Home Icon Badge */}
                    <div
                      className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-[#FDF3EE] border border-[#BF5330]/15 flex items-center justify-center shrink-0 text-[#BF5330] mt-0.5"
                      aria-hidden="true"
                    >
                      <Home className="h-4 w-4 sm:h-5.5 sm:w-5.5" strokeWidth={1.75} />
                    </div>

                    {/* Address Content */}
                    <div className="flex-1 min-w-0">
                      {/* Recipient Name and Default Badge */}
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <h3 className="font-body font-[family-name:var(--font-manrope)] font-semibold sm:font-normal text-[15px] sm:text-[16.5px] text-[#1A1614] tracking-tight break-words flex-1 min-w-0 leading-snug">
                          {addr.fullName}
                        </h3>
                        {addr.isDefault && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium bg-[#FDF3EE] text-[#BF5330] border border-[#BF5330]/25 shrink-0">
                            <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" />
                            <span>Default</span>
                          </span>
                        )}
                      </div>

                      {/* Address Lines: One by one line on mobile view, compact on desktop */}
                      <div className="mt-1 sm:mt-1.5 space-y-0.5 text-xs sm:text-[13.5px] text-[#635850] leading-relaxed">
                        {/* Desktop view: line1 and line2 together */}
                        <p className="break-words hidden sm:block">
                          {addr.line1}
                          {addr.line2 ? `, ${addr.line2}` : ""}
                        </p>

                        {/* Mobile view: line1 and line2 one by one line */}
                        <p className="break-words block sm:hidden">{addr.line1}</p>
                        {addr.line2 && (
                          <p className="break-words block sm:hidden">{addr.line2}</p>
                        )}

                        {/* Landmark (if present) */}
                        {addr.landmark && (
                          <p className="text-[#8C7E74] break-words">
                            Landmark: {addr.landmark}
                          </p>
                        )}

                        {/* Desktop view: city, state - pincode together */}
                        <p className="break-words hidden sm:block">
                          {addr.city}, {addr.state} – {addr.pincode}
                        </p>

                        {/* Mobile view: city and state - pincode one by one line */}
                        <p className="break-words block sm:hidden">{addr.city}</p>
                        <p className="break-words block sm:hidden">
                          {addr.state} – {addr.pincode}
                        </p>

                        {/* Phone number */}
                        <div className="flex items-center gap-1.5 text-xs sm:text-[13px] text-[#635850] pt-0.5 sm:pt-1">
                          <Phone className="h-3.5 w-3.5 text-[#8C7E74] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          <span>+91 {addr.phone}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subtle Divider */}
                  <div className="border-t border-[#E8DFD4]/70 mt-3.5 sm:mt-5 pt-2.5 sm:pt-3.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 pr-1">
                      {!addr.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.id)}
                          className="h-8 sm:h-auto inline-flex items-center text-xs font-medium text-[#786B62] hover:text-[#BF5330] transition-colors cursor-pointer focus-visible:outline-none underline-offset-2 hover:underline"
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span className="text-[11px] sm:text-xs text-[#8C7E74] leading-tight block">
                          Primary address
                        </span>
                      )}
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1.5 sm:gap-4 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => openEditModal(addr)}
                        className="h-8 px-2.5 sm:h-auto sm:px-1.5 sm:py-1 rounded-md border border-[#E8DFD4] sm:border-transparent inline-flex items-center gap-1 text-xs sm:text-[13px] font-medium text-[#4A3B32] hover:text-[#BF5330] hover:border-[#BF5330]/40 hover:bg-[#FAF6F1] transition-all cursor-pointer"
                        aria-label={`Edit address for ${addr.fullName}`}
                      >
                        <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#786B62]" strokeWidth={1.75} aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(addr.id)}
                        className="h-8 px-2.5 sm:h-auto sm:px-1.5 sm:py-1 rounded-md border border-transparent inline-flex items-center gap-1 text-xs sm:text-[13px] font-medium text-[#991B1B] hover:text-[#7F1D1D] hover:bg-[#FEE2E2]/60 transition-all cursor-pointer"
                        aria-label={`Delete address for ${addr.fullName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#991B1B]" strokeWidth={1.75} aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Address Button at the bottom of saved address cards */}
            <div className="mt-5 sm:mt-7 flex justify-center">
              <button
                type="button"
                onClick={openAddModal}
                className="w-full sm:w-auto h-11 sm:h-auto px-5 py-2.5 rounded-xl sm:rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-[13.5px] font-semibold sm:font-medium inline-flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add New Address</span>
              </button>
            </div>
          </div>
        )}

      {/* Add / Edit Address Modal */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1614]/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E8DFD4] shadow-xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E8DFD4] pb-4 mb-5">
              <h3 className="font-heading font-normal text-xl sm:text-2xl text-[#1A1614]">
                {editingAddress ? "Edit Delivery Address" : "Add New Delivery Address"}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 rounded-lg text-[#786B62] hover:text-[#1A1614] hover:bg-[#FAF6F1] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-lg bg-[#FEE2E2]/60 border border-[#EF4444]/20 text-xs sm:text-[13px] text-[#991B1B] flex items-center gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-[13px] font-[family-name:var(--font-body)]">
              <div>
                <label htmlFor="modal-name" className="block font-medium text-[#4A3B32] mb-1.5">
                  Recipient Full Name *
                </label>
                <input
                  id="modal-name"
                  type="text"
                  required
                  placeholder="e.g. Ramachandran R"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="modal-phone" className="block font-medium text-[#4A3B32] mb-1.5">
                  10-Digit Mobile Number *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-[#786B62] font-medium select-none">
                    +91
                  </span>
                  <input
                    id="modal-phone"
                    type="tel"
                    required
                    placeholder="8925578337"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 pl-11 pr-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-line1" className="block font-medium text-[#4A3B32] mb-1.5">
                  House / Flat No., Street, Area *
                </label>
                <input
                  id="modal-line1"
                  type="text"
                  required
                  placeholder="e.g. F2, C Block, Arunachala Flats"
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="modal-line2" className="block font-medium text-[#4A3B32] mb-1.5">
                  Apartment / Suite / Floor (Optional)
                </label>
                <input
                  id="modal-line2"
                  type="text"
                  placeholder="e.g. 2nd Main Road, Extn"
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="modal-landmark" className="block font-medium text-[#4A3B32] mb-1.5">
                  Landmark (Optional)
                </label>
                <input
                  id="modal-landmark"
                  type="text"
                  placeholder="e.g. Near Arunachala Temple"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label htmlFor="modal-city" className="block font-medium text-[#4A3B32] mb-1.5">
                    City *
                  </label>
                  <input
                    id="modal-city"
                    type="text"
                    required
                    placeholder="e.g. Chennai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="modal-pincode" className="block font-medium text-[#4A3B32] mb-1.5">
                    PIN Code (6 digits) *
                  </label>
                  <input
                    id="modal-pincode"
                    type="text"
                    required
                    placeholder="600122"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="modal-state" className="block font-medium text-[#4A3B32] mb-1.5">
                  State / Union Territory *
                </label>
                <select
                  id="modal-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E8DFD4] text-[#BF5330] focus:ring-[#BF5330] accent-[#BF5330]"
                  />
                  <span className="text-xs sm:text-[13px] text-[#4A3B32]">
                    Make this my default delivery address
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8DFD4]">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4.5 py-2.5 rounded-lg border border-[#E8DFD4] text-xs sm:text-[13px] font-medium text-[#4A3B32] hover:bg-[#FAF6F1] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs sm:text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{saving ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingId && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1614]/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#E8DFD4] shadow-xl p-6 sm:p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-[#FEE2E2] border border-[#EF4444]/20 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="h-6 w-6 text-[#BF5330]" aria-hidden="true" />
            </div>
            <h3 className="font-heading font-normal text-xl text-[#1A1614] mb-2">
              Delete Address?
            </h3>
            <p className="text-xs sm:text-[13px] text-[#786B62] mb-6 leading-relaxed">
              Are you sure you want to remove this delivery address? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingId(null)}
                className="px-4.5 py-2 rounded-lg border border-[#E8DFD4] text-xs sm:text-[13px] font-medium text-[#4A3B32] hover:bg-[#FAF6F1] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="px-5 py-2 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs sm:text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
