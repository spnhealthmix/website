"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Route whitelist: Breadcrumbs are strictly restricted to the four My Account pages
 * (/account/profile, /account/orders, /account/addresses, /account/reviews).
 */
const ALLOWED_BREADCRUMB_ROUTES = new Set([
  "/account",
  "/account/profile",
  "/account/orders",
  "/account/addresses",
  "/account/reviews",
]);

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname();

  // Return null if not on one of the four allowed account pages
  if (!pathname || !ALLOWED_BREADCRUMB_ROUTES.has(pathname)) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("", className)}>
      <ol
        className="flex items-center gap-1.5 flex-wrap"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={index}
              className="flex items-center gap-1.5"
              itemScope
              itemType="https://schema.org/ListItem"
              itemProp="itemListElement"
            >
              <meta itemProp="position" content={String(index + 1)} />

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-xs font-[family-name:var(--font-body)] text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors"
                  itemProp="item"
                >
                  <span itemProp="name">{item.label}</span>
                </Link>
              ) : (
                <span
                  className="text-xs font-[family-name:var(--font-body)] text-[var(--color-text-body)]"
                  aria-current={isLast ? "page" : undefined}
                  itemProp="name"
                >
                  {item.label}
                </span>
              )}

              {!isLast && (
                <svg
                  className="h-3 w-3 text-[var(--color-text-muted)] flex-shrink-0"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 2.5l3 3.5-3 3.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
