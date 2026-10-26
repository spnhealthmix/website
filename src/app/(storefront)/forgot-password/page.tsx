"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please provide a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to process request. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch (err) {
      console.error("Forgot password error:", err);
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
            Reset Your Password
          </h1>
          <p className="font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)] mt-1.5">
            Enter your email to receive a secure password reset link
          </p>
        </div>

        {/* Content Box */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] rounded-[12px] p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-xl font-normal text-[var(--color-text-primary)]">
                Check Your Inbox
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                If an account exists for <span className="font-semibold text-[var(--color-text-primary)]">{email}</span>,
                we have sent instructions with a secure link to reset your password.
              </p>
              <div className="pt-4 border-t border-[var(--color-border)]">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-primary)] hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="flex-1">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
                  >
                    Account Email
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] text-white text-sm font-semibold rounded-[8px] transition duration-150 flex items-center justify-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{loading ? "Sending Link..." : "Send Reset Link"}</span>
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-center">
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
