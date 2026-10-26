"use client";

import React, { useState, useEffect } from "react";
import { User, ContactRound, Phone, Mail, Calendar, Edit3, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  createdAt: string;
}

function formatMemberSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "October 2026";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "October 2026";
    return d.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return "October 2026";
  }
}

function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone || phone.trim() === "") return "Not provided";
  const cleaned = phone.trim();
  if (cleaned.startsWith("+91")) {
    return cleaned;
  }
  if (/^[0-9]{10}$/.test(cleaned)) {
    return `+91 ${cleaned}`;
  }
  return cleaned;
}

export function ProfileSection() {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length === 0) {
      setError("Please enter your name.");
      return;
    }

    const cleanPhone = phone.trim().replace(/[\s\-().]/g, "");
    if (cleanPhone.length > 0 && !/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian mobile number (or leave blank).");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone || null,
        }),
      });

      const updated = await res.json();
      if (!res.ok) {
        setError(updated.message || "Failed to update profile details.");
        showToast("Could not update profile.", "error");
        return;
      }

      setProfile(updated);
      setIsEditing(false);
      showToast("Profile details updated successfully.", "success");
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Network error while updating profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="bg-white rounded-[22px] border border-[#E8DFD4] p-6 sm:p-8 lg:p-9 shadow-[0_2px_12px_rgba(42,24,16,0.03)] animate-pulse">
        <div className="flex items-center justify-between pb-6 border-b border-[#E8DFD4]/70 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#F5EFE8]" />
            <div className="space-y-2">
              <div className="h-6 w-36 bg-[#F5EFE8] rounded-md" />
              <div className="h-4 w-56 bg-[#F5EFE8] rounded-md" />
            </div>
          </div>
          <div className="h-9 w-28 bg-[#F5EFE8] rounded-[10px]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-3">
          <div className="space-y-6 sm:border-r sm:border-[#E8DFD4]/70 sm:pr-8">
            <div className="flex items-center gap-4 py-3">
              <div className="w-12 h-12 rounded-[12px] bg-[#F5EFE8]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-[#F5EFE8] rounded" />
                <div className="h-5 w-32 bg-[#F5EFE8] rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4 py-3">
              <div className="w-12 h-12 rounded-[12px] bg-[#F5EFE8]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-[#F5EFE8] rounded" />
                <div className="h-5 w-32 bg-[#F5EFE8] rounded" />
              </div>
            </div>
          </div>
          <div className="space-y-6 sm:pl-8">
            <div className="flex items-center gap-4 py-3">
              <div className="w-12 h-12 rounded-[12px] bg-[#F5EFE8]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-[#F5EFE8] rounded" />
                <div className="h-5 w-44 bg-[#F5EFE8] rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4 py-3">
              <div className="w-12 h-12 rounded-[12px] bg-[#F5EFE8]" />
              <div className="space-y-2 flex-1">
                <div className="h-3 w-20 bg-[#F5EFE8] rounded" />
                <div className="h-5 w-28 bg-[#F5EFE8] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <section
      aria-labelledby="profile-heading"
      className="bg-white rounded-[22px] border border-[#E8DFD4] p-5 sm:p-7 lg:p-8 shadow-[0_2px_12px_rgba(42,24,16,0.03)] font-[family-name:var(--font-body)]"
    >
      {/* Header matching reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-7 border-b border-[#E8DFD4]/80">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#FDF3EE] border border-[#BF5330]/20 flex items-center justify-center shrink-0">
            <ContactRound className="h-5 w-5 sm:h-6 sm:w-6 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2
              id="profile-heading"
              className="font-heading text-xl sm:text-2xl lg:text-[27px] text-[#1A1614] font-normal tracking-tight leading-snug"
            >
              Personal Details
            </h2>
            <p className="text-xs sm:text-sm text-[#786B62] font-normal mt-0.5 truncate sm:overflow-visible">
              Your contact details used for orders and shipping.
            </p>
          </div>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-[13.5px] font-medium transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
          >
            <Edit3 className="h-4 w-4" aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 p-3.5 rounded-xl bg-[#FEE9E6] border border-[#D6361A]/20 text-xs text-[#D6361A] font-medium"
        >
          {error}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSave} className="pt-6 space-y-5 max-w-lg">
          <div>
            <label
              htmlFor="edit-name"
              className="block text-xs font-semibold text-[#4A3B32] mb-1.5"
            >
              Full Name
            </label>
            <input
              id="edit-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-[10px] border border-[#E8DFD4] bg-[#FFFBF7] text-sm text-[#1A1614] focus:border-[#BF5330] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#BF5330] transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="edit-phone"
              className="block text-xs font-semibold text-[#4A3B32] mb-1.5"
            >
              Mobile Number (10 digits)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3 text-xs text-[#786B62] font-medium">
                +91
              </span>
              <input
                id="edit-phone"
                type="tel"
                placeholder="7094938940"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
                className="w-full h-11 pl-12 pr-3.5 rounded-[10px] border border-[#E8DFD4] bg-[#FFFBF7] text-sm text-[#1A1614] focus:border-[#BF5330] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#BF5330] transition-colors"
              />
            </div>
            <p className="text-[11px] text-[#786B62] mt-1.5">
              Used for delivery updates and order notifications.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#786B62] mb-1.5">
              Email Address
            </label>
            <div className="flex items-center gap-2.5 h-11 px-3.5 rounded-[10px] border border-[#E8DFD4] bg-[#F5EFE8]/70 text-sm text-[#786B62]">
              <Mail className="h-4 w-4 text-[#786B62] shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.email}</span>
            </div>
            <p className="text-[11px] text-[#786B62] mt-1.5">
              Managed securely through your sign-in identity.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              {saving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setIsEditing(false);
                setName(profile.name ?? "");
                setPhone(profile.phone ?? "");
                setError(null);
              }}
              className="inline-flex items-center justify-center px-4.5 py-2.5 rounded-[10px] border border-[#E8DFD4] hover:bg-[#FAF6F1] active:scale-[0.98] text-xs font-medium text-[#4A3B32] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          {/* Details 2x2 Grid with dividers matching reference image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 pt-2 sm:pt-3">
            {/* Column 1: Full Name & Mobile Number */}
            <div className="sm:border-r sm:border-[#E8DFD4]/70 sm:pr-8 lg:pr-10 flex flex-col justify-between">
              {/* Full Name */}
              <div className="flex items-center gap-4 py-4 sm:py-5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[12px] bg-[#FDF3EE] border border-[#BF5330]/15 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-[#786B62] font-normal leading-tight block">
                    Full Name
                  </span>
                  <p className="text-[15px] sm:text-base font-semibold text-[#1A1614] mt-0.5 leading-snug truncate">
                    {profile.name || "Not provided"}
                  </p>
                </div>
              </div>

              <div className="border-b border-[#E8DFD4]/70" />

              {/* Mobile Number */}
              <div className="flex items-center gap-4 py-4 sm:py-5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[12px] bg-[#FDF3EE] border border-[#BF5330]/15 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-[#786B62] font-normal leading-tight block">
                    Mobile Number
                  </span>
                  <p className="text-[15px] sm:text-base font-semibold text-[#1A1614] mt-0.5 leading-snug">
                    {formatPhoneNumber(profile.phone)}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: Email Address & Member Since */}
            <div className="sm:pl-8 lg:pl-10 flex flex-col justify-between border-t sm:border-t-0 border-[#E8DFD4]/70">
              {/* Email Address */}
              <div className="flex items-center gap-4 py-4 sm:py-5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[12px] bg-[#FDF3EE] border border-[#BF5330]/15 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-[#786B62] font-normal leading-tight block">
                    Email Address
                  </span>
                  <p className="text-[15px] sm:text-base font-semibold text-[#1A1614] mt-0.5 leading-snug break-all sm:break-normal truncate">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="border-b border-[#E8DFD4]/70" />

              {/* Member Since */}
              <div className="flex items-center gap-4 py-4 sm:py-5">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-[12px] bg-[#FDF3EE] border border-[#BF5330]/15 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5 text-[#BF5330]" strokeWidth={1.75} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs text-[#786B62] font-normal leading-tight block">
                    Member Since
                  </span>
                  <p className="text-[15px] sm:text-base font-semibold text-[#1A1614] mt-0.5 leading-snug">
                    {formatMemberSince(profile.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Edit Profile Button at the bottom */}
          <div className="pt-5 sm:hidden">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="w-full h-11 inline-flex items-center justify-center gap-2 px-5 rounded-xl bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-[13.5px] font-semibold transition-colors shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
