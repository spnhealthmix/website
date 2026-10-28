import type { Metadata } from "next";
import { ComboOffersView } from "@/components/offers/combo-offers-view";
import { fetchComboOffersData } from "@/lib/storefront/api";

export const metadata: Metadata = {
  title: "Combo Offers — Festival Specials & Hampers | SPN Health Mix",
  description:
    "Explore our special promotional festival combos: 12-item Family Combo Offer, Fast Moving Sweet Laddu's Combo, Spicy Podi Varieties Combo, and crispy Nendram Banana Chips.",
  alternates: { canonical: "/combo-offers" },
};

// Revalidate combo offers data every 60 seconds
export const revalidate = 60;

export default async function ComboOffersPage() {
  const comboData = await fetchComboOffersData();

  return (
    <main className="w-full min-h-screen bg-[#FFFBF7]">
      <ComboOffersView comboData={comboData} />
    </main>
  );
}
