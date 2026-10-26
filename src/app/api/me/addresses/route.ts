import { getAddresses, postAddress } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deps = getCustomerDeps(req);
  return getAddresses(req, deps);
}

export async function POST(req: Request) {
  const deps = getCustomerDeps(req);
  return postAddress(req, deps);
}
