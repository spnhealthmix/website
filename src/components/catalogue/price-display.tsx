import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PriceDisplayProps {
  pricePaise: number;
  mrpPaise?: number;
  discountPercent?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  prefix?: string;
}

export function PriceDisplay({
  pricePaise,
  mrpPaise,
  discountPercent,
  size = "md",
  className,
  prefix,
}: PriceDisplayProps) {
  const hasDiscount = Boolean(
    typeof discountPercent === "number" &&
    discountPercent > 0 &&
    typeof mrpPaise === "number" &&
    mrpPaise > pricePaise
  );

  const priceStyles = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  const mrpStyles = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <span
        className={cn(
          "font-[family-name:var(--font-price)] font-semibold text-[var(--color-text-primary)]",
          priceStyles[size]
        )}
      >
        {prefix ? `${prefix}${formatPrice(pricePaise)}` : formatPrice(pricePaise)}
      </span>

      {hasDiscount && mrpPaise ? (
        <>
          <span
            className={cn(
              "font-[family-name:var(--font-price)] font-normal text-[var(--color-text-muted)] line-through",
              mrpStyles[size]
            )}
            aria-label={`Original price ${formatPrice(mrpPaise)}`}
          >
            {formatPrice(mrpPaise)}
          </span>
          <span
            className="font-[family-name:var(--font-price)] font-semibold text-xs text-white bg-[var(--color-error)] rounded-[4px] px-1.5 py-0.5 leading-none"
            aria-label={`${discountPercent}% discount`}
          >
            {discountPercent}% off
          </span>
        </>
      ) : null}
    </div>
  );
}
