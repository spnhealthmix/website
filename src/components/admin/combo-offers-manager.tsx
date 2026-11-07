"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { AdminModal } from "@/components/admin/admin-modal";

export type ComboOfferItem = {
  id: string;
  name: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  destinationUrl: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ComboOffersManager() {
  const [offers, setOffers] = useState<ComboOfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [editingOffer, setEditingOffer] = useState<ComboOfferItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("/combo-offers");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  // Images state
  const [desktopImageUrl, setDesktopImageUrl] = useState("");
  const [mobileImageUrl, setMobileImageUrl] = useState("");
  const [desktopUploading, setDesktopUploading] = useState(false);
  const [mobileUploading, setMobileUploading] = useState(false);

  // File input refs
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  // Delete target modal
  const [deleteTarget, setDeleteTarget] = useState<ComboOfferItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Lightbox preview for full image
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

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

  useEffect(() => {
    fetchOffers();
  }, []);

  const openCreateModal = () => {
    setEditingOffer(null);
    setName("");
    setDestinationUrl("/combo-offers");
    setDisplayOrder(offers.length > 0 ? Math.max(...offers.map((o) => o.displayOrder)) + 1 : 0);
    setIsActive(true);
    setDesktopImageUrl("");
    setMobileImageUrl("");
    setFormError(null);
    setIsCreating(true);
  };

  const openEditModal = (offer: ComboOfferItem) => {
    setEditingOffer(offer);
    setName(offer.name);
    setDestinationUrl(offer.destinationUrl || "/combo-offers");
    setDisplayOrder(offer.displayOrder ?? 0);
    setIsActive(offer.isActive);
    setDesktopImageUrl(offer.desktopImageUrl);
    setMobileImageUrl(offer.mobileImageUrl);
    setFormError(null);
    setIsCreating(false);
  };

  const handleUploadImage = async (
    file: File,
    type: "desktop" | "mobile",
  ) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError("File size exceeds 5MB limit.");
      return;
    }

    if (type === "desktop") setDesktopUploading(true);
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

      if (type === "desktop") {
        setDesktopImageUrl(data.url);
      } else {
        setMobileImageUrl(data.url);
      }
    } catch (err: any) {
      setFormError(err.message || "Upload failed. Please try again.");
    } finally {
      if (type === "desktop") setDesktopUploading(false);
      else setMobileUploading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Offer name is required.");
      return;
    }

    if (!desktopImageUrl) {
      setFormError("Desktop poster image is required.");
      return;
    }

    if (!mobileImageUrl) {
      setFormError("Mobile poster image is required.");
      return;
    }

    setFormSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        destinationUrl: destinationUrl.trim() || "/combo-offers",
        displayOrder: Number(displayOrder) || 0,
        isActive,
        desktopImageUrl,
        mobileImageUrl,
      };

      const url = editingOffer
        ? `/api/admin/combo-offers/${editingOffer.id}`
        : "/api/admin/combo-offers";
      const method = editingOffer ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(resData?.error?.message || "Failed to save combo offer.");
      }

      setActionSuccess(
        editingOffer
          ? `Combo offer "${name}" updated successfully.`
          : `Combo offer "${name}" created successfully.`,
      );
      setTimeout(() => setActionSuccess(null), 4000);

      setIsCreating(false);
      setEditingOffer(null);
      await fetchOffers();
    } catch (err: any) {
      setFormError(err.message || "Failed to save combo offer.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (offer: ComboOfferItem) => {
    try {
      const nextActive = !offer.isActive;
      const res = await fetch(`/api/admin/combo-offers/${offer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to update status.");
      }

      setOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, isActive: nextActive } : o)),
      );
      setActionSuccess(
        `Combo offer "${offer.name}" ${nextActive ? "activated" : "deactivated"}.`,
      );
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update status.");
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

      setOffers((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setActionSuccess(`Combo offer "${deleteTarget.name}" deleted successfully.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete combo offer.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#E8DFD4]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1
              className="text-2xl sm:text-3xl font-bold text-[#1A1614] tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Combo Offers
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FAF5EF] text-[#BF5330] border border-[#E8DFD4]">
              <Sparkles className="w-3 h-3" />
              Homepage Carousel
            </span>
          </div>
          <p className="text-sm text-[#635850] mt-1 max-w-2xl">
            Manage promotional posters displayed in the homepage hero carousel.
            Upload dedicated desktop (16:9) and mobile (portrait) posters so visitors on any
            device get an optimal visual experience.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchOffers}
            className="p-2.5 rounded-xl border border-[#E8DFD4] bg-white text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EF] transition-colors shadow-2xs"
            aria-label="Refresh list"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Combo Offer</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Listing */}
      <div className="bg-white rounded-2xl border border-[#E8DFD4] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#BF5330] mb-3" />
            <p className="text-sm font-medium text-[#635850]">Loading combo offers...</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="py-16 px-6 text-center max-w-md mx-auto">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FAF5EF] border border-[#E8DFD4] flex items-center justify-center text-[#BF5330] mb-4">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h3
              className="text-lg font-bold text-[#1A1614] mb-1.5"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              No Combo Offers Found
            </h3>
            <p className="text-xs sm:text-sm text-[#635850] mb-6">
              Create your first combo offer promotional poster to feature it dynamically in the homepage carousel.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Combo Offer</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF5EF]/70 border-b border-[#E8DFD4] text-[#635850] font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Desktop Poster</th>
                  <th className="py-3 px-4">Mobile Poster</th>
                  <th className="py-3 px-4">Offer Name & Destination</th>
                  <th className="py-3 px-4 text-center">Order</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD4]">
                {offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className={`hover:bg-[#FAF5EF]/40 transition-colors ${
                      !offer.isActive ? "opacity-60 bg-stone-50/50" : ""
                    }`}
                  >
                    {/* Desktop Thumbnail */}
                    <td className="py-3.5 px-4 w-36">
                      <div
                        className="relative w-32 aspect-video rounded-lg overflow-hidden border border-[#E8DFD4] bg-[#FAF5EF] cursor-pointer group shadow-2xs"
                        onClick={() =>
                          setPreviewImage({
                            url: offer.desktopImageUrl,
                            title: `${offer.name} (Desktop)`,
                          })
                        }
                      >
                        <Image
                          src={offer.desktopImageUrl}
                          alt={`${offer.name} Desktop`}
                          fill
                          sizes="128px"
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                    </td>

                    {/* Mobile Thumbnail */}
                    <td className="py-3.5 px-4 w-24">
                      <div
                        className="relative w-16 aspect-[2/3] rounded-lg overflow-hidden border border-[#E8DFD4] bg-[#FAF5EF] cursor-pointer group shadow-2xs"
                        onClick={() =>
                          setPreviewImage({
                            url: offer.mobileImageUrl,
                            title: `${offer.name} (Mobile)`,
                          })
                        }
                      >
                        <Image
                          src={offer.mobileImageUrl}
                          alt={`${offer.name} Mobile`}
                          fill
                          sizes="64px"
                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </td>

                    {/* Details */}
                    <td className="py-3.5 px-4 min-w-[200px]">
                      <div className="font-semibold text-sm text-[#1A1614] mb-1">
                        {offer.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[#635850]">
                        <span className="text-[#8C7E72]">Destination:</span>
                        <Link
                          href={offer.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#BF5330] hover:underline font-medium"
                        >
                          <span className="truncate max-w-[220px]">
                            {offer.destinationUrl}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </Link>
                      </div>
                    </td>

                    {/* Order */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-[#FAF5EF] border border-[#E8DFD4] font-bold text-xs text-[#1A1614]">
                        #{offer.displayOrder}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(offer)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                          offer.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200"
                        }`}
                        title={offer.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            offer.isActive ? "bg-emerald-500" : "bg-stone-400"
                          }`}
                        />
                        <span>{offer.isActive ? "Active" : "Inactive"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(offer)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-[#E8DFD4] bg-white text-[#635850] hover:bg-[#FAF5EF] hover:text-[#1A1614] transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(offer)}
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

      {/* Modal: Add / Edit Combo Offer */}
      <AdminModal
        isOpen={Boolean(isCreating || editingOffer)}
        onClose={() => {
          setIsCreating(false);
          setEditingOffer(null);
          setFormError(null);
        }}
        title={editingOffer ? "Edit Combo Offer" : "Add Combo Offer"}
        description={
          editingOffer
            ? "Update poster details, destination page, display order or replace banner artwork."
            : "Configure a promotional poster to be featured in the homepage hero carousel."
        }
        maxWidthClass="max-w-[620px]"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4">
            {/* Basic Details */}
            <div>
              <label
                htmlFor="offer-name"
                className="block text-xs font-semibold text-[#1A1614] mb-1.5"
              >
                Offer Name <span className="text-[#BF5330]">*</span>
              </label>
              <input
                id="offer-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diwali Special Family Combo"
                className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
              />
              <p className="text-[11px] text-[#8C7E72] mt-1">
                For internal identification and image accessibility alt text.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="dest-page"
                  className="block text-xs font-semibold text-[#1A1614] mb-1.5"
                >
                  Destination Page <span className="text-[#BF5330]">*</span>
                </label>
                <input
                  id="dest-page"
                  type="text"
                  required
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="/combo-offers"
                  className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm placeholder:text-[#8C7E72]/70 focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                />
                <p className="text-[11px] text-[#8C7E72] mt-1">
                  Default: <code className="bg-[#FAF5EF] px-1 py-0.5 rounded">/combo-offers</code>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="display-order"
                    className="block text-xs font-semibold text-[#1A1614] mb-1.5"
                  >
                    Display Order
                  </label>
                  <input
                    id="display-order"
                    type="number"
                    min={0}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-10 px-3.5 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                  />
                  <p className="text-[11px] text-[#8C7E72] mt-1">Lower = first</p>
                </div>

                <div>
                  <label
                    htmlFor="status-active"
                    className="block text-xs font-semibold text-[#1A1614] mb-1.5"
                  >
                    Status
                  </label>
                  <select
                    id="status-active"
                    value={isActive ? "true" : "false"}
                    onChange={(e) => setIsActive(e.target.value === "true")}
                    className="w-full h-10 px-3 rounded-xl border border-[#E8DFD4] bg-white text-[#1A1614] text-sm focus:outline-none focus:border-[#BF5330] focus:ring-1 focus:ring-[#BF5330] transition-colors shadow-2xs"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Poster Upload Sections */}
            <div className="pt-2 border-t border-[#E8DFD4] space-y-4">
              <h3 className="text-xs font-bold text-[#1A1614] uppercase tracking-wider">
                Poster Images (Cloudflare R2)
              </h3>

              {/* Desktop Poster Upload */}
              <div className="p-4 rounded-xl border border-[#E8DFD4] bg-[#FAF5EF]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-[#1A1614] flex items-center gap-1.5">
                      Desktop Poster <span className="text-[#BF5330]">*</span>
                    </label>
                    <p className="text-[11px] text-[#635850]">
                      Landscape banner (16:9 ratio recommended). Max 5MB.
                    </p>
                  </div>
                  {desktopImageUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  )}
                </div>

                {desktopImageUrl ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-[#E8DFD4] bg-white group">
                    <Image
                      src={desktopImageUrl}
                      alt="Desktop Poster Preview"
                      fill
                      sizes="500px"
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => desktopFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/95 text-xs font-semibold text-[#1A1614] hover:bg-white shadow-xs"
                      >
                        Replace Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesktopImageUrl("")}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !desktopUploading && desktopFileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#E8DFD4] hover:border-[#BF5330] rounded-xl p-6 text-center cursor-pointer transition-colors bg-white flex flex-col items-center justify-center gap-2"
                  >
                    {desktopUploading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-[#BF5330]" />
                        <span className="text-xs font-medium text-[#635850]">
                          Uploading to Cloudflare R2...
                        </span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-6 h-6 text-[#BF5330]" />
                        <span className="text-xs font-semibold text-[#1A1614]">
                          Upload Desktop Poster
                        </span>
                        <span className="text-[11px] text-[#8C7E72]">
                          JPEG, PNG, or WebP up to 5MB
                        </span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={desktopFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file, "desktop");
                    e.target.value = "";
                  }}
                />
              </div>

              {/* Mobile Poster Upload */}
              <div className="p-4 rounded-xl border border-[#E8DFD4] bg-[#FAF5EF]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-[#1A1614] flex items-center gap-1.5">
                      Mobile Poster <span className="text-[#BF5330]">*</span>
                    </label>
                    <p className="text-[11px] text-[#635850]">
                      Portrait poster (2:3 or 4:5 ratio recommended). Max 5MB.
                    </p>
                  </div>
                  {mobileImageUrl && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  )}
                </div>

                {mobileImageUrl ? (
                  <div className="relative w-40 aspect-[2/3] mx-auto rounded-lg overflow-hidden border border-[#E8DFD4] bg-white group">
                    <Image
                      src={mobileImageUrl}
                      alt="Mobile Poster Preview"
                      fill
                      sizes="200px"
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => mobileFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-lg bg-white/95 text-xs font-semibold text-[#1A1614] hover:bg-white shadow-xs"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileImageUrl("")}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-700 shadow-xs"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !mobileUploading && mobileFileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#E8DFD4] hover:border-[#BF5330] rounded-xl p-6 text-center cursor-pointer transition-colors bg-white flex flex-col items-center justify-center gap-2"
                  >
                    {mobileUploading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-[#BF5330]" />
                        <span className="text-xs font-medium text-[#635850]">
                          Uploading to Cloudflare R2...
                        </span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-6 h-6 text-[#BF5330]" />
                        <span className="text-xs font-semibold text-[#1A1614]">
                          Upload Mobile Poster
                        </span>
                        <span className="text-[11px] text-[#8C7E72]">
                          JPEG, PNG, or WebP up to 5MB
                        </span>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file, "mobile");
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            {/* Form Footer Buttons */}
            <div className="pt-4 border-t border-[#E8DFD4] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingOffer(null);
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-[#E8DFD4] bg-white text-[#635850] hover:bg-[#FAF5EF] hover:text-[#1A1614] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting || desktopUploading || mobileUploading}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {editingOffer ? "Save Changes" : "Create Combo Offer"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </AdminModal>

      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Combo Offer"
        description="Are you sure you want to delete this promotional offer? It will be permanently removed from the homepage carousel."
        maxWidthClass="max-w-[480px]"
      >
        <div className="space-y-4">
          {deleteTarget && (
            <div className="p-3.5 rounded-xl bg-[#FAF5EF] border border-[#E8DFD4] text-xs text-[#1A1614]">
              <span className="font-semibold">{deleteTarget.name}</span>
              <p className="text-[#635850] mt-1 text-[11px]">
                Destination: {deleteTarget.destinationUrl}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-[#E8DFD4] bg-white text-[#635850] hover:bg-[#FAF5EF] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Delete Combo Offer</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* Lightbox Modal for previewing images */}
      <AdminModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        title={previewImage?.title || "Poster Preview"}
        maxWidthClass="max-w-[800px]"
      >
        {previewImage && (
          <div className="relative w-full max-h-[70vh] aspect-video rounded-xl overflow-hidden bg-[#FAF5EF]">
            <Image
              src={previewImage.url}
              alt={previewImage.title}
              fill
              sizes="800px"
              className="object-contain"
            />
          </div>
        )}
      </AdminModal>
    </div>
  );
}
