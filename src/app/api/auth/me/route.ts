import { getTxDb } from "@/lib/db";
import { extractSessionTokenFromRequest, validateSession } from "@/lib/auth/session";
import { createRequestLogger, REQUEST_ID_HEADER, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/auth/me");
  const token = extractSessionTokenFromRequest(req);
  if (!token) {
    return Response.json(
      { authenticated: false, user: null },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return Response.json(
      { authenticated: false, user: null },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }

  const { db, close } = getTxDb(databaseUrl);
  try {
    const validated = await validateSession(db, token);
    if (!validated) {
      return Response.json(
        { authenticated: false, user: null },
        { headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    return Response.json(
      {
        authenticated: true,
        user: validated.profile,
      },
      {
        headers: { [REQUEST_ID_HEADER]: requestId },
      }
    );
  } catch (err) {
    logError(logger, err, "Auth me check error");
    return Response.json(
      { authenticated: false, user: null },
      { headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  } finally {
    await close();
  }
}
