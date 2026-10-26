import { patchAddress, removeAddress } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteProps) {
  const { id } = await params;
  const deps = getCustomerDeps(req);
  return patchAddress(req, deps, id);
}

export async function DELETE(req: Request, { params }: RouteProps) {
  const { id } = await params;
  const deps = getCustomerDeps(req);
  return removeAddress(req, deps, id);
}
