import type { Metadata } from "next";
import { OrderDetailView } from "@/components/admin/order-detail-view";

export const metadata: Metadata = {
  title: "Order Details — SPN Health Mix Admin",
  description: "View customer order items, payments, shipment status, and audit history.",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
