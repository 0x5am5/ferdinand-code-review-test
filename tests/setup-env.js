// Load dotenv FIRST to get real DATABASE_URL from .env
import 'dotenv/config';

// Set NODE_ENV to test FIRST to skip database connection checks
process.env.NODE_ENV = 'test';

// Set fake DATABASE_URL for server/db imports (won't be used with mocks)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// Set ENCRYPTION_KEY for encryption tests
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-for-vitest-tests-only-do-not-use-in-production';
