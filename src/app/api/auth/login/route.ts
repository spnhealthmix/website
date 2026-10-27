import { getTxDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { normalizeEmail, profileEmailMatches } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, serializeSessionCookie } from "@/lib/auth/session";
import {
  extractGuestCartFromRequest,
  mergeGuestCartIntoUser,
  serializeClearGuestCartCookie,
} from "@/lib/cart/guest-cart";
import { checkEndpointRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Please provide a valid JSON request." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Please enter your email and password." }, { status: 400 });
  }

  const { email, password } = body as Record<string, unknown>;
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 128
  ) {
    return Response.json({ error: "Please enter a valid email and password." }, { status: 400 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }

  // Rate limiting: 20 per 5 min per IP, 5 per 1 min per normalized account
  const rateLimit = await checkEndpointRateLimit(req, {
    endpoint: "customer_login",
    ipLimit: { limit: 20, windowSeconds: 300 },
    idLimit: { identifier: normalizeEmail(email), limit: 5, windowSeconds: 60 },
    databaseUrl,
  });

  if (!rateLimit.allowed) {
    if (rateLimit.reason === "limiter_unavailable") {
      return Response.json(
        { error: "Authentication is temporarily unavailable. Please try again shortly." },
        {
          status: 503,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }
    return Response.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      }
    );
  }

  try {
    const { db, close } = getTxDb(databaseUrl);
    try {
      const matchingUsers = await db
        .select()
        .from(profiles)
        .where(profileEmailMatches(normalizeEmail(email)))
        .limit(2);
      const user = matchingUsers.length === 1 ? matchingUsers[0] : null;

      if (!user || user.deletedAt || !user.passwordHash) {
        return Response.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return Response.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      const { sessionToken, expiresAt } = await createSession(db, user.id);
      const cookieHeader = serializeSessionCookie(sessionToken, expiresAt);

      // Merge guest cart items into customer cart if present
      const guestItems = extractGuestCartFromRequest(req);
      if (guestItems.length > 0) {
        await mergeGuestCartIntoUser(db, user.id, guestItems);
      }

      const responseHeaders = new Headers();
      responseHeaders.append("Set-Cookie", cookieHeader);
      if (guestItems.length > 0) {
        responseHeaders.append("Set-Cookie", serializeClearGuestCartCookie());
      }

      return Response.json(
        {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
        {
          status: 200,
          headers: responseHeaders,
        }
      );
    } finally {
      await close();
    }
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err && typeof err.code === "string"
        ? err.code
        : undefined;
    console.error("Login request failed.", {
      name: err instanceof Error ? err.name : "UnknownError",
      ...(code ? { code } : {}),
    });
    if (code === "42703" || code === "42P01") {
      return Response.json(
        { error: "Authentication is temporarily unavailable." },
        { status: 503 }
      );
    }
    return Response.json(
      { error: "An unexpected error occurred during sign in. Please try again." },
      { status: 500 }
    );
  }
}
