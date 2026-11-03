import { createRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/json",
};

/**
 * Liveness Probe: GET /api/health
 *
 * Confirms that the application process is running and capable of responding to HTTP requests.
 * Independent of the database; returns HTTP 200 with minimal JSON payload.
 */
export async function GET(req: Request) {
  const { requestId } = createRequestLogger(req, "/api/health");

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: {
      ...CACHE_HEADERS,
      [REQUEST_ID_HEADER]: requestId,
    },
  });
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
  const { requestId } = createRequestLogger(req, "/api/health");
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: {
      ...CACHE_HEADERS,
      Allow: "GET, HEAD",
      [REQUEST_ID_HEADER]: requestId,
    },
  });
}

