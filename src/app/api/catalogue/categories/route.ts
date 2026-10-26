import { getPublicDeps } from "@/lib/api/deps";
import { publicCategories } from "@/lib/api/public-api";

export const dynamic = "force-dynamic";
export const GET = (req: Request) => publicCategories(req, getPublicDeps());
