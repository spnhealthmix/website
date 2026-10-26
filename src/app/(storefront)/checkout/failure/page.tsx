import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Issue — SPN Health Mix",
  description: "Status of your payment attempt.",
};

interface FailurePageProps {
  searchParams: Promise<{
    orderId?: string;
    error?: string;
    pending?: string;
  }>;
}

export default async function CheckoutFailurePage({ searchParams }: FailurePageProps) {
  const { orderId, error, pending } = await searchParams;
  const isPending = pending === "true";

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-8 text-center sm:p-12 shadow-[var(--shadow-xs)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-sunken)]">
          {isPending ? (
            <svg
              className="h-7 w-7 text-[var(--color-warning)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg
              className="h-7 w-7 text-[var(--color-error)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>

        <h1 className="mt-6 font-[family-name:var(--font-heading)] text-2xl text-[var(--color-text-primary)] sm:text-3xl">
          {isPending
            ? "Your payment is being confirmed"
            : "Payment could not be completed"}
        </h1>

        <p className="mt-3 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-body)] leading-relaxed">
          {isPending
            ? "We are waiting for confirmation from your bank or payment provider. If your account was debited, your order will update shortly."
            : error ||
              "The transaction was not completed. Your card or account was not charged."}
        </p>

        {orderId && (
          <p className="mt-3 font-[family-name:var(--font-body)] text-xs text-[var(--color-text-muted)]">
            Reference ID: <span className="font-mono">{orderId.slice(0, 8)}...</span>
          </p>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/checkout"
            className="w-full rounded-[8px] bg-[var(--color-brand-primary)] px-6 py-3 font-[family-name:var(--font-body)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] sm:w-auto"
          >
            Try Again
          </Link>
          <Link
            href="/cart"
            className="w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 font-[family-name:var(--font-body)] text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] sm:w-auto"
          >
            Return to Cart
          </Link>
          <Link
            href="/shop"
            className="w-full px-6 py-3 font-[family-name:var(--font-body)] text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] sm:w-auto"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
