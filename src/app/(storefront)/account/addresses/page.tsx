import type { Metadata } from "next";
import { AccountAddresses } from "@/components/account/account-addresses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Saved Addresses — SPN Health Mix",
  description: "Manage your delivery destinations for quick checkout.",
};

export default function AccountAddressesPage() {
  return <AccountAddresses />;
}
