"use client";

import { useEffect, useState, useMemo } from "react";
import { Lock, ChevronDown, Check, X, AlertCircle } from "lucide-react";
import type { BusinessSettings } from "@/lib/settings/types";

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export function SettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState<BusinessSettings>({
    businessName: "SPN Health Mix",
    supportEmail: "spnhealthmix@gmail.com",
    phone: null,
    whatsapp: null,
    address: null,
    fssaiNumber: null,
    gstin: null,
    socialLinks: null,
    footerText: null,
  });

  const [originalData, setOriginalData] = useState<BusinessSettings | null>(null);

  // Load Business Settings
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/admin/settings/business", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to load business settings");
        }
        const data = await res.json();
        setFormData(data);
        setOriginalData(data);
      } catch (err: any) {
        setError(err.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Dirty State Tracking
  const isDirty = useMemo(() => {
    if (!originalData) return false;
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  // Discard Changes Handler
  const handleDiscard = () => {
    if (originalData) {
      setFormData(originalData);
      setError(null);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const res = await fetch("/api/admin/settings/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to save settings");
      }

      const updated = await res.json();
      setFormData(updated);
      setOriginalData(updated);
      setSuccess("Business settings updated successfully and logged to audit trail.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse font-[family-name:var(--font-body)]">
        <div className="h-10 w-72 bg-[#FAF5EF] rounded-xl" />
        <div className="h-16 w-full bg-[#FAF5EF] rounded-2xl" />
        <div className="h-44 w-full bg-[#FAF5EF] rounded-2xl" />
        <div className="h-44 w-full bg-[#FAF5EF] rounded-2xl" />
        <div className="h-44 w-full bg-[#FAF5EF] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 font-[family-name:var(--font-body)]">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="pt-1">
        <h1
          className="text-3xl sm:text-4xl lg:text-[40px] font-normal text-[#1A1614] leading-[1.1] tracking-tight"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Business Information &amp; Settings
        </h1>
        <p className="text-xs sm:text-sm text-[#635850] mt-1.5 font-normal">
          Manage your business details, support contacts and public-facing information.
        </p>
      </div>

      {/* ── Alerts ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 2. Security & Data Integrity Notice ────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl border border-[#E8DFD4] bg-[#F8F2EC] flex items-start gap-4 shadow-2xs">
        <div className="w-10 h-10 rounded-xl bg-[#FDF3EE] border border-[#F6DFD5] text-[#BF5330] flex items-center justify-center shrink-0 mt-0.5">
          <Lock className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-bold text-[#1A1614]">
            Security &amp; Data Integrity:
          </p>
          <p className="text-xs text-[#635850] leading-relaxed">
            Sensitive credentials remain in server environment secrets. Unverified statutory details stay hidden from customers.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Card A: Company Identity ─────────────────────────────────────── */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8DFD4] shadow-xs space-y-4">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1A1614] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Company Identity
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="businessName"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                Business / Brand Name <span className="text-[#BF5330]">*</span>
              </label>
              <input
                id="businessName"
                type="text"
                required
                value={formData.businessName}
                onChange={(e) =>
                  setFormData({ ...formData, businessName: e.target.value })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>

            <div>
              <label
                htmlFor="supportEmail"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                Customer Support Email <span className="text-[#BF5330]">*</span>
              </label>
              <input
                id="supportEmail"
                type="email"
                required
                value={formData.supportEmail}
                onChange={(e) =>
                  setFormData({ ...formData, supportEmail: e.target.value })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* ── Card B: Support Contacts ─────────────────────────────────────── */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8DFD4] shadow-xs space-y-4">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1A1614] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Support Contacts
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="phone"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                Support Phone Number
              </label>
              <input
                id="phone"
                type="text"
                placeholder="Leave blank if unconfigured"
                value={formData.phone || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value || null })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
              <p className="text-[11.5px] text-[#8C7E72] mt-1.5">
                Displayed on Contact/About page only when populated.
              </p>
            </div>

            <div>
              <label
                htmlFor="whatsapp"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                WhatsApp Support Number
              </label>
              <input
                id="whatsapp"
                type="text"
                placeholder="Leave blank if unconfigured"
                value={formData.whatsapp || ""}
                onChange={(e) =>
                  setFormData({ ...formData, whatsapp: e.target.value || null })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
              <p className="text-[11.5px] text-[#8C7E72] mt-1.5">
                Displayed on Contact/About page only when populated.
              </p>
            </div>
          </div>
        </div>

        {/* ── Card C: Statutory & Regulatory Registrations ─────────────────── */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8DFD4] shadow-xs space-y-4">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1A1614] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Statutory &amp; Regulatory Registrations
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label
                htmlFor="fssaiNumber"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                FSSAI License / Registration No.
              </label>
              <input
                id="fssaiNumber"
                type="text"
                placeholder="Leave blank until officially registered"
                value={formData.fssaiNumber || ""}
                onChange={(e) =>
                  setFormData({ ...formData, fssaiNumber: e.target.value || null })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
              <p className="text-[11.5px] text-[#8C7E72] mt-1.5">
                Kept strictly hidden from the public storefront until populated with authentic number.
              </p>
            </div>

            <div>
              <label
                htmlFor="gstin"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                GSTIN Number
              </label>
              <input
                id="gstin"
                type="text"
                placeholder="Leave blank until officially registered"
                value={formData.gstin || ""}
                onChange={(e) =>
                  setFormData({ ...formData, gstin: e.target.value || null })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
              <p className="text-[11.5px] text-[#8C7E72] mt-1.5">
                Kept strictly hidden from the public storefront until populated with authentic number.
              </p>
            </div>
          </div>
        </div>

        {/* ── Card D: Business Address ─────────────────────────────────────── */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8DFD4] shadow-xs space-y-4">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1A1614] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Business Address
          </h2>

          <div className="space-y-4">
            {/* Address Lines in 2 columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label
                  htmlFor="addressLine1"
                  className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
                >
                  Address Line 1
                </label>
                <input
                  id="addressLine1"
                  type="text"
                  placeholder="e.g. No. 25/1, Vegathupatti Village"
                  value={formData.address?.line1 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        line1: e.target.value || null,
                      },
                    })
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                />
              </div>

              <div>
                <label
                  htmlFor="addressLine2"
                  className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
                >
                  Address Line 2
                </label>
                <input
                  id="addressLine2"
                  type="text"
                  placeholder="e.g. Krishnapuram P I"
                  value={formData.address?.line2 || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        line2: e.target.value || null,
                      },
                    })
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* City, State, PIN Code in 3 aligned columns */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5">
              <div className="sm:col-span-5">
                <label
                  htmlFor="city"
                  className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
                >
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={formData.address?.city || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        city: e.target.value || null,
                      },
                    })
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                />
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="state"
                  className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
                >
                  State
                </label>
                <div className="relative">
                  <select
                    id="state"
                    value={formData.address?.state || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        address: {
                          ...formData.address,
                          state: e.target.value || null,
                        },
                      })
                    }
                    className="w-full h-11 px-3.5 pr-8 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] transition-all appearance-none cursor-pointer shadow-2xs"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="w-4 h-4 text-[#635850] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="pincode"
                  className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
                >
                  PIN Code
                </label>
                <input
                  id="pincode"
                  type="text"
                  placeholder="PIN Code"
                  value={formData.address?.pincode || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      address: {
                        ...formData.address,
                        pincode: e.target.value || null,
                      },
                    })
                  }
                  className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Card E: Social Media Links ───────────────────────────────────── */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E8DFD4] shadow-xs space-y-4">
          <h2
            className="text-lg sm:text-xl font-bold text-[#1A1614] tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Social Media Links
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="instagram"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                Instagram URL
              </label>
              <input
                id="instagram"
                type="text"
                placeholder="https://instagram.com/..."
                value={formData.socialLinks?.instagram || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: {
                      ...formData.socialLinks,
                      instagram: e.target.value || null,
                    },
                  })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>

            <div>
              <label
                htmlFor="youtube"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                YouTube URL
              </label>
              <input
                id="youtube"
                type="text"
                placeholder="https://youtube.com/..."
                value={formData.socialLinks?.youtube || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: {
                      ...formData.socialLinks,
                      youtube: e.target.value || null,
                    },
                  })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>

            <div>
              <label
                htmlFor="facebook"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                Facebook URL
              </label>
              <input
                id="facebook"
                type="text"
                placeholder="https://facebook.com/..."
                value={formData.socialLinks?.facebook || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: {
                      ...formData.socialLinks,
                      facebook: e.target.value || null,
                    },
                  })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>

            <div>
              <label
                htmlFor="twitter"
                className="block text-[11px] font-bold text-[#635850] uppercase tracking-wider mb-1.5"
              >
                X (Twitter) URL
              </label>
              <input
                id="twitter"
                type="text"
                placeholder="https://x.com/..."
                value={formData.socialLinks?.twitter || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: {
                      ...formData.socialLinks,
                      twitter: e.target.value || null,
                    },
                  })
                }
                className="w-full h-11 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-xs placeholder-[#8C7E72] focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* ── 5. Form Actions (Save & Discard) ──────────────────────────────── */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || saving}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#E8DFD4] bg-white hover:bg-[#FAF5EF] text-[#635850] hover:text-[#1A1614] text-sm font-semibold transition-colors shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Discard Changes
          </button>

          <button
            type="submit"
            disabled={saving || !isDirty}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] text-white text-sm font-semibold shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer"
          >
            {saving ? "Saving Changes..." : "Save Business Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
