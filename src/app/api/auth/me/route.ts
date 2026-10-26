import { getTxDb } from "@/lib/db";
import { extractSessionTokenFromRequest, validateSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = extractSessionTokenFromRequest(req);
  if (!token) {
    return Response.json({ authenticated: false, user: null });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return Response.json({ authenticated: false, user: null });
  }

  const { db, close } = getTxDb(databaseUrl);
  try {
    const validated = await validateSession(db, token);
    if (!validated) {
      return Response.json({ authenticated: false, user: null });
    }

    return Response.json({
      authenticated: true,
      user: validated.profile,
    });
  } catch (err) {
    console.error("Auth me check error:", err);
    return Response.json({ authenticated: false, user: null });
  } finally {
    await close();
  }
}
