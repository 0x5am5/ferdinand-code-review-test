import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Generate a cryptographically secure random API token
 * @param length - Token length in bytes (default: 32)
 * @returns Base64url encoded token
 */
export function generateApiToken(length: number = 32): string {
  return randomBytes(length).toString("base64url");
}

/**
 * Hash a token for secure storage
 * @param token - Plain text token
 * @param salt - Optional salt (will generate one if not provided)
 * @returns Object with hash and salt
 */
export function hashToken(
  token: string,
  salt?: string
): { hash: string; salt: string } {
  const tokenSalt = salt || randomBytes(16).toString("base64url");
  const hash = createHash("sha256")
    .update(token + tokenSalt)
    .digest("base64url");

  return { hash, salt: tokenSalt };
}

/**
 * Verify a token against its hash
 * @param token - Plain text token to verify
 * @param hash - Stored hash
 * @param salt - Salt used for hashing
 * @returns Boolean indicating if token is valid
 */
export function verifyToken(
  token: string,
  hash: string,
  salt: string
): boolean {
  const computedHash = createHash("sha256")
    .update(token + salt)
    .digest("base64url");

  return computedHash === hash;
}

/**
 * Generate a secure random string for various purposes (secrets, IDs, etc.)
 * @param length - Length in bytes
 * @param encoding - Encoding format
 * @returns Random string
 */
export function generateSecureRandom(
  length: number = 32,
  encoding: "base64url" | "hex" = "base64url"
): string {
  return randomBytes(length).toString(encoding);
}

/**
 * Simple encryption for sensitive data like bot tokens
 * Uses AES-256-CBC with a key derived from environment variable
 * @param plaintext - Text to encrypt
 * @param key - Optional encryption key (uses ENCRYPTION_KEY env var if not provided)
 * @returns Object with encrypted data, IV, and auth tag
 */
export function encrypt(
  plaintext: string,
  key?: string
): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "Encryption key not provided and ENCRYPTION_KEY environment variable not set"
    );
  }

  // Derive a 32-byte key from the provided key
  const derivedKey = createHash("sha256").update(encryptionKey).digest();

  const iv = randomBytes(16); // 16 bytes for CBC
  const cipher = createCipheriv("aes-256-cbc", derivedKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64url");
  encrypted += cipher.final("base64url");

  return {
    encrypted,
    iv: iv.toString("base64url"),
    authTag: "", // Not used in CBC mode
  };
}

/**
 * Decrypt data encrypted with the encrypt function
 * @param encryptedData - Object with encrypted data, IV, and auth tag
 * @param key - Optional decryption key (uses ENCRYPTION_KEY env var if not provided)
 * @returns Decrypted plaintext
 */
export function decrypt(
  encryptedData: {
    encrypted: string;
    iv: string;
    authTag: string;
  },
  key?: string
): string {
  const encryptionKey = key || process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error(
      "Decryption key not provided and ENCRYPTION_KEY environment variable not set"
    );
  }

  // Derive the same 32-byte key
  const derivedKey = createHash("sha256").update(encryptionKey).digest();

  const iv = Buffer.from(encryptedData.iv, "base64url");

  const decipher = createDecipheriv("aes-256-cbc", derivedKey, iv);

  let decrypted = decipher.update(encryptedData.encrypted, "base64url", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Mask sensitive data for logging (shows first 4 and last 4 characters)
 * @param sensitiveString - String to mask
 * @returns Masked string
 */
export function maskSensitiveData(sensitiveString: string): string {
  if (sensitiveString.length <= 8) {
    return "*".repeat(sensitiveString.length);
  }

  const start = sensitiveString.slice(0, 4);
  const end = sensitiveString.slice(-4);
  const middle = "*".repeat(Math.max(4, sensitiveString.length - 8));

  return `${start}${middle}${end}`;
}
