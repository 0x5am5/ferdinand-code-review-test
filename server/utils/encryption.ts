import crypto from "crypto";

// AES-256-GCM encryption for OAuth tokens
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM mode
const AUTH_TAG_LENGTH = 16;
const _SALT_LENGTH = 64;

// Cache for the derived encryption key to avoid expensive scryptSync calls
let cachedKey: Buffer | null = null;
let lastEncryptionKeyValue: string | undefined;

// Get encryption key from environment or generate one
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  // Return cached key if ENCRYPTION_KEY hasn't changed
  if (cachedKey && lastEncryptionKeyValue === key) {
    return cachedKey;
  }

  // Derive new key and cache it (scryptSync is expensive, ~50-100ms per call)
  cachedKey = crypto.scryptSync(key, "salt", 32);
  lastEncryptionKeyValue = key;

  return cachedKey;
}

/**
 * Clear the cached encryption key (useful for testing)
 */
export function clearKeyCache(): void {
  cachedKey = null;
  lastEncryptionKeyValue = undefined;
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV + Auth Tag + Encrypted Data
    // Format: [IV(16 bytes)][Auth Tag(16 bytes)][Encrypted Data]
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, "hex"),
    ]);

    return combined.toString("base64");
  } catch (error) {
    // Preserve error message if it's about missing ENCRYPTION_KEY
    if (
      error instanceof Error &&
      error.message === "ENCRYPTION_KEY environment variable is required"
    ) {
      throw error;
    }
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt token");
  }
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, "base64");

    // Extract IV, Auth Tag, and Encrypted Data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.toString("hex"), "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // Preserve error message if it's about missing ENCRYPTION_KEY
    if (
      error instanceof Error &&
      error.message === "ENCRYPTION_KEY environment variable is required"
    ) {
      throw error;
    }
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt token");
  }
}

/**
 * Encrypt Google OAuth tokens
 */
export function encryptTokens(tokens: {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}): {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  expiresAt: Date | null;
} {
  if (!tokens.access_token) {
    throw new Error("Access token is required");
  }

  if (!tokens.refresh_token) {
    throw new Error("Refresh token is required");
  }

  return {
    encryptedAccessToken: encrypt(tokens.access_token),
    encryptedRefreshToken: encrypt(tokens.refresh_token),
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

/**
 * Decrypt Google OAuth tokens
 */
export function decryptTokens(encrypted: {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date | null;
}): {
  access_token: string;
  refresh_token: string;
  expiry_date: number | undefined;
} {
  return {
    access_token: decrypt(encrypted.encryptedAccessToken),
    refresh_token: decrypt(encrypted.encryptedRefreshToken),
    expiry_date: encrypted.tokenExpiresAt?.getTime(),
  };
}

/**
 * Check if a token is expired or will expire soon
 * @param expiresAt Token expiration date
 * @param bufferMinutes Minutes before expiration to consider token expired (default: 5)
 * @returns true if token is expired or will expire soon
 */
export function isTokenExpired(
  expiresAt: Date | null,
  bufferMinutes = 5
): boolean {
  if (!expiresAt) {
    return true; // If no expiration date, consider it expired
  }

  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  const expirationWithBuffer = new Date(expiresAt.getTime() - bufferMs);

  return now >= expirationWithBuffer;
}
