import * as Sentry from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "./src/lib/sentry/scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  debug: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,
  beforeSend(event, hint) {
    return scrubSentryEvent(event, hint);
  },
  beforeBreadcrumb(breadcrumb) {
    return scrubSentryBreadcrumb(breadcrumb);
  },
});

