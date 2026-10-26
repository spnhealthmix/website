import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/categories-manager";

export const metadata: Metadata = {
  title: "Categories — SPN Health Mix Admin",
  description: "Manage product categories, slug assignments, and hierarchy.",
};

export default function AdminCategoriesPage() {
  return <CategoriesManager />;
}
