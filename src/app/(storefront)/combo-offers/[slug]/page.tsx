import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComboOfferDetailView } from "@/components/offers/combo-offer-detail-view";
import { fetchActiveComboOffers, fetchComboOfferBySlug } from "@/lib/storefront/api";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const combo = await fetchComboOfferBySlug(slug);

  if (!combo) {
    return {
      title: "Combo Offer Not Found | SPN Health Mix",
    };
  }

  const title = `${combo.name} — Special Combo Offer | SPN Health Mix`;
  const description =
    combo.shortDescription ||
    combo.description ||
    `Order the exclusive ${combo.name} from SPN Health Mix. Traditional ingredients, freshly packed, value pricing.`;

  return {
    title,
    description,
    alternates: { canonical: `/combo-offers/${slug}` },
    openGraph: {
      title,
      description,
      images: combo.imageUrl ? [{ url: combo.imageUrl }] : undefined,
    },
  };
}

export default async function ComboOfferDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [combo, allCombos] = await Promise.all([
    fetchComboOfferBySlug(slug),
    fetchActiveComboOffers(),
  ]);

  if (!combo) {
    notFound();
  }

  return (
    <main className="w-full min-h-screen bg-[#FFFBF7]">
      <ComboOfferDetailView combo={combo} otherCombos={allCombos} />
    </main>
  );
}

