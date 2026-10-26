import { getMe, patchMe } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deps = getCustomerDeps(req);
  return getMe(req, deps);
}

export async function PATCH(req: Request) {
  const deps = getCustomerDeps(req);
  return patchMe(req, deps);
}
