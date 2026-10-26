import type { Metadata } from "next";
import { CouponsManager } from "@/components/admin/coupons-manager";

export const metadata: Metadata = {
  title: "Coupon Codes — SPN Health Mix Admin",
  description: "Manage discount coupons, minimum orders, usage caps, and validity.",
};

export default function AdminCouponsPage() {
  return <CouponsManager />;
}
