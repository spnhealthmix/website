/**
 * Web Crypto PBKDF2 Password Hashing & Verification
 * Compatible with Node.js, Cloudflare Workers, and OpenNext edge runtimes.
 * Does not require any C++ native bindings or binary modules.
 */

const ITERATIONS = 100_000;
const KEY_LEN = 32; // 256 bits
const SALT_LEN = 16; // 128 bits

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Validates password strength policy:
 * - At least 8 characters
 * - At most 128 characters
 * - Must contain at least one letter and at least one number
 */
export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, error: "Password cannot exceed 128 characters." };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return { valid: false, error: "Password must contain at least one letter and one number." };
  }
  return { valid: true };
}

/**
 * Hashes a plaintext password using PBKDF2-SHA256 with 100,000 iterations.
 * Returns a self-contained string formatted as: `pbkdf2$iterations$saltHex$derivedHex`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    KEY_LEN * 8
  );

  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(derivedBits)}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  if (
    !/^\d+$/.test(parts[1]) ||
    !/^[0-9a-f]{32}$/i.test(parts[2]) ||
    !/^[0-9a-f]{64}$/i.test(parts[3])
  ) {
    return false;
  }

  const iterations = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const expectedHash = fromHex(parts[3]);

  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1_000_000) {
    return false;
  }

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    expectedHash.length * 8
  );

  const actualHash = new Uint8Array(derivedBits);
  return timingSafeEqual(actualHash, expectedHash);
}
