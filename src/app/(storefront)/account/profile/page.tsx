import type { Metadata } from "next";
import { ProfileSection } from "@/components/account/profile-section";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile — SPN Health Mix",
  description: "Your personal details and contact information.",
};

export default function AccountProfilePage() {
  return (
    <div>
      <ProfileSection />
    </div>
  );
}
