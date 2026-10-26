import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-[family-name:var(--font-body)] text-sm font-semibold text-[var(--color-brand-primary)] uppercase tracking-widest mb-4">
          404
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl lg:text-4xl text-[var(--color-text-primary)] mb-4">
          This page has wandered off
        </h1>
        <p className="font-[family-name:var(--font-body)] text-base text-[var(--color-text-body)] mb-8">
          We couldn&rsquo;t find what you were looking for. Head back to the shop &mdash; there&rsquo;s plenty to explore.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center h-12 px-7 font-[family-name:var(--font-body)] font-semibold text-base text-white bg-[var(--color-brand-primary)] rounded-[8px] hover:bg-[var(--color-brand-primary-dark)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
          >
            Go home
          </Link>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center h-12 px-7 font-[family-name:var(--font-body)] font-semibold text-base text-[var(--color-brand-primary)] bg-transparent hover:bg-[var(--color-brand-primary-light)] rounded-[8px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
          >
            Browse products
          </Link>
        </div>
      </div>
    </div>
  );
}
