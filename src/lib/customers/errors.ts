export type CustomerErrorCode =
  | "PROFILE_NOT_FOUND"
  | "ADDRESS_NOT_FOUND"
  | "ADDRESS_LIMIT_REACHED"
  | "ORDER_NOT_FOUND";

export class CustomerError extends Error {
  constructor(
    public readonly code: CustomerErrorCode | string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "CustomerError";
  }
}
