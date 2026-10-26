import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersList } from "@/components/admin/orders-list";

export const metadata: Metadata = {
  title: "Orders Management — SPN Health Mix Admin",
  description: "View and fulfill customer orders across SPN Health Mix.",
};

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] rounded-lg p-6 space-y-3">
          <div className="h-6 w-32 bg-stone-200 animate-pulse rounded" />
          <div className="h-14 bg-stone-100 animate-pulse rounded" />
          <div className="h-14 bg-stone-100 animate-pulse rounded" />
        </div>
      }
    >
      <OrdersList />
    </Suspense>
  );
}
