import type { Metadata } from "next";
import { AccountReviews } from "@/components/account/account-reviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Reviews — SPN Health Mix",
  description: "View and manage your product reviews, ratings, and verified purchases.",
};

export default function AccountReviewsPage() {
  return <AccountReviews />;
}
