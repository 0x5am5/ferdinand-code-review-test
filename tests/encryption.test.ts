/**
 * Encryption Tests
 *
 * Tests for AES-256-GCM encryption used for OAuth tokens
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  encrypt,
  decrypt,
  encryptTokens,
  decryptTokens,
  isTokenExpired,
} from '../server/utils/encryption';

describe('Token Encryption - AES-256-GCM', () => {
  beforeAll(() => {
    // Ensure ENCRYPTION_KEY is set for tests
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = 'test-encryption-key-for-jest-tests-only-do-not-use-in-production';
    }
  });

  describe('encrypt() and decrypt()', () => {
    test('should encrypt and decrypt a simple string correctly', () => {
      const original = 'test-access-token';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
      expect(encrypted).not.toBe(original);
    });

    test('should produce different ciphertexts for the same input (random IV)', () => {
      const token = 'same-token-value';
      const encrypted1 = encrypt(token);
      const encrypted2 = encrypt(token);

      // Different encrypted values due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both decrypt to the same value
      expect(decrypt(encrypted1)).toBe(token);
      expect(decrypt(encrypted2)).toBe(token);
    });

    test('should handle empty strings', () => {
      const original = '';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    test('should handle long strings', () => {
      const original = 'a'.repeat(10000);
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    test('should handle special characters', () => {
      const original = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`€£¥©®™';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    test('should handle Unicode characters', () => {
      const original = '你好世界 🚀 مرحبا العالم';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    test('should throw error when decrypting invalid data', () => {
      expect(() => decrypt('invalid-base64-data')).toThrow();
    });

    test('should throw error when decrypting tampered data', () => {
      const original = 'sensitive-token';
      const encrypted = encrypt(original);

      // Tamper with encrypted data
      const buffer = Buffer.from(encrypted, 'base64');
      buffer[buffer.length - 1] ^= 0xFF; // Flip all bits in last byte
      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    test('should return base64-encoded string', () => {
      const encrypted = encrypt('test');
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

      expect(base64Regex.test(encrypted)).toBe(true);
    });
  });

  describe('encryptTokens() and decryptTokens()', () => {
    test('should encrypt and decrypt Google OAuth tokens', () => {
      const originalTokens = {
        access_token: 'ya29.a0AfH6SMBxxx...',
        refresh_token: '1//0gxxx...',
        expiry_date: Date.now() + 3600000, // 1 hour from now
      };

      const encrypted = encryptTokens(originalTokens);

      expect(encrypted.encryptedAccessToken).toBeDefined();
      expect(encrypted.encryptedRefreshToken).toBeDefined();
      expect(encrypted.expiresAt).toBeInstanceOf(Date);

      const decrypted = decryptTokens({
        encryptedAccessToken: encrypted.encryptedAccessToken,
        encryptedRefreshToken: encrypted.encryptedRefreshToken,
        tokenExpiresAt: encrypted.expiresAt,
      });

      expect(decrypted.access_token).toBe(originalTokens.access_token);
      expect(decrypted.refresh_token).toBe(originalTokens.refresh_token);
      expect(decrypted.expiry_date).toBe(originalTokens.expiry_date);
    });

    test('should handle tokens without expiry date', () => {
      const originalTokens = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      };

      const encrypted = encryptTokens(originalTokens);
      expect(encrypted.expiresAt).toBeNull();

      const decrypted = decryptTokens({
        encryptedAccessToken: encrypted.encryptedAccessToken,
        encryptedRefreshToken: encrypted.encryptedRefreshToken,
        tokenExpiresAt: null,
      });

      expect(decrypted.access_token).toBe(originalTokens.access_token);
      expect(decrypted.refresh_token).toBe(originalTokens.refresh_token);
      expect(decrypted.expiry_date).toBeUndefined();
    });

    test('should throw error when access_token is missing', () => {
      expect(() =>
        encryptTokens({
          refresh_token: 'test',
        } as any)
      ).toThrow('Access token is required');
    });

    test('should throw error when refresh_token is missing', () => {
      expect(() =>
        encryptTokens({
          access_token: 'test',
        } as any)
      ).toThrow('Refresh token is required');
    });
  });

  describe('isTokenExpired()', () => {
    test('should return true for null expiration date', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    test('should return true for past expiration date', () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      expect(isTokenExpired(pastDate)).toBe(true);
    });

    test('should return false for future expiration date', () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      expect(isTokenExpired(futureDate)).toBe(false);
    });

    test('should respect buffer time (default 5 minutes)', () => {
      // Token expires in 4 minutes
      const nearFuture = new Date(Date.now() + 4 * 60 * 1000);

      // Should be considered expired (within 5 minute buffer)
      expect(isTokenExpired(nearFuture, 5)).toBe(true);

      // Should not be expired (within 3 minute buffer)
      expect(isTokenExpired(nearFuture, 3)).toBe(false);
    });

    test('should handle custom buffer times', () => {
      const futureDate = new Date(Date.now() + 8 * 60 * 1000); // 8 minutes

      expect(isTokenExpired(futureDate, 10)).toBe(true); // 10 min buffer
      expect(isTokenExpired(futureDate, 5)).toBe(false); // 5 min buffer
      expect(isTokenExpired(futureDate, 0)).toBe(false); // no buffer
    });

    test('should handle edge case at exact expiry time', () => {
      const now = new Date();

      // With no buffer, should be expired
      expect(isTokenExpired(now, 0)).toBe(true);
    });
  });

  describe('Security Properties', () => {
    test('encrypted data should be significantly different from original', () => {
      const original = 'sensitive-data';
      const encrypted = encrypt(original);

      // Should not contain original in encrypted form
      expect(encrypted).not.toContain(original);
      expect(encrypted.length).toBeGreaterThan(original.length);
    });

    test('should produce unique ciphertext each time (IND-CPA security)', () => {
      const original = 'test-token';
      const encrypted1 = encrypt(original);
      const encrypted2 = encrypt(original);
      const encrypted3 = encrypt(original);

      // All should be unique
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted2).not.toBe(encrypted3);
      expect(encrypted1).not.toBe(encrypted3);

      // But all should decrypt to same value
      expect(decrypt(encrypted1)).toBe(original);
      expect(decrypt(encrypted2)).toBe(original);
      expect(decrypt(encrypted3)).toBe(original);
    });

    test('should detect tampering with authentication tag', () => {
      const original = 'secure-token';
      const encrypted = encrypt(original);

      const buffer = Buffer.from(encrypted, 'base64');

      // Tamper with the authentication tag (second 16 bytes)
      buffer[20] ^= 0x01;

      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    test('should detect tampering with IV', () => {
      const original = 'secure-token';
      const encrypted = encrypt(original);

      const buffer = Buffer.from(encrypted, 'base64');

      // Tamper with the IV (first 16 bytes)
      buffer[5] ^= 0x01;

      const tampered = buffer.toString('base64');

      expect(() => decrypt(tampered)).toThrow();
    });

    test('should handle concurrent encryption operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) => ({
        original: `token-${i}`,
      }));

      const results = await Promise.all(
        operations.map(async ({ original }) => {
          const encrypted = encrypt(original);
          const decrypted = decrypt(encrypted);
          return { original, decrypted, match: original === decrypted };
        })
      );

      // All should match
      expect(results.every((r) => r.match)).toBe(true);

      // All encrypted values should be unique
      const encrypted = results.map((r) => encrypt(r.original));
      const uniqueEncrypted = new Set(encrypted);
      expect(uniqueEncrypted.size).toBe(encrypted.length);
    });
  });

  describe('Integration - Token Lifecycle', () => {
    test('should simulate complete OAuth token lifecycle', () => {
      // 1. Receive tokens from OAuth provider
      const oauthResponse = {
        access_token: 'ya29.a0AfH6SMBxxx...',
        refresh_token: '1//0gxxx...',
        expiry_date: Date.now() + 3600000,
      };

      // 2. Encrypt before storing
      const { encryptedAccessToken, encryptedRefreshToken, expiresAt } =
        encryptTokens(oauthResponse);

      // Simulate database storage
      const dbRecord = {
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
      };

      // 3. Check if token is expired
      expect(isTokenExpired(dbRecord.tokenExpiresAt)).toBe(false);

      // 4. Decrypt when needed for API call
      const tokens = decryptTokens(dbRecord);

      // 5. Verify tokens are correct
      expect(tokens.access_token).toBe(oauthResponse.access_token);
      expect(tokens.refresh_token).toBe(oauthResponse.refresh_token);
      expect(tokens.expiry_date).toBe(oauthResponse.expiry_date);
    });

    test('should simulate token refresh flow', () => {
      // 1. Expired token scenario
      const expiredTokens = {
        access_token: 'old-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() - 1000, // expired
      };

      const encrypted = encryptTokens(expiredTokens);

      // 2. Check expiration
      expect(isTokenExpired(encrypted.expiresAt)).toBe(true);

      // 3. Simulate token refresh
      const newTokens = {
        access_token: 'new-access-token',
        refresh_token: 'refresh-token',
        expiry_date: Date.now() + 3600000,
      };

      const newEncrypted = encryptTokens(newTokens);

      // 4. Verify new tokens
      const decrypted = decryptTokens({
        encryptedAccessToken: newEncrypted.encryptedAccessToken,
        encryptedRefreshToken: newEncrypted.encryptedRefreshToken,
        tokenExpiresAt: newEncrypted.expiresAt,
      });

      expect(decrypted.access_token).toBe(newTokens.access_token);
      expect(isTokenExpired(newEncrypted.expiresAt)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should provide clear error message when ENCRYPTION_KEY is missing', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

      // Restore
      process.env.ENCRYPTION_KEY = originalKey;
    });

    test('should handle encryption failures gracefully', () => {
      const originalKey = process.env.ENCRYPTION_KEY;

      try {
        delete process.env.ENCRYPTION_KEY;
        expect(() => encrypt('test')).toThrow();
      } finally {
        process.env.ENCRYPTION_KEY = originalKey;
      }
    });

    test('should handle decryption failures gracefully', () => {
      expect(() => decrypt('not-a-valid-encrypted-string')).toThrow('Failed to decrypt token');
    });
  });

  describe('Performance', () => {
    test('should encrypt/decrypt reasonably fast', () => {
      const iterations = 1000;
      const testData = 'test-access-token-'.repeat(10);

      const startEncrypt = Date.now();
      const encrypted: string[] = [];
      for (let i = 0; i < iterations; i++) {
        encrypted.push(encrypt(testData));
      }
      const encryptTime = Date.now() - startEncrypt;

      const startDecrypt = Date.now();
      for (let i = 0; i < iterations; i++) {
        decrypt(encrypted[i]);
      }
      const decryptTime = Date.now() - startDecrypt;

      // Should complete 1000 operations in reasonable time
      expect(encryptTime).toBeLessThan(5000); // 5 seconds
      expect(decryptTime).toBeLessThan(5000); // 5 seconds

      console.log(`Performance: ${iterations} encryptions in ${encryptTime}ms, ${iterations} decryptions in ${decryptTime}ms`);
    });
  });
});
