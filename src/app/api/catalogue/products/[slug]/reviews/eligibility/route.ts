import { getCustomerDeps } from "@/lib/api/deps";
import { getProductReviewEligibility } from "@/lib/api/customer-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = async (req: Request, { params }: Ctx) =>
  getProductReviewEligibility(req, getCustomerDeps(req), (await params).slug);
