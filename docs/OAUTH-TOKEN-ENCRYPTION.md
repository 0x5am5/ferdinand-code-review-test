# OAuth Token Encryption Security

This document describes Ferdinand's implementation of AES-256 encryption for OAuth tokens at rest.

## Overview

Ferdinand uses **AES-256-GCM** (Galois/Counter Mode) encryption to protect OAuth tokens stored in the database. This ensures that even if the database is compromised, tokens remain encrypted and unusable without the encryption key.

## Encryption Algorithm

- **Algorithm**: AES-256-GCM
- **Key Size**: 256 bits (32 bytes)
- **IV Length**: 16 bytes (randomly generated per encryption)
- **Auth Tag Length**: 16 bytes (for authentication)
- **Key Derivation**: scrypt with salt

## Implementation

### Core Encryption Functions

Located in `server/utils/encryption.ts`:

```typescript
// Encrypt a string
encrypt(text: string): string

// Decrypt an encrypted string
decrypt(encryptedData: string): string

// Encrypt Google OAuth tokens
encryptTokens(tokens: {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
}): { encryptedAccessToken, encryptedRefreshToken, expiresAt }

// Decrypt Google OAuth tokens
decryptTokens(encrypted: {
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: Date | null;
}): { access_token, refresh_token, expiry_date }

// Check if token is expired
isTokenExpired(expiresAt: Date | null, bufferMinutes: number): boolean
```

### Token Storage

#### Google Drive Tokens ✅ ENCRYPTED

**Database Table**: `google_drive_connections`

```sql
encryptedAccessToken TEXT NOT NULL
encryptedRefreshToken TEXT NOT NULL
tokenExpiresAt TIMESTAMP
```

**Status**: ✅ Fully encrypted using AES-256-GCM
**Implementation**: All Google Drive OAuth tokens are encrypted before storage and decrypted only when needed

#### Figma Tokens ⚠️ NOT ENCRYPTED

**Database Table**: `figma_connections`

```sql
accessToken TEXT NOT NULL  -- Comment says "Encrypted" but not implemented
refreshToken TEXT          -- Comment says "OAuth refresh token" but not encrypted
```

**Status**: ⚠️ NOT ENCRYPTED (despite comments indicating they should be)
**Recommendation**: Implement encryption for Figma tokens using the same pattern as Google Drive

#### Slack Tokens ⚠️ NOT ENCRYPTED

**Database Table**: `slack_workspaces`

```sql
botToken TEXT NOT NULL  -- Comment says "Encrypted" but not implemented
```

**Status**: ⚠️ NOT ENCRYPTED (despite comment indicating it should be)
**Recommendation**: Implement encryption for Slack bot tokens

## Encryption Key Management

### Environment Variable

The encryption key is stored in the `ENCRYPTION_KEY` environment variable:

```env
ENCRYPTION_KEY=your-secure-random-key-here
```

**CRITICAL SECURITY REQUIREMENTS**:

1. ✅ **DO** use a cryptographically secure random string (min 32 characters)
2. ✅ **DO** store in environment variables, never in source code
3. ✅ **DO** use different keys for development, staging, and production
4. ✅ **DO** rotate keys periodically (requires re-encryption of existing tokens)
5. ✅ **DO** store keys in a secure secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
6. ❌ **DO NOT** commit keys to version control
7. ❌ **DO NOT** share keys across environments
8. ❌ **DO NOT** log or expose keys in error messages

### Generating a Secure Encryption Key

```bash
# Generate a secure random key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Or using openssl
openssl rand -base64 32
```

## Usage Examples

### Encrypting Tokens on Storage

```typescript
import { encryptTokens } from '../utils/encryption';

// When storing Google Drive tokens
const { encryptedAccessToken, encryptedRefreshToken, expiresAt } =
  encryptTokens({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  });

await db.insert(googleDriveConnections).values({
  userId: user.id,
  encryptedAccessToken,
  encryptedRefreshToken,
  tokenExpiresAt: expiresAt,
  scopes: REQUIRED_SCOPES,
});
```

### Decrypting Tokens for Use

```typescript
import { decryptTokens } from '../utils/encryption';

// When retrieving tokens
const [connection] = await db
  .select()
  .from(googleDriveConnections)
  .where(eq(googleDriveConnections.userId, userId));

const tokens = decryptTokens({
  encryptedAccessToken: connection.encryptedAccessToken,
  encryptedRefreshToken: connection.encryptedRefreshToken,
  tokenExpiresAt: connection.tokenExpiresAt,
});

// Use tokens.access_token and tokens.refresh_token
```

### Checking Token Expiry

```typescript
import { isTokenExpired } from '../utils/encryption';

// Check if token needs refresh (with 5 minute buffer)
if (isTokenExpired(connection.tokenExpiresAt, 5)) {
  // Refresh the token
  const newTokens = await refreshGoogleDriveToken(connection);
  // Re-encrypt and update database
}
```

## Current Implementation Status

### ✅ Google Drive OAuth Tokens
- **Status**: Fully encrypted
- **Algorithm**: AES-256-GCM
- **Storage**: `google_drive_connections` table
- **Implementation**: Complete in all routes and services

### ⚠️ Figma OAuth Tokens
- **Status**: NOT ENCRYPTED (comments misleading)
- **Schema Says**: "Encrypted Figma access token"
- **Reality**: Stored in plain text
- **Action Required**: Implement encryption

### ⚠️ Slack Bot Tokens
- **Status**: NOT ENCRYPTED (comments misleading)
- **Schema Says**: "Encrypted"
- **Reality**: Stored in plain text
- **Action Required**: Implement encryption

## Security Best Practices

### 1. Token Lifecycle

- ✅ Encrypt immediately upon receipt from OAuth provider
- ✅ Decrypt only when actively needed for API calls
- ✅ Never log decrypted tokens
- ✅ Never expose tokens in API responses
- ✅ Implement token expiry checking
- ✅ Refresh tokens before expiration

### 2. Database Security

- Store only encrypted tokens in database
- Use parameterized queries to prevent SQL injection
- Implement database-level access controls
- Enable database encryption at rest
- Regular security audits of stored tokens

### 3. Key Rotation Strategy

When rotating encryption keys:

1. Generate new encryption key
2. Retrieve all encrypted tokens
3. Decrypt with old key
4. Re-encrypt with new key
5. Update database
6. Update environment variable
7. Verify all tokens work
8. Securely destroy old key

## Testing

### Unit Tests

Located in `tests/encryption.test.ts` (to be created):

```typescript
describe('Token Encryption', () => {
  test('encrypts and decrypts tokens correctly', () => {
    const original = 'test-access-token';
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('different IVs produce different ciphertexts', () => {
    const token = 'same-token';
    const encrypted1 = encrypt(token);
    const encrypted2 = encrypt(token);
    expect(encrypted1).not.toBe(encrypted2);
  });

  test('throws error on invalid encrypted data', () => {
    expect(() => decrypt('invalid-data')).toThrow();
  });
});
```

## Compliance

This encryption implementation helps meet:

- **GDPR**: Article 32 (Security of Processing)
- **SOC 2**: CC6.7 (Encryption of data at rest)
- **PCI DSS**: Requirement 3.4 (Render PAN unreadable)
- **HIPAA**: Technical Safeguards (encryption at rest)

## Recommendations

### Immediate Action Items

1. **Encrypt Figma Tokens**:
   - Update schema to use `encryptedAccessToken` and `encryptedRefreshToken`
   - Update all Figma token storage/retrieval code
   - Run migration to encrypt existing tokens

2. **Encrypt Slack Tokens**:
   - Update schema to use `encryptedBotToken`
   - Update all Slack token storage/retrieval code
   - Run migration to encrypt existing tokens

3. **Create Encryption Tests**:
   - Unit tests for encryption/decryption
   - Integration tests for token lifecycle
   - Security audit tests

4. **Key Management**:
   - Document key generation process
   - Implement key rotation procedure
   - Set up secrets manager integration

### Future Enhancements

1. Implement key rotation automation
2. Add encryption key versioning
3. Implement token usage auditing
4. Add anomaly detection for token usage
5. Implement automatic token refresh before expiry

## References

- [NIST AES-GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
