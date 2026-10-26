"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Plus, Check, MapPin, AlertCircle } from "lucide-react";
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

interface AddressSelectorProps {
  selectedAddressId: string | null;
  onSelectAddress: (addressId: string) => void;
}

export function AddressSelector({
  selectedAddressId,
  onSelectAddress,
}: AddressSelectorProps) {
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New address form state
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
      const res = await fetch("/api/me/addresses", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        const list: Address[] = data.addresses ?? [];
        setAddresses(list);

        // Auto-select default or first address if none selected
        if (!selectedAddressId && list.length > 0) {
          const def = list.find((a) => a.isDefault) ?? list[0];
          onSelectAddress(def.id);
        }
      }
    } catch (err) {
      console.error("Failed to load addresses:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAddressId, onSelectAddress]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (fullName.trim().length < 2) {
      setFormError("Please enter your full name (at least 2 characters).");
      return;
    }
    const cleanPhone = phone.replace(/[\s\-().]/g, "");
    if (!/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      setFormError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (line1.trim().length < 5) {
      setFormError("Please enter a complete street address (at least 5 characters).");
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
      const res = await fetch("/api/me/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: cleanPhone,
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          landmark: landmark.trim() || undefined,
          city: city.trim(),
          state,
          pincode: pincode.trim(),
          isDefault: isDefault || addresses.length === 0,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error?.message || "Could not save address. Please verify your details.");
        return;
      }

      const created: Address = await res.json();
      showToast("Delivery address saved", "success");
      setShowAddForm(false);
      // Reset form
      setFullName("");
      setPhone("");
      setLine1("");
      setLine2("");
      setLandmark("");
      setCity("");
      setPincode("");
      setIsDefault(false);

      await fetchAddresses();
      onSelectAddress(created.id);
    } catch (err) {
      console.error("Save address error:", err);
      setFormError("Failed to save address. Please check your connection.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-6 flex items-center gap-3 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-body)]">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--color-brand-primary)] border-t-transparent" />
        Loading delivery addresses...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing addresses list */}
      {addresses.length > 0 && !showAddForm && (
        <div className="space-y-3" role="radiogroup" aria-label="Select Delivery Address">
          {addresses.map((addr) => {
            const isSelected = selectedAddressId === addr.id;
            return (
              <div
                key={addr.id}
                onClick={() => onSelectAddress(addr.id)}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onSelectAddress(addr.id);
                  }
                }}
                className={[
                  "p-4 rounded-[8px] border transition-all cursor-pointer relative focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]",
                  isSelected
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-light)]/20 shadow-xs"
                    : "border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)]",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        "mt-1 w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                          : "border-[var(--color-border-strong)] bg-white",
                      ].join(" ")}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                    <div className="font-[family-name:var(--font-body)] text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {addr.fullName}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--color-text-body)] leading-relaxed">
                        {addr.line1}
                        {addr.line2 && `, ${addr.line2}`}
                        {addr.landmark && ` (Near ${addr.landmark})`}
                      </p>
                      <p className="text-[var(--color-text-body)]">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                        Phone: +91 {addr.phone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Button to show form */}
      {!showAddForm && (
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setFormError(null);
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold font-[family-name:var(--font-body)] text-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary-dark)] transition-colors py-2"
        >
          <Plus className="h-4 w-4" />
          Add New Delivery Address
        </button>
      )}

      {/* Add New Address Form */}
      {(showAddForm || addresses.length === 0) && (
        <form
          onSubmit={handleSaveAddress}
          className="p-4 sm:p-5 rounded-[8px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border-subtle)]">
            <h3 className="font-heading text-lg text-[var(--color-text-primary)] font-normal flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[var(--color-brand-primary)]" />
              New Delivery Address
            </h3>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="font-body text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            )}
          </div>

          {formError && (
            <div
              role="alert"
              aria-live="assertive"
              className="p-3 rounded-[6px] bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-center gap-2 text-xs text-[var(--color-error)]"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{formError}</p>
            </div>
          )}

          {/* 1. Full Name & 2. 10-Digit Mobile Number */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="addr-fullName"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                Full Name *
              </label>
              <input
                id="addr-fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)] focus-visible:ring-1 focus-visible:ring-[var(--color-brand-primary)]"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="addr-phone"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                10-Digit Mobile Number *
              </label>
              <div className="flex items-center w-full">
                <span className="shrink-0 h-10 px-2.5 flex items-center bg-[var(--color-surface-sunken)] border border-r-0 border-[var(--color-border)] rounded-l-[6px] text-xs text-[var(--color-text-muted)] font-mono">
                  +91
                </span>
                <input
                  id="addr-phone"
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="9876543210"
                  className="w-full min-w-0 flex-1 h-10 px-3 rounded-r-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
                />
              </div>
            </div>
          </div>

          {/* 3. Flat, House No., Building, Street */}
          <div className="min-w-0">
            <label
              htmlFor="addr-line1"
              className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
            >
              Flat, House no., Building, Street *
            </label>
            <input
              id="addr-line1"
              type="text"
              required
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="e.g. 14A, Krishna Nagar, 2nd Main Road"
              className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
            />
          </div>

          {/* 4. Area, Colony (Optional) & 5. Landmark (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="addr-line2"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                Area, Colony (Optional)
              </label>
              <input
                id="addr-line2"
                type="text"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="e.g. Near Bus Stand"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="addr-landmark"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                Landmark (Optional)
              </label>
              <input
                id="addr-landmark"
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Post Office"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
              />
            </div>
          </div>

          {/* 6. City / Town, 7. State / UT, 8. 6-Digit PIN Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="min-w-0">
              <label
                htmlFor="addr-city"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                City / Town *
              </label>
              <input
                id="addr-city"
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Chennai"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
              />
            </div>

            <div className="min-w-0">
              <label
                htmlFor="addr-state"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                State / UT *
              </label>
              <select
                id="addr-state"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)]"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="addr-pincode"
                className="block font-[family-name:var(--font-body)] text-xs font-semibold text-[var(--color-text-body)] mb-1"
              >
                6-Digit PIN Code *
              </label>
              <input
                id="addr-pincode"
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                placeholder="600001"
                className="w-full h-10 px-3 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-[family-name:var(--font-body)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-primary)] font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="addr-default"
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-[var(--color-border)] text-[var(--color-brand-primary)] focus:ring-[var(--color-brand-primary)]"
            />
            <label
              htmlFor="addr-default"
              className="font-[family-name:var(--font-body)] text-xs text-[var(--color-text-body)] select-none"
            >
              Make this my default delivery address
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--color-border-subtle)]">
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 rounded-[6px] bg-[var(--color-brand-primary)] text-white text-sm font-semibold font-[family-name:var(--font-body)] hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Saving...</span>
                </span>
              ) : (
                "Use This Address"
              )}
            </button>
            {addresses.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-10 px-4 text-sm font-[family-name:var(--font-body)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

