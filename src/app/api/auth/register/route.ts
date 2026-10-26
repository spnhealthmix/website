import { eq } from "drizzle-orm";
import { getTxDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { normalizeEmail, profileEmailMatches } from "@/lib/auth/email";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { createSession, serializeSessionCookie } from "@/lib/auth/session";
import {
  extractGuestCartFromRequest,
  mergeGuestCartIntoUser,
  serializeClearGuestCartCookie,
} from "@/lib/cart/guest-cart";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, confirmPassword } = body;

    // Validate inputs
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "Please enter your name." }, { status: 400 });
    }
    const cleanedName = name.replace(/[\r\n\t\0]/g, " ").trim();
    if (cleanedName.length === 0) {
      return Response.json({ error: "Please enter a valid name." }, { status: 400 });
    }
    if (cleanedName.length > 100) {
      return Response.json({ error: "Name cannot exceed 100 characters." }, { status: 400 });
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return Response.json({ error: "Password is required." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return Response.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      return Response.json({ error: policy.error }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: "Database configuration missing." }, { status: 500 });
    }

    const { db, close } = getTxDb(databaseUrl);
    try {
      // Check for existing profile
      const matchingProfiles = await db
        .select()
        .from(profiles)
        .where(profileEmailMatches(normalizedEmail))
        .limit(2);

      if (matchingProfiles.length > 1) {
        return Response.json(
          { error: "Unable to create account with this email address." },
          { status: 409 }
        );
      }
      const existing = matchingProfiles[0];

      if (existing) {
        if (existing.deletedAt) {
          return Response.json(
            { error: "Unable to create account with this email address." },
            { status: 400 }
          );
        }

        if (existing.passwordHash) {
          return Response.json(
            { error: "An account with this email address already exists. Please sign in." },
            { status: 409 }
          );
        }

        return Response.json(
          {
            error: "An account already exists with this email. Use password recovery to verify ownership and set a password.",
            needsPasswordSetup: true,
          },
          { status: 409 }
        );
      }

      // New registration: strictly assigns 'customer' role
      const passwordHash = await hashPassword(password);
      const [newProfile] = await db
        .insert(profiles)
        .values({
          email: normalizedEmail,
          name: cleanedName,
          passwordHash,
          role: "customer", // Enforce customer role unconditionally
        })
        .returning({
          id: profiles.id,
          email: profiles.email,
          name: profiles.name,
          role: profiles.role,
        });

      const { sessionToken, expiresAt } = await createSession(db, newProfile.id);
      const cookieHeader = serializeSessionCookie(sessionToken, expiresAt);

      // Merge guest cart items into customer cart if present
      const guestItems = extractGuestCartFromRequest(req);
      if (guestItems.length > 0) {
        await mergeGuestCartIntoUser(db, newProfile.id, guestItems);
      }

      const responseHeaders = new Headers();
      responseHeaders.append("Set-Cookie", cookieHeader);
      if (guestItems.length > 0) {
        responseHeaders.append("Set-Cookie", serializeClearGuestCartCookie());
      }

      return Response.json(
        {
          success: true,
          user: newProfile,
        },
        {
          status: 201,
          headers: responseHeaders,
        }
      );
    } finally {
      await close();
    }
  } catch (err: any) {
    console.error("Registration error:", err);
    return Response.json(
      { error: "An unexpected error occurred during registration. Please try again." },
      { status: 500 }
    );
  }
}
