import { getOrders } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deps = getCustomerDeps(req);
  return getOrders(req, deps);
}
