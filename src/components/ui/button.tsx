import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // base styles
  "inline-flex items-center justify-center gap-2 font-[family-name:var(--font-body)] font-semibold text-base transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-brand-primary)] text-white rounded-[8px] hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98]",
        secondary:
          "bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-primary)] rounded-[8px] hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]",
        ghost:
          "bg-transparent text-[var(--color-brand-primary)] rounded-[8px] hover:bg-[var(--color-brand-primary-light)]",
        destructive:
          "bg-transparent border border-[var(--color-error)] text-[var(--color-error)] rounded-[8px] hover:bg-[var(--color-error-bg)]",
        icon:
          "bg-transparent text-[var(--color-text-body)] rounded-[4px] hover:bg-[var(--color-surface-sunken)]",
      },
      size: {
        sm:   "h-9 px-4 text-sm",
        md:   "h-12 px-6",
        lg:   "h-14 px-8 text-lg",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden="true"
            />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
