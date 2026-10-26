"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ShoppingBag,
  Edit3,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { RatingStars } from "@/components/reviews/rating-stars";
import type { ReviewStatus } from "@/lib/reviews/types";

interface CustomerReviewItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
}

export function AccountReviews() {
  const [reviews, setReviews] = useState<CustomerReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit modal
  const [editingReview, setEditingReview] = useState<CustomerReviewItem | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMyReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me/reviews", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load your reviews.");
      }
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReviews();
  }, []);

  const handleOpenEdit = (r: CustomerReviewItem) => {
    setEditingReview(r);
    setEditRating(r.rating);
    setEditTitle(r.title || "");
    setEditBody(r.body || "");
    setSaveError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    if (editRating < 1 || editRating > 5) {
      setSaveError("Rating must be between 1 and 5.");
      return;
    }
    if (editBody.trim().length < 3) {
      setSaveError("Review must be at least 3 characters.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/me/reviews/${editingReview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: editRating,
          title: editTitle.trim() || null,
          body: editBody.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to update review.");
      }

      const updated = await res.json();
      setReviews((prev) =>
        prev.map((it) =>
          it.id === editingReview.id
            ? {
                ...it,
                rating: updated.rating,
                title: updated.title,
                body: updated.body,
                status: updated.status,
              }
            : it,
        ),
      );
      setActionSuccess("Review successfully updated.");
      setTimeout(() => setActionSuccess(null), 4000);
      setEditingReview(null);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/me/reviews/${deletingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete review.");
      setReviews((prev) => prev.filter((r) => r.id !== deletingId));
      setActionSuccess("Review deleted successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      setDeletingId(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete review.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading skeleton matching panel design
  if (loading && reviews.length === 0) {
    return (
      <div className="space-y-3 sm:space-y-4 font-[family-name:var(--font-body)]">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-[#E8DFD4] bg-white animate-pulse space-y-3.5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD4]/70">
              <div className="space-y-2">
                <div className="h-5 w-48 bg-[#FAF6F1] rounded" />
                <div className="h-4 w-28 bg-[#FAF6F1] rounded" />
              </div>
              <div className="h-6 w-24 bg-[#FAF6F1] rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-[#FAF6F1] rounded" />
              <div className="h-4 w-3/4 bg-[#FAF6F1] rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="font-[family-name:var(--font-body)]">
      {/* Action Messages */}
      {actionSuccess && (
        <div className="mb-4 sm:mb-5 p-4 bg-[#F2FBF5] border border-[#247B49]/20 text-[#166534] text-xs sm:text-[13px] rounded-xl flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-[#166534] hover:opacity-75 font-semibold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 sm:mb-5 p-4 bg-[#FEE2E2]/60 border border-[#EF4444]/20 text-[#991B1B] text-xs sm:text-[13px] rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#991B1B] hover:opacity-75 font-semibold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Reviews Content */}
      {reviews.length === 0 ? (
        /* Empty State matching reference image */
        <div className="p-8 sm:p-12 lg:p-16 rounded-2xl border border-dashed border-[#E8DFD4] bg-[#FAF6F1]/50 text-center max-w-lg mx-auto my-4">
            {/* Tasteful centered star illustration with botanical sprigs & sparkles */}
            <div className="relative inline-block mb-4 sm:mb-5">
              <svg
                viewBox="0 0 320 160"
                fill="none"
                className="w-60 sm:w-72 h-auto mx-auto select-none"
                aria-hidden="true"
              >
                {/* Left botanical sprig */}
                <path
                  d="M 115 105 C 90 98, 70 88, 52 68"
                  stroke="#D9C6AA"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M 52 68 C 48 57, 59 52, 64 58 C 62 65, 55 67, 52 68 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 68 80 C 65 69, 76 65, 81 71 C 79 78, 72 79, 68 80 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 90 92 C 86 81, 98 77, 103 83 C 100 90, 93 91, 90 92 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 70 92 C 75 102, 64 107, 60 101 C 62 94, 68 93, 70 92 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 95 102 C 100 112, 89 116, 85 110 C 87 103, 93 103, 95 102 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />

                {/* Right botanical sprig */}
                <path
                  d="M 205 105 C 230 98, 250 88, 268 68"
                  stroke="#D9C6AA"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <path
                  d="M 268 68 C 272 57, 261 52, 256 58 C 258 65, 265 67, 268 68 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 252 80 C 255 69, 244 65, 239 71 C 241 78, 248 79, 252 80 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 230 92 C 234 81, 222 77, 217 83 C 220 90, 227 91, 230 92 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 250 92 C 245 102, 256 107, 260 101 C 258 94, 252 93, 250 92 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />
                <path
                  d="M 225 102 C 220 112, 231 116, 235 110 C 233 103, 227 103, 225 102 Z"
                  fill="#FAF6F1"
                  stroke="#D9C6AA"
                  strokeWidth="1.2"
                />

                {/* Delicate sparkles around sprigs */}
                <path
                  d="M 94 62 Q 94 68, 88 68 Q 94 68, 94 74 Q 94 68, 100 68 Q 94 68, 94 62 Z"
                  fill="#D9C6AA"
                  opacity="0.75"
                />
                <path
                  d="M 110 82 Q 110 86, 106 86 Q 110 86, 110 90 Q 110 86, 114 86 Q 110 86, 110 82 Z"
                  fill="#D9C6AA"
                  opacity="0.65"
                />
                <path
                  d="M 226 62 Q 226 68, 220 68 Q 226 68, 226 74 Q 226 68, 232 68 Q 226 68, 226 62 Z"
                  fill="#D9C6AA"
                  opacity="0.75"
                />
                <path
                  d="M 210 82 Q 210 86, 206 86 Q 210 86, 210 90 Q 210 86, 214 86 Q 210 86, 210 82 Z"
                  fill="#D9C6AA"
                  opacity="0.65"
                />

                {/* Radiating sunburst ticks above star */}
                <line x1="160" y1="28" x2="160" y2="20" stroke="#E29E84" strokeWidth="2" strokeLinecap="round" />
                <line x1="140" y1="34" x2="133" y2="28" stroke="#E29E84" strokeWidth="2" strokeLinecap="round" />
                <line x1="180" y1="34" x2="187" y2="28" stroke="#E29E84" strokeWidth="2" strokeLinecap="round" />

                {/* Center circle */}
                <circle cx="160" cy="80" r="39" fill="#FDF3EE" stroke="#F4DFD7" strokeWidth="1.5" />

                {/* Star inside circle */}
                <path
                  d="M 160 58 L 166.5 71.5 L 181.5 73.5 L 170.5 84 L 173.5 99 L 160 91.5 L 146.5 99 L 149.5 84 L 138.5 73.5 L 153.5 71.5 Z"
                  stroke="#BF5330"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>

            {/* Heading */}
            <h3 className="font-heading font-normal text-2xl sm:text-[28px] text-[#1A1614] mb-2 tracking-tight">
              No reviews yet
            </h3>

            {/* Supporting Text */}
            <p className="text-xs sm:text-[14px] text-[#786B62] max-w-md mx-auto leading-relaxed mb-6 font-[family-name:var(--font-manrope)] font-normal">
              Your product reviews will appear here after you&apos;ve purchased and reviewed a product.
            </p>

            {/* Explore Products Button */}
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] active:scale-[0.98] text-white text-xs sm:text-[13.5px] font-medium transition-all shadow-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330]"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
              <span>Explore Products</span>
            </Link>
          </div>
        ) : (
          /* Dynamic Reviews List */
          <div className="space-y-3 sm:space-y-4">
            {reviews.map((r) => {
              const formattedDate = new Date(r.createdAt).toLocaleDateString("en-IN", {
                year: "numeric",
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={r.id}
                  className="p-5 sm:p-6 rounded-xl sm:rounded-2xl border border-[#E8DFD4] bg-white hover:border-[#D6C7BA] transition-all shadow-2xs space-y-3.5"
                >
                  {/* Header: Product link, Rating, Date, Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#E8DFD4]/70">
                    <div>
                      <Link
                        href={`/products/${r.productSlug}`}
                        className="font-normal font-body font-[family-name:var(--font-manrope)] text-base text-[#1A1614] hover:text-[#BF5330] transition-colors"
                      >
                        {r.productName}
                      </Link>
                      <div className="flex items-center gap-2.5 mt-1">
                        <RatingStars rating={r.rating} size="sm" />
                        <time dateTime={r.createdAt} className="text-xs text-[#8C7E74]">
                          {formattedDate}
                        </time>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.verifiedPurchase && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#166534] border border-[#166534]/20">
                          <svg className="w-3 h-3 text-[#166534]" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Verified Purchase
                        </span>
                      )}

                      {r.status === "published" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DCFCE7] text-[#166534]">
                          Published
                        </span>
                      ) : r.status === "pending" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#92400E]">
                          Pending Moderation
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-[#4B5563]">
                          Hidden
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review Content */}
                  <div className="space-y-1">
                    {r.title && (
                      <h4 className="font-semibold text-sm text-[#1A1614]">
                        {r.title}
                      </h4>
                    )}
                    <p className="text-xs sm:text-[13.5px] text-[#635850] leading-relaxed whitespace-pre-line font-[family-name:var(--font-manrope)]">
                      {r.body}
                    </p>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="pt-2 flex items-center justify-end gap-3 sm:gap-4 border-t border-[#E8DFD4]/70">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(r)}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-[#4A3B32] hover:text-[#BF5330] transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-[#FAF6F1]"
                    >
                      <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden="true" />
                      <span>Edit Review</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(r.id)}
                      className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-[#BF5330] hover:text-[#8F3E20] transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-[#FEE9E6]"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
            );
          })}
        </div>
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1614]/50 backdrop-blur-xs"
        >
          <div className="bg-white border border-[#E8DFD4] rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-[#E8DFD4] pb-4">
              <div>
                <h3 className="font-heading font-normal text-xl sm:text-2xl text-[#1A1614]">
                  Edit Your Review
                </h3>
                <p className="text-xs text-[#786B62] mt-0.5">
                  {editingReview.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingReview(null)}
                className="p-1 rounded-lg text-[#786B62] hover:text-[#1A1614] hover:bg-[#FAF6F1] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {saveError && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-[#FEE2E2]/60 border border-[#EF4444]/20 text-xs sm:text-[13px] text-[#991B1B] flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs sm:text-[13px] font-[family-name:var(--font-body)]">
              <div>
                <label className="block font-medium text-[#4A3B32] mb-1.5">
                  Rating (1–5) *
                </label>
                <div className="flex items-center gap-3">
                  <RatingStars rating={editRating} interactive size="lg" onChange={setEditRating} />
                  <span className="font-medium text-xs text-[#1A1614]">
                    {editRating} Star{editRating > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-medium text-[#4A3B32]">
                    Title (optional)
                  </label>
                  <span className="text-[11px] text-[#8C7E74]">
                    {editTitle.length}/100
                  </span>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  maxLength={100}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors"
                  placeholder="e.g. Excellent traditional flavor"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-medium text-[#4A3B32]">
                    Review Text *
                  </label>
                  <span className="text-[11px] text-[#8C7E74]">
                    {editBody.length}/2000
                  </span>
                </div>
                <textarea
                  value={editBody}
                  maxLength={2000}
                  rows={4}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full p-3 rounded-lg border border-[#E8DFD4] bg-[#FAF6F1]/30 text-sm text-[#1A1614] placeholder-[#A09388] focus:border-[#BF5330] focus:bg-white focus:outline-none transition-colors leading-relaxed resize-y"
                  required
                  placeholder="Share details of your experience with this product..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8DFD4]">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  disabled={saving}
                  className="px-4.5 py-2.5 rounded-lg border border-[#E8DFD4] text-xs sm:text-[13px] font-medium text-[#4A3B32] hover:bg-[#FAF6F1] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-[10px] bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs sm:text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
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
              Delete Review?
            </h3>
            <p className="text-xs sm:text-[13px] text-[#786B62] mb-6 leading-relaxed">
              Are you sure you want to delete this review? This action cannot be undone.
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
