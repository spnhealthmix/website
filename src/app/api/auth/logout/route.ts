import { getTxDb } from "@/lib/db";
import {
  extractSessionTokenFromRequest,
  invalidateSession,
  serializeClearSessionCookie,
} from "@/lib/auth/session";
import { createRequestLogger, REQUEST_ID_HEADER, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/auth/logout");
  const token = extractSessionTokenFromRequest(req);
  const databaseUrl = process.env.DATABASE_URL;

  if (token && databaseUrl) {
    try {
      const { db, close } = getTxDb(databaseUrl);
      try {
        await invalidateSession(db, token);
        logger.info("User session invalidated successfully");
      } finally {
        await close();
      }
    } catch (err) {
      logError(logger, err, "Logout session invalidation error");
    }
  }

  return Response.json(
    { success: true },
    {
      status: 200,
      headers: {
        "Set-Cookie": serializeClearSessionCookie(),
        [REQUEST_ID_HEADER]: requestId,
      },
    }
  );
}
