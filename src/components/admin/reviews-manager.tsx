"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { AdminReviewItem, ReviewStatus } from "@/lib/reviews/types";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-[#C45935]" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-4 h-4 ${star <= rating ? "fill-current text-[#C45935]" : "fill-none stroke-current text-[var(--color-border)]"}`}
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      ))}
      <span className="ml-1 text-xs font-semibold text-[var(--color-text-primary)]">{rating}</span>
    </div>
  );
}

export function ReviewsManager() {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal
  const [selectedReview, setSelectedReview] = useState<AdminReviewItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (verifiedFilter) params.set("verifiedOnly", "true");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/admin/reviews?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to load reviews");
      }
      const data = await res.json();
      setReviews(data.reviews || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, ratingFilter, verifiedFilter, searchQuery]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleUpdateStatus = async (reviewId: string, newStatus: ReviewStatus, note?: string) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, adminNote: note || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to update review status");
      }
      const updated = await res.json();
      setActionSuccess(`Review status updated to ${newStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setSelectedReview(null);
      setAdminNote("");
      // Update locally
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: newStatus } : r)),
      );
    } catch (err: any) {
      setError(err.message || "Failed to update review");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!confirm("Are you sure you want to remove this review? It will be archived and hidden from public view.")) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to delete review");
      }
      setActionSuccess("Review successfully hidden.");
      setTimeout(() => setActionSuccess(null), 4000);
      setSelectedReview(null);
      // Soft-deleted to hidden locally
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, status: "hidden" } : r)),
      );
    } catch (err: any) {
      setError(err.message || "Failed to delete review");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] font-[family-name:var(--font-heading)]">
            Customer Reviews & Ratings
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Moderate customer feedback, manage approvals, and audit verified purchase ratings.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] pb-3">
          {(
            [
              { id: "all", label: "All Reviews" },
              { id: "pending", label: "Pending Moderation" },
              { id: "published", label: "Published" },
              { id: "hidden", label: "Hidden / Rejected" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.id
                  ? "bg-[#C45935] text-white"
                  : "text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Search */}
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Search Reviews
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Product name, reviewer, title, text..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[#C45935]"
              />
              <svg
                className="w-4 h-4 text-[var(--color-text-muted)] absolute left-3 top-2.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Rating Filter */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
              Rating
            </label>
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 text-sm bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[#C45935]"
            >
              <option value="all">All Ratings (1–5)</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars only</option>
              <option value="3">3 Stars only</option>
              <option value="2">2 Stars only</option>
              <option value="1">1 Star only</option>
            </select>
          </div>

          {/* Verified Only Toggle */}
          <div className="flex flex-col justify-end">
            <label className="inline-flex items-center gap-2 cursor-pointer py-2 text-sm text-[var(--color-text-body)] select-none">
              <input
                type="checkbox"
                checked={verifiedFilter}
                onChange={(e) => {
                  setVerifiedFilter(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[#C45935] focus:ring-[#C45935]"
              />
              <span className="text-xs font-medium">Verified Purchases Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[var(--color-text-muted)]">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent mb-3" />
            <p className="text-sm font-medium">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-sunken)] flex items-center justify-center text-[var(--color-text-muted)]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              No reviews found
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || ratingFilter !== "all" || verifiedFilter
                ? "No reviews match your filter criteria. Try adjusting or clearing your filters."
                : "No customer reviews have been submitted yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[var(--color-text-body)]">
              <thead className="bg-[var(--color-surface-sunken)] border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Review Content</th>
                  <th className="py-3 px-4">Reviewer</th>
                  <th className="py-3 px-4">Verified</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--color-surface-sunken)]/50 transition-colors">
                    {/* Product */}
                    <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                      <Link
                        href={`/products/${r.productSlug}`}
                        target="_blank"
                        className="hover:text-[#C45935] hover:underline transition-colors font-semibold"
                      >
                        {r.productName}
                      </Link>
                    </td>

                    {/* Rating */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StarRating rating={r.rating} />
                    </td>

                    {/* Review Snippet */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {r.title && (
                        <p className="font-semibold text-xs text-[var(--color-text-primary)] truncate">
                          {r.title}
                        </p>
                      )}
                      <p className="text-xs text-[var(--color-text-body)] line-clamp-2 mt-0.5">
                        {r.body}
                      </p>
                    </td>

                    {/* Reviewer */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <p className="text-xs font-medium text-[var(--color-text-primary)]">
                        {r.reviewerName || "Customer"}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {r.reviewerEmail}
                      </p>
                    </td>

                    {/* Verified Purchase */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.verifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Verified
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                          Unverified
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {r.status === "published" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                          Published
                        </span>
                      )}
                      {r.status === "pending" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800">
                          Pending Moderation
                        </span>
                      )}
                      {r.status === "hidden" && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700">
                          Hidden
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedReview(r);
                            setAdminNote("");
                          }}
                          className="px-2 py-1 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded transition-colors"
                        >
                          Details
                        </button>

                        {r.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(r.id, "published")}
                              disabled={actionLoading}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 rounded transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(r.id, "hidden")}
                              disabled={actionLoading}
                              className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-300 rounded transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {r.status === "published" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "hidden")}
                            disabled={actionLoading}
                            className="px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-rose-700 hover:bg-rose-50 border border-[var(--color-border)] rounded transition-colors disabled:opacity-50"
                          >
                            Hide
                          </button>
                        )}

                        {r.status === "hidden" && (
                          <button
                            onClick={() => handleUpdateStatus(r.id, "published")}
                            disabled={actionLoading}
                            className="px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-300 rounded transition-colors disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 0 && (
          <div className="p-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-muted)]">
            <div>
              Showing {reviews.length} of {totalCount} reviews (Page {page} of {totalPages})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 border border-[var(--color-border)] rounded-md font-medium text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 border border-[var(--color-border)] rounded-md font-medium text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review Details & Moderation Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] font-[family-name:var(--font-heading)]">
                  Review Moderation
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  ID: {selectedReview.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedReview(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Product</span>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {selectedReview.productName}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Rating</span>
                  <div className="mt-1">
                    <StarRating rating={selectedReview.rating} />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Verified Purchase</span>
                  <p className="mt-1">
                    {selectedReview.verifiedPurchase ? (
                      <span className="text-xs font-semibold text-emerald-700">Yes (Delivered Order Item)</span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">No</span>
                    )}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Current Status</span>
                  <p className="mt-1 font-semibold capitalize text-xs">
                    {selectedReview.status}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Reviewer</span>
                <p className="text-xs font-medium text-[var(--color-text-primary)]">
                  {selectedReview.reviewerName || "Customer"} ({selectedReview.reviewerEmail})
                </p>
              </div>

              {selectedReview.title && (
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Title</span>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {selectedReview.title}
                  </p>
                </div>
              )}

              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">Review Body</span>
                <div className="mt-1 p-3 bg-[var(--color-surface-sunken)] rounded-lg text-xs leading-relaxed text-[var(--color-text-primary)] border border-[var(--color-border)] whitespace-pre-wrap">
                  {selectedReview.body}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">
                  Admin Audit Note (Optional)
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Reason for moderation action..."
                  className="w-full text-xs py-2 px-3 bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[#C45935]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => handleDelete(selectedReview.id)}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-300 rounded-lg transition-colors disabled:opacity-50"
              >
                Remove / Hide
              </button>

              <div className="flex items-center gap-2">
                {selectedReview.status !== "published" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedReview.id, "published", adminNote)}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    Approve / Publish
                  </button>
                )}

                {selectedReview.status !== "hidden" && (
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedReview.id, "hidden", adminNote)}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-zinc-700 hover:bg-zinc-800 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    Reject / Hide
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="px-3 py-2 text-xs font-medium text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
