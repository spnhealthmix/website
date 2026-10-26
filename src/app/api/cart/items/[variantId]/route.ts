import { putCartItem, deleteCartItem } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ variantId: string }>;
}

export async function PUT(req: Request, { params }: RouteProps) {
  const { variantId } = await params;
  const deps = getCustomerDeps(req);
  return putCartItem(req, deps, variantId);
}

export async function PATCH(req: Request, { params }: RouteProps) {
  const { variantId } = await params;
  const deps = getCustomerDeps(req);
  return putCartItem(req, deps, variantId);
}

export async function DELETE(req: Request, { params }: RouteProps) {
  const { variantId } = await params;
  const deps = getCustomerDeps(req);
  return deleteCartItem(req, deps, variantId);
}
