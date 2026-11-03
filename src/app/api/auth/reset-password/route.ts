import { getTxDb } from "@/lib/db";
import { verifyAndConsumePasswordResetToken } from "@/lib/auth/password-reset";
import { createRequestLogger, REQUEST_ID_HEADER, logError } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/auth/reset-password");
  try {
    const { token, password, confirmPassword } = await req.json();

    if (!token || typeof token !== "string") {
      return Response.json(
        { error: "Reset token is missing or invalid." },
        { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    if (!password || typeof password !== "string") {
      return Response.json(
        { error: "Password is required." },
        { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    if (password !== confirmPassword) {
      return Response.json(
        { error: "Passwords do not match." },
        { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return Response.json(
        { error: "Database configuration missing." },
        { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const { db, close } = getTxDb(databaseUrl);
    try {
      const result = await verifyAndConsumePasswordResetToken(db, token, password);
      if (!result.success) {
        return Response.json(
          { error: result.error || "Password reset failed." },
          { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
        );
      }

      logger.info("Password reset successfully completed");

      return Response.json(
        {
          success: true,
          message: "Your password has been successfully reset. You may now sign in.",
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
      route: "/api/auth/reset-password",
      method: "POST",
    });
    logError(logger, err, "Password reset error");
    return Response.json(
      { error: "An unexpected error occurred during password reset." },
      { status: 500, headers: { [REQUEST_ID_HEADER]: requestId } }
    );
  }
}
