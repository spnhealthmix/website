import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";

describe("custom authentication passwords", () => {
  it("verifies passwords encoded with the configured PBKDF2-SHA256 format", async () => {
    const hash = await hashPassword("safe-test-password-123");

    expect(hash).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    await expect(verifyPassword("safe-test-password-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("different-password-123", hash)).resolves.toBe(false);
  });

  it("rejects malformed and unreasonably expensive stored hashes", async () => {
    await expect(verifyPassword("safe-test-password-123", "clerk$hash")).resolves.toBe(false);
    await expect(
      verifyPassword(
        "safe-test-password-123",
        `pbkdf2$999999999$${"a".repeat(32)}$${"b".repeat(64)}`
      )
    ).resolves.toBe(false);
  });
});
