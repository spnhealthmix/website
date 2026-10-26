import { getTxDb } from "@/lib/db";
import {
  extractSessionTokenFromRequest,
  invalidateSession,
  serializeClearSessionCookie,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = extractSessionTokenFromRequest(req);
  const databaseUrl = process.env.DATABASE_URL;

  if (token && databaseUrl) {
    try {
      const { db, close } = getTxDb(databaseUrl);
      try {
        await invalidateSession(db, token);
      } finally {
        await close();
      }
    } catch (err) {
      console.error("Logout session invalidation error:", err);
    }
  }

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": serializeClearSessionCookie(),
      },
    }
  );
}
