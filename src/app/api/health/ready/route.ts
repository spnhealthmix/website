import { createRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { checkReadiness } from "@/lib/health";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json",
};

/**
 * Readiness Probe: GET /api/health/ready
 *
 * Verifies that the application is ready to serve production traffic by verifying
 * core database connectivity with a lightweight query (SELECT 1) and strict timeout.
 *
 * Returns:
 * - 200 OK: { "status": "ready", "checks": { "database": "ok" } }
 * - 503 Service Unavailable: { "status": "not_ready", "checks": { "database": "unavailable" } }
 *
 * Security: Never returns raw errors, connection strings, hostnames, or internal stack traces.
 */
export async function GET(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/health/ready");

  const result = await checkReadiness();

  if (result.ready) {
    return new Response(
      JSON.stringify({
        status: "ready",
        checks: {
          database: "ok",
        },
      }),
      {
        status: 200,
        headers: {
          ...CACHE_HEADERS,
          [REQUEST_ID_HEADER]: requestId,
        },
      },
    );
  }

  logger.warn(
    { durationMs: result.durationMs, check: "database" },
    "Readiness check failed: database unavailable",
  );

  return new Response(
    JSON.stringify({
      status: "not_ready",
      checks: {
        database: "unavailable",
      },
    }),
    {
      status: 503,
      headers: {
        ...CACHE_HEADERS,
        [REQUEST_ID_HEADER]: requestId,
      },
    },
  );
}

export async function HEAD(req: Request) {
  return GET(req);
}

export async function POST(req: Request) {
  return methodNotAllowed(req);
}

export async function PUT(req: Request) {
  return methodNotAllowed(req);
}

export async function DELETE(req: Request) {
  return methodNotAllowed(req);
}

export async function PATCH(req: Request) {
  return methodNotAllowed(req);
}

function methodNotAllowed(req: Request) {
  const { requestId } = createRequestLogger(req, "/api/health/ready");
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: {
      ...CACHE_HEADERS,
      Allow: "GET, HEAD",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

