import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Panel — SPN Health Mix",
  description: "Operational management for SPN Health Mix products, stock, categories, and customer orders.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";

  // Bypass layout guard for the dedicated admin login page
  if (pathname === "/admin/login") {
    return <div className="min-h-screen bg-[#FFFBF7]">{children}</div>;
  }

  const authResult = await verifyAdminSession();

  if (!authResult.authorized) {
    if (authResult.reason === "UNAUTHENTICATED") {
      redirect("/admin/login");
    }

    // Authenticated non-admin: reject server-side
    return (
      <div className="min-h-screen bg-[#FFFBF7] flex items-center justify-center p-6 font-[family-name:var(--font-body)]">
        <div className="max-w-md w-full bg-white border border-[#E8DFD4] rounded-2xl p-8 shadow-xs text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[#1A1614] mb-2">
            Access Restricted
          </h1>
          <p className="text-sm text-[#635850] mb-6">
            Admin access required. Your account is not authorized to access internal administrative controls.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-xs"
            >
              Return to Storefront
            </Link>
            <Link
              href="/account/profile"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#E8DFD4] bg-[#FAF5EF] text-[#1A1614] hover:bg-white transition-colors"
            >
              Customer Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-[#1A1614] font-[family-name:var(--font-body)] lg:flex">
      {/* Sidebar Navigation */}
      <AdminNav profile={authResult.profile} />

      {/* Main Administrative Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-[#FFFBF7]">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
