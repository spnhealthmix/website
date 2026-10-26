"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing. Please request a new password reset link.");
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
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password reset failed. The link may have expired.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("A connection error occurred. Please try again.");
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
            Create New Password
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1.5">
            Choose a new, secure password for your account
          </p>
        </div>

        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] rounded-[12px] p-6 sm:p-8">
          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-xl font-normal text-[var(--color-text-primary)]">
                Password Reset Complete
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Your password has been securely updated. You can now sign in to your SPN Health Mix account with your new password.
              </p>
              <div className="pt-4">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center w-full h-11 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-semibold rounded-[8px] transition duration-150"
                >
                  Sign In to Your Account
                </Link>
              </div>
            </div>
          ) : (
            <>
              {!token && (
                <div className="mb-6 p-4 rounded-[8px] bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                  No reset token provided. Please use the link sent to your email or{" "}
                  <Link href="/forgot-password" className="font-semibold underline">
                    request a new reset link
                  </Link>.
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
                  >
                    New Password
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
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
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
                  disabled={loading || !token}
                  className="w-full h-11 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-semibold rounded-[8px] transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer mt-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Resetting Password..." : "Update Password"}</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
