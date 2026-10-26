import { getOrder } from "@/lib/api/customer-api";
import { getCustomerDeps } from "@/lib/api/deps";

export const dynamic = "force-dynamic";

interface RouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteProps) {
  const { id } = await params;
  const deps = getCustomerDeps(req);
  return getOrder(req, deps, id);
}
