import type { Metadata } from "next";
import { OrdersList } from "@/components/account/orders-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Orders — SPN Health Mix",
  description: "View your past orders, status, and receipts.",
};

export default function AccountOrdersPage() {
  return <OrdersList />;
}
