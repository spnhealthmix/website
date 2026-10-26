"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

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

  // Password policy feedback
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsPasswordSetup(false);

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please provide a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!hasLetter || !hasDigit) {
      setError("Password must contain at least one letter and one number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed. Please check your details.");
        setNeedsPasswordSetup(Boolean(data.needsPasswordSetup));
        return;
      }

      // Success: automatically signed in with session cookie, redirect
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      console.error("Registration submission error:", err);
      setError("A connection error occurred. Please check your connection and try again.");
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
            Create an Account
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1.5">
            Join SPN Health Mix for faster checkout and order tracking
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] rounded-[12px] p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {needsPasswordSetup && (
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent(email)}`}
                    className="inline-block mt-2 font-semibold text-[var(--color-brand-primary)] underline hover:text-[var(--color-brand-primary-dark)]"
                  >
                    Send a password recovery link
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Ramanathan"
                className="w-full h-11 px-3.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent transition"
              />
            </div>

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
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-11 px-3.5 pr-11 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirement Hints */}
            {password.length > 0 && (
              <div className="p-3 bg-[var(--color-surface-sunken)]/60 rounded-[8px] space-y-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasMinLength ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className={hasMinLength ? "text-emerald-800" : "text-[var(--color-text-muted)]"}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${hasLetter && hasDigit ? "text-emerald-600" : "text-gray-400"}`} />
                  <span className={hasLetter && hasDigit ? "text-emerald-800" : "text-[var(--color-text-muted)]"}>
                    Contains letters and numbers
                  </span>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${passwordsMatch ? "text-emerald-600" : "text-gray-400"}`} />
                    <span className={passwordsMatch ? "text-emerald-800" : "text-[var(--color-text-muted)]"}>
                      Passwords match
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-semibold rounded-[8px] transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Already have an account?{" "}
              <Link
                href={redirectUrl !== "/" ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}` : "/sign-in"}
                className="font-semibold text-[var(--color-brand-primary)] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
