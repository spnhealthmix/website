import { getPublicDeps } from "@/lib/api/deps";
import { publicBusinessInfo } from "@/lib/api/public-api";

export const dynamic = "force-dynamic";

export const GET = async (req: Request) => publicBusinessInfo(req, getPublicDeps());
