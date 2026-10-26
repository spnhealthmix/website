import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = {
  title: "Add Product — SPN Health Mix Admin",
  description: "Create a new product in the SPN Health Mix catalogue.",
};

export default function AdminNewProductPage() {
  return <ProductForm />;
}
