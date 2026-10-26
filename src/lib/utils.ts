import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert paise (integer) to a formatted Indian rupee string: ₹399 */
export function formatPrice(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/** Build an absolute image URL from the R2 base + key. Returns null when key is missing. */
export function buildImageUrl(baseUrl: string | undefined, key: string | null | undefined): string | null {
  if (!key || !baseUrl) return null;
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/${key}`;
}
