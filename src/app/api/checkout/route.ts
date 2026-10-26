import { postCheckout } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const deps = getCustomerDeps(req);
  return postCheckout(req, deps);
}
