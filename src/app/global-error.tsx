"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center p-4 font-sans bg-gray-50 text-gray-900">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Something went wrong!</h2>
          <p className="text-gray-600 mb-6 text-sm">
            An unexpected error occurred. Our engineering team has been notified.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-emerald-700 text-white font-medium rounded hover:bg-emerald-800 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

