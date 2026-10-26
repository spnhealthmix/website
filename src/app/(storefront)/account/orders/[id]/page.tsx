import type { Metadata } from "next";
import { OrderDetailView } from "@/components/account/order-detail-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Details — SPN Health Mix",
  description: "View itemized summary, payment status, and shipping information for this order.",
};

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return <OrderDetailView orderId={id} />;
}
