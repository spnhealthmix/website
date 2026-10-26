"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
}

export function Pagination({ total, limit, offset }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) return null;

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    const newOffset = (page - 1) * limit;
    if (newOffset === 0) {
      params.delete("offset");
    } else {
      params.set("offset", String(newOffset));
    }
    router.replace(`${pathname}?${params.toString()}`);
    // Scroll to top of product grid
    document.getElementById("product-grid-top")?.scrollIntoView({ behavior: "smooth" });
  }

  const btnBase =
    "h-9 min-w-[36px] px-2 flex items-center justify-center font-[family-name:var(--font-body)] text-sm rounded-[4px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]";

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-center gap-1.5 mt-10"
    >
      {/* Previous */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={cn(
          btnBase,
          "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
        aria-label="Previous page"
      >
        ← Prev
      </button>

      {/* Page numbers */}
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
        const isActive = page === currentPage;
        // Show: first, last, current ±1, and ellipsis
        const showPage =
          page === 1 ||
          page === totalPages ||
          Math.abs(page - currentPage) <= 1;

        if (!showPage) {
          // Show ellipsis only once per gap
          if (page === 2 && currentPage > 3) {
            return (
              <span
                key={page}
                className="h-9 px-1 flex items-center text-sm text-[var(--color-text-muted)]"
                aria-hidden
              >
                …
              </span>
            );
          }
          if (page === totalPages - 1 && currentPage < totalPages - 2) {
            return (
              <span
                key={page}
                className="h-9 px-1 flex items-center text-sm text-[var(--color-text-muted)]"
                aria-hidden
              >
                …
              </span>
            );
          }
          return null;
        }

        return (
          <button
            key={page}
            onClick={() => goToPage(page)}
            aria-current={isActive ? "page" : undefined}
            aria-label={`Page ${page}`}
            className={cn(
              btnBase,
              isActive
                ? "bg-[var(--color-brand-primary)] border-[var(--color-brand-primary)] text-white font-semibold"
                : "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]"
            )}
          >
            {page}
          </button>
        );
      })}

      {/* Next */}
      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={cn(
          btnBase,
          "border-[var(--color-border)] text-[var(--color-text-body)] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
          "disabled:opacity-40 disabled:cursor-not-allowed"
        )}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
