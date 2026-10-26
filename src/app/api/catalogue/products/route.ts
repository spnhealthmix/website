import { getPublicDeps } from "@/lib/api/deps";
import { publicProducts } from "@/lib/api/public-api";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => publicProducts(req, getPublicDeps());
