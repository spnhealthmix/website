import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "discount" | "lowstock" | "outofstock" | "default";
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  const variants = {
    discount:    "bg-[var(--color-error)] text-white",
    lowstock:    "bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
    outofstock:  "bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)]",
    default:     "bg-[var(--color-brand-primary-light)] text-[var(--color-brand-primary-dark)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center font-[family-name:var(--font-body)] font-semibold text-xs rounded-[4px] px-1.5 py-0.5 leading-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
