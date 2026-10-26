"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute safe redirect destination
  const rawRedirect = searchParams.get("redirect_url") || "/";
  let redirectUrl = "/";
  try {
    if (rawRedirect.startsWith("http://") || rawRedirect.startsWith("https://")) {
      const parsed = new URL(rawRedirect);
      redirectUrl = parsed.pathname + parsed.search;
    } else if (rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\")) {
      redirectUrl = rawRedirect;
    }
  } catch {
    redirectUrl = "/";
  }

  const addParam = searchParams.get("add");
  if (addParam && !redirectUrl.includes("add=")) {
    redirectUrl += (redirectUrl.includes("?") ? "&" : "?") + `add=${encodeURIComponent(addParam)}`;
  }
  const qtyParam = searchParams.get("qty");
  if (qtyParam && !redirectUrl.includes("qty=")) {
    redirectUrl += (redirectUrl.includes("?") ? "&" : "?") + `qty=${encodeURIComponent(qtyParam)}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        return;
      }

      // Success: redirect user to intended page or storefront
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      console.error("Sign in submission error:", err);
      setError("A connection error occurred. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12 lg:py-20 flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex flex-col items-center group mb-2 rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
          >
            <Image
              src="/logo.png"
              alt="SPN Health Mix Emblem"
              width={64}
              height={64}
              priority
              className="w-16 h-16 rounded-full object-contain drop-shadow-md mb-2.5 transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-[family-name:var(--font-logo)] text-xl sm:text-[21px] lg:text-[22px] font-normal tracking-tight text-[var(--color-brand-primary)] leading-none">
              SPN Health Mix
            </span>
          </Link>
          <h1 className="font-heading text-3xl font-normal text-[var(--color-text-primary)]">
            Welcome Back
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1.5">
            Sign in to access your orders, saved addresses, and cart
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] rounded-[12px] p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full h-11 px-3.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
                >
                  Password
                </label>
                <Link
                  href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : "/forgot-password"}
                  className="text-xs font-medium text-[var(--color-brand-primary)] hover:underline focus-visible:outline-none"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3.5 pr-11 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-semibold rounded-[8px] transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Signing In..." : "Sign In"}</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Don&apos;t have an account?{" "}
              <Link
                href={redirectUrl !== "/" ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}` : "/sign-up"}
                className="font-semibold text-[var(--color-brand-primary)] hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
