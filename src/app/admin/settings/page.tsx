import type { Metadata } from "next";
import { SettingsManager } from "@/components/admin/settings-manager";

export const metadata: Metadata = {
  title: "Business Settings — SPN Health Mix Admin",
  description: "Manage official business information, contact details, and statutory registrations.",
};

export default function AdminSettingsPage() {
  return <SettingsManager />;
}
