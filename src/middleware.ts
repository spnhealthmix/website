import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

/**
 * Lightweight edge-compatible middleware for SPN Foods authentication.
 * Checks for the presence of the secure session cookie on protected pages.
 * Full cryptographic and role validation is performed server-side on every protected route.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // 1. Admin route protection
  if (pathname.startsWith("/admin")) {
    // Always allow access to the admin login page
    if (pathname === "/admin/login") {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    if (!hasSession) {
      const redirectUrl = new URL("/admin/login", req.url);
      if (pathname !== "/admin") {
        redirectUrl.searchParams.set("redirect_url", pathname + search);
      }
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // 2. Customer protected routes
  const isProtectedCustomerRoute =
    pathname.startsWith("/account") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/profile");

  if (isProtectedCustomerRoute && !hasSession) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Match protected routes and storefront paths, excluding static assets and internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
