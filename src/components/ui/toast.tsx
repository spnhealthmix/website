"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "pointer-events-auto flex items-start gap-3 p-3.5 rounded-[8px] bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-md)] transition-all animate-in fade-in slide-in-from-bottom-2",
        toast.type === "error" && "border-[var(--color-error)]/30",
        toast.type === "success" && "border-[var(--color-success)]/30"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {toast.type === "success" && <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />}
        {toast.type === "error" && <AlertCircle className="h-4 w-4 text-[var(--color-error)]" />}
        {toast.type === "info" && <Info className="h-4 w-4 text-[var(--color-brand-primary)]" />}
      </div>
      <p className="flex-1 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-primary)] leading-snug">
        {toast.message}
      </p>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-0.5 rounded"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (msg: string) => console.log(msg),
    };
  }
  return context;
}
