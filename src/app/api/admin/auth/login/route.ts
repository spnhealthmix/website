import { getTxDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { normalizeEmail, profileEmailMatches } from "@/lib/auth/email";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, serializeSessionCookie } from "@/lib/auth/session";
import { checkEndpointRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return Response.json(
        { error: "Please enter your administrative email and password." },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeEmail(email);
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: "Database configuration missing." }, { status: 500 });
    }

    // Rate limiting: 10 per 15 min per IP, 5 per 15 min per admin account
    const rateLimit = await checkEndpointRateLimit(req, {
      endpoint: "admin_login",
      ipLimit: { limit: 10, windowSeconds: 900 },
      idLimit: { identifier: normalizedEmail, limit: 5, windowSeconds: 900 },
      databaseUrl,
    });

    if (!rateLimit.allowed) {
      if (rateLimit.reason === "limiter_unavailable") {
        return Response.json(
          { error: "Administrative sign in is temporarily unavailable. Please try again shortly." },
          {
            status: 503,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds),
            },
          }
        );
      }
      return Response.json(
        { error: "Too many administrative login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const { db, close } = getTxDb(databaseUrl);
    try {
      const matchingUsers = await db
        .select()
        .from(profiles)
        .where(profileEmailMatches(normalizedEmail))
        .limit(2);
      const user = matchingUsers.length === 1 ? matchingUsers[0] : null;

      if (!user || user.deletedAt) {
        return Response.json(
          { error: "Invalid administrative credentials." },
          { status: 401 }
        );
      }

      // Role check: strictly require 'admin' role
      if (user.role !== "admin") {
        return Response.json(
          { error: "Admin access required. Customer accounts are not authorized." },
          { status: 403 }
        );
      }

      if (!user.passwordHash) {
        return Response.json(
          { error: "Administrative account requires password provisioning. Run the admin setup script." },
          { status: 401 }
        );
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return Response.json(
          { error: "Invalid administrative credentials." },
          { status: 401 }
        );
      }

      const { sessionToken, expiresAt } = await createSession(db, user.id);
      const cookieHeader = serializeSessionCookie(sessionToken, expiresAt);

      return Response.json(
        {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: "admin",
          },
        },
        {
          status: 200,
          headers: {
            "Set-Cookie": cookieHeader,
          },
        }
      );
    } finally {
      await close();
    }
  } catch (err) {
    console.error("Admin login error:", err);
    return Response.json(
      { error: "An unexpected error occurred during administrative sign in." },
      { status: 500 }
    );
  }
}
