import { getCustomerDeps } from "@/lib/api/deps";
import { deleteMyReview, patchMyReview } from "@/lib/api/customer-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = async (req: Request, { params }: Ctx) =>
  patchMyReview(req, getCustomerDeps(req), (await params).id);

export const DELETE = async (req: Request, { params }: Ctx) =>
  deleteMyReview(req, getCustomerDeps(req), (await params).id);
