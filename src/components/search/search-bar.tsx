"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search products…",
  className,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    const params = new URLSearchParams();
    params.set("q", trimmed);
    router.push(`/search?${params.toString()}`);
  };

  const handleClear = () => {
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={cn("relative flex items-center", className)}
    >
      <label htmlFor="search-input" className="sr-only">
        Search products
      </label>

      {/* Leading search icon */}
      <Search
        className="absolute left-3 h-4 w-4 text-[var(--color-text-muted)] pointer-events-none"
        aria-hidden
      />

      <input
        ref={inputRef}
        id="search-input"
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        minLength={2}
        maxLength={100}
        className="w-full h-12 pl-10 pr-10 font-[family-name:var(--font-body)] text-base text-[var(--color-text-primary)] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-[8px] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--color-brand-primary)] focus-visible:border-[var(--color-brand-primary)] transition-colors"
        aria-label="Search products"
      />

      {/* Clear button */}
      {value.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 h-6 w-6 flex items-center justify-center rounded-full hover:bg-[var(--color-border)] active:scale-95 transition-all focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5 text-[var(--color-text-muted)]" aria-hidden />
        </button>
      )}
    </form>
  );
}
