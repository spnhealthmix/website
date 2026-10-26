import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AccountHeader } from "@/components/account/account-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Account — SPN Health Mix",
  description: "Manage your personal profile, view past orders, and manage saved delivery addresses.",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/account/profile");
  }

  const displayName = user.name?.trim()
    ? user.name.trim()
    : user.email
    ? user.email.split("@")[0]
    : "Customer";

  return (
    <div className="w-full bg-[#FAF6F1]/50 min-h-[calc(100vh-140px)]">
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-9 font-[family-name:var(--font-body)]">
        {/* Dynamic Account Header with Breadcrumbs, Heading, Subtitle & Botanical Art */}
        <AccountHeader displayName={displayName} />

        {/* Main Content Area: Full width single-column layout */}
        <main className="w-full min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
