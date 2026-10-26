import { getTxDb } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { getEmailProvider } from "@/lib/email/provider";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return Response.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: "Database configuration missing." }, { status: 500 });
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
      return Response.json({
        success: true,
        message: "If an account exists with this email address, a password reset link has been sent.",
      });
    } finally {
      await close();
    }
  } catch (err) {
    console.error("Forgot password error:", err);
    return Response.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
