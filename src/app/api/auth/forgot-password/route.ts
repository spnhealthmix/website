import { getTxDb } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { getEmailProvider } from "@/lib/email/provider";
import { normalizeEmail } from "@/lib/auth/email";
import { checkEndpointRateLimit } from "@/lib/security/rate-limit";
import { createRequestLogger, REQUEST_ID_HEADER, logError } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/auth/forgot-password");
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json(
        { error: "Please provide a valid email address." },
        { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: "Database configuration missing." }, { status: 500 });
    }

    // Rate limiting: 10 per 1 hour per IP, 3 per 1 hour per target email
    const rateLimit = await checkEndpointRateLimit(req, {
      endpoint: "forgot_password",
      ipLimit: { limit: 10, windowSeconds: 3600 },
      idLimit: { identifier: normalizeEmail(email), limit: 3, windowSeconds: 3600 },
      databaseUrl,
    });

    if (!rateLimit.allowed) {
      if (rateLimit.reason === "limiter_unavailable") {
        return Response.json(
          { error: "Password reset service is temporarily unavailable. Please try again shortly." },
          {
            status: 503,
            headers: {
              "Retry-After": String(rateLimit.retryAfterSeconds),
            },
          }
        );
      }
      return Response.json(
        { error: "Too many password reset requests. Please try again later." },
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
      const resetData = await createPasswordResetToken(db, email);

      if (resetData) {
        // Build reset link
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const resetLink = `${siteUrl}/reset-password?token=${encodeURIComponent(resetData.resetToken)}`;

        const emailProvider = getEmailProvider();
        await emailProvider.send({
          to: { email: resetData.email, name: resetData.name },
          subject: "Reset your SPN Health Mix password",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1A1614;">
              <h2 style="color: #BF5330;">SPN Health Mix Password Reset</h2>
              <p>Hello ${resetData.name || "Customer"},</p>
              <p>We received a request to reset your password for your SPN Health Mix account.</p>
              <div style="margin: 32px 0;">
                <a href="${resetLink}" style="background-color: #BF5330; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="font-size: 13px; color: #635850;">This link is single-use and will expire in 1 hour.</p>
              <p style="font-size: 13px; color: #635850;">If you did not request this, please ignore this email. Your account remains secure.</p>
            </div>
          `,
          text: `Reset your SPN Health Mix password by visiting: ${resetLink} (Link expires in 1 hour)`,
        });
      }

      // Always return a generic success message to prevent account enumeration
      logger.info("Password reset request processed");
      return Response.json(
        {
          success: true,
          message: "If an account exists with this email address, a password reset link has been sent.",
        },
        {
          headers: { [REQUEST_ID_HEADER]: requestId },
        }
      );
    } finally {
      await close();
    }
  } catch (err) {
    captureAppException(err, {
      requestId,
      route: "/api/auth/forgot-password",
      method: "POST",
    });
    logError(logger, err, "Forgot password error");
    return Response.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }
}
