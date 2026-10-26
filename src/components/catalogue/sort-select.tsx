"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { value: "featured",   label: "Featured" },
  { value: "price_asc",  label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest",     label: "Newest" },
  { value: "name",       label: "Name: A–Z" },
] as const;

const SEARCH_SORT_OPTIONS = [
  { value: "relevance",  label: "Most Relevant" },
  ...SORT_OPTIONS,
] as const;

interface SortSelectProps {
  currentSort?: string;
  isSearch?: boolean;
  className?: string;
}

export function SortSelect({ currentSort, isSearch = false, className }: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = isSearch ? SEARCH_SORT_OPTIONS : SORT_OPTIONS;
  const defaultSort = isSearch ? "relevance" : "featured";
  const value = currentSort ?? defaultSort;

  const handleChange = (newSort: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === defaultSort) {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    params.delete("offset"); // reset pagination on sort change
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <label
        htmlFor="sort-select"
        className="text-sm font-[family-name:var(--font-body)] text-[var(--color-text-muted)] whitespace-nowrap hidden sm:block"
      >
        Sort by
      </label>
      <select
        id="sort-select"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="h-9 pl-3 pr-8 text-sm font-[family-name:var(--font-body)] text-[var(--color-text-body)] bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)] cursor-pointer appearance-none bg-no-repeat"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%238A7F78' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 10px center",
        }}
        aria-label="Sort products"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
