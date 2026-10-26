import { getTxDb } from "@/lib/db";
import { verifyAndConsumePasswordResetToken } from "@/lib/auth/password-reset";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { token, password, confirmPassword } = await req.json();

    if (!token || typeof token !== "string") {
      return Response.json({ error: "Reset token is missing or invalid." }, { status: 400 });
    }

    if (!password || typeof password !== "string") {
      return Response.json({ error: "Password is required." }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return Response.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json({ error: "Database configuration missing." }, { status: 500 });
    }

    const { db, close } = getTxDb(databaseUrl);
    try {
      const result = await verifyAndConsumePasswordResetToken(db, token, password);
      if (!result.success) {
        return Response.json({ error: result.error || "Password reset failed." }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Your password has been successfully reset. You may now sign in.",
      });
    } finally {
      await close();
    }
  } catch (err) {
    console.error("Password reset error:", err);
    return Response.json(
      { error: "An unexpected error occurred during password reset." },
      { status: 500 }
    );
  }
}
