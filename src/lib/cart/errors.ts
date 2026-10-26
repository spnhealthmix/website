export type CartErrorCode =
  | "INVALID_QUANTITY" // not a positive integer
  | "QUANTITY_LIMIT" // would exceed the per-line maximum
  | "CART_LINE_LIMIT" // too many different items
  | "VARIANT_UNAVAILABLE" // doesn't exist, or product/variant is inactive
  | "INSUFFICIENT_STOCK"; // more than is currently in stock (nothing is reserved)

export class CartError extends Error {
  constructor(
    public readonly code: CartErrorCode,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CartError";
  }
}
