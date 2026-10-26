import { getPublicDeps } from "@/lib/api/deps";
import { publicProduct } from "@/lib/api/public-api";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ slug: string }> };
export const GET = async (req: Request, { params }: Ctx) => publicProduct(req, getPublicDeps(), (await params).slug);
