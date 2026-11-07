import type { Metadata } from "next";
import { ComboOffersManager } from "@/components/admin/combo-offers-manager";

export const metadata: Metadata = {
  title: "Combo Offers — SPN Health Mix Admin",
  description: "Manage homepage carousel promotional posters and combo offer banners.",
};

export default function AdminComboOffersPage() {
  return <ComboOffersManager />;
}
