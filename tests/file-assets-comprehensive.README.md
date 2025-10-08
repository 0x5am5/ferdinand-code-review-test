# File Assets Comprehensive Test Suite

## Current Status: REQUIRES RUNNING SERVER

This test suite is designed as an **end-to-end integration test** that makes HTTP requests to a live server instance at `http://localhost:3001`.

## Known Issues

### Session Authentication Problem

The tests create users and sessions directly in the database, but the Express server's `express-session` middleware doesn't recognize these sessions because:

1. Sessions need to be cryptographically signed with the session secret
2. The session cookie format must match what `express-session` expects
3. The session store (connect-pg-simple) caches sessions and may not immediately recognize new entries

### Current Test Failures

Tests fail because:
- Guest users can access private assets (should return 403)
- Guest users can upload files (should return 403)
- Permission checks are not enforced properly in the test environment

## Solutions

### Option 1: Convert to Supertest (Recommended)

Install and use `supertest` to test the Express app directly without needing a running server:

```bash
npm install --save-dev supertest @types/supertest
```

Then refactor tests to:
```typescript
import request from 'supertest';
import { app } from '../server/index';

// Test example
const response = await request(app)
  .post('/api/clients/1/file-assets/upload')
  .set('Cookie', sessionCookie)
  .attach('file', buffer, 'test.pdf');
```

### Option 2: Use Firebase Auth (Current Production Method)

Instead of mocking sessions, use Firebase Admin SDK to create test users and generate valid Firebase tokens:

```typescript
import admin from 'firebase-admin';

const customToken = await admin.auth().createCustomToken(testUserId);
const idToken = await signInWithCustomToken(auth, customToken);
```

### Option 3: Add Test-Only Authentication Bypass

Add a test-only authentication mode that bypasses Firebase auth (NOT RECOMMENDED for production):

```typescript
if (process.env.NODE_ENV === 'test' && req.headers['x-test-user-id']) {
  req.session.userId = parseInt(req.headers['x-test-user-id']);
}
```

## Fixes Applied

### Permission Enforcement

Added Guest user upload restrictions to both upload endpoints:

- `/api/assets/upload` - Now checks if user is Guest and returns 403
- `/api/clients/:clientId/file-assets/upload` - Now checks if user is Guest and returns 403

These fixes ensure that even if authentication bypasses are added for testing, permission rules are still enforced at the business logic level.

## Running These Tests

### Prerequisites

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Ensure database is running and migrations are applied:
   ```bash
   npm run db:push
   ```

3. Set up test environment variables if needed

### Run Tests

```bash
npm test tests/file-assets-comprehensive.test.ts
```

### Expected Behavior

With the current implementation, tests will fail because session authentication doesn't work properly. To make these tests pass, implement one of the solutions above.

## Recommended Next Steps

1. Install `supertest` as a dev dependency
2. Refactor test suite to use supertest instead of fetch
3. Mock Firebase auth for test environment
4. Create test fixtures and factories for common test scenarios
5. Add test database seeding/cleanup utilities
