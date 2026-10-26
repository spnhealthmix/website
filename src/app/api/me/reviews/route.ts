import { getCustomerDeps } from "@/lib/api/deps";
import { getMyReviews } from "@/lib/api/customer-api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deps = getCustomerDeps(req);
  return getMyReviews(req, deps);
}
