"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidthClass = "max-w-[540px]",
}: AdminModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] isolate" role="dialog" aria-modal="true">
      {/* 1. Backdrop: covers entire viewport, 50% dark overlay, prevents background interaction */}
      <div
        className="fixed inset-0 z-[1000] bg-[#0F172A]/50 backdrop-blur-[2px] transition-opacity duration-200"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* 2. Centered positioning container */}
      <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 sm:p-6 overflow-y-auto pointer-events-none">
        {/* 3. Modal Content: solid white, clear shadow, internal scrolling */}
        <div
          className={`relative w-full ${maxWidthClass} max-h-[calc(100vh-48px)] flex flex-col bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-[#E8DFD4] pointer-events-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E8DFD4] bg-[#FFFBF7] shrink-0">
            <div>
              <h2
                className="text-lg sm:text-xl font-bold text-[#1A1614] leading-tight"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {title}
              </h2>
              {description && (
                <p className="text-xs text-[#635850] mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-[#8C7E72] hover:text-[#1A1614] hover:bg-[#FAF5EF] flex items-center justify-center cursor-pointer transition-colors shrink-0 ml-3"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Modal Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

