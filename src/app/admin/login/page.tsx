"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft } from "lucide-react";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawRedirect = searchParams.get("redirect_url") || "/admin";
  const redirectUrl =
    rawRedirect.startsWith("/admin") && !rawRedirect.startsWith("//") && !rawRedirect.startsWith("/\\")
      ? rawRedirect
      : "/admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your admin email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Invalid administrative credentials.");
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      console.error("Admin sign in error:", err);
      setError("A connection error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-cream)] flex flex-col justify-center items-center px-4 py-12 font-[family-name:var(--font-body)]">
      <div className="w-full max-w-md">
        {/* Admin Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center group mb-4">
            <Image
              src="/logo.png"
              alt="SPN Health Mix Emblem"
              width={64}
              height={64}
              priority
              className="w-16 h-16 rounded-full object-contain drop-shadow-md mb-2 transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-[family-name:var(--font-logo)] text-xl sm:text-[21px] lg:text-[22px] font-normal tracking-tight text-[var(--color-brand-primary)] leading-none">
              SPN Health Mix
            </span>
          </Link>

          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Sign in to manage catalogue, stock, orders, and store settings
          </p>

          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-sm mb-2">
            <Shield className="w-4 h-4 text-[var(--color-brand-primary)]" />
            <h1 className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold text-[var(--color-text-primary)]">
              Admin Control Panel
            </h1>
          </div>
          
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-md rounded-[12px] p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-[8px] bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Administrative Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@spnhealthmix.in"
                className="w-full h-11 px-3.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-11 px-3.5 pr-11 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface-canvas)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
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
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-[8px] transition duration-150 flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? "Authenticating..." : "Sign In to Admin"}</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-muted)] space-y-3">
            <p>
              Administrative accounts are provisioned via secure server CLI. Customer accounts are rejected.
            </p>
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-[var(--color-brand-primary)] hover:underline font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Storefront</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-cream)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-brand-primary)]" />
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
