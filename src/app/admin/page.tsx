import type { Metadata } from "next";
import { verifyAdminSession } from "@/lib/admin/auth";
import { DashboardView } from "@/components/admin/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard — SPN Health Mix Admin | SPN Health Mix",
  description: "Operational overview of orders, inventory, and fulfillment.",
};

export default async function AdminDashboardPage() {
  const authResult = await verifyAdminSession();
  const profile = authResult.authorized ? authResult.profile : null;

  return <DashboardView profile={profile} />;
}
