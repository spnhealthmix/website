import type { Metadata } from "next";
import { ReviewsManager } from "@/components/admin/reviews-manager";

export const metadata: Metadata = {
  title: "Customer Reviews & Moderation — SPN Health Mix Admin",
  description: "Moderate product ratings and customer reviews, audit feedback, and manage verified purchases.",
};

export default function AdminReviewsPage() {
  return <ReviewsManager />;
}
