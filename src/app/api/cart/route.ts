import { getCartH, deleteCart } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deps = getCustomerDeps(req);
  return getCartH(req, deps);
}

export async function DELETE(req: Request) {
  const deps = getCustomerDeps(req);
  return deleteCart(req, deps);
}
