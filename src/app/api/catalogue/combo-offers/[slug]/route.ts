import { getPublicDeps } from "@/lib/api/deps";
import { publicComboOfferBySlug } from "@/lib/api/public-api";

export const dynamic = "force-dynamic";

export const GET = (req: Request, { params }: { params: Promise<{ slug: string }> }) =>
  params.then(({ slug }) => publicComboOfferBySlug(req, getPublicDeps(req), slug));

