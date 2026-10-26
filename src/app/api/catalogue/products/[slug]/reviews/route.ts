import { getPublicDeps, getCustomerDeps } from "@/lib/api/deps";
import { publicProductReviews } from "@/lib/api/public-api";
import { postProductReview } from "@/lib/api/customer-api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = async (req: Request, { params }: Ctx) =>
  publicProductReviews(req, getPublicDeps(), (await params).slug);

export const POST = async (req: Request, { params }: Ctx) =>
  postProductReview(req, getCustomerDeps(req), (await params).slug);
