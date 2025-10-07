# Security Tests

This directory contains tests for the security features implemented in the Ferdinand application.

## Test Files

### 1. `rate-limit.test.ts`
Tests for the rate limiting middleware.

**What it tests:**
- Requests within limits are allowed
- Requests exceeding limits are blocked with 429 status
- Rate limit headers are set correctly (X-RateLimit-*)
- Different key generation strategies (user ID vs IP)
- Custom key generators
- Retry-After header on limit exceeded
- Independent rate limits for different middleware instances

**Key scenarios:**
- ✅ Allow requests within the limit
- ✅ Block requests exceeding the limit
- ✅ Use userId for authenticated users
- ✅ Use IP address for unauthenticated users
- ✅ Set proper rate limit headers

### 2. `csrf-and-headers.test.ts`
Tests for CSRF protection and security headers middleware.

**CSRF Protection Tests:**
- GET/HEAD/OPTIONS requests bypass CSRF checks
- POST/PUT/PATCH/DELETE requests require origin validation
- Matching origin/referer allows request
- Mismatched origin blocks request (403)
- Missing origin/referer blocks request
- Referer fallback when origin is missing

**Security Headers Tests:**
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy with proper directives
- Permissions-Policy blocking camera, microphone, etc.

**Key scenarios:**
- ✅ Safe methods (GET/HEAD/OPTIONS) bypass CSRF
- ✅ Mutations require matching origin
- ✅ All security headers are set
- ✅ CSRF blocks cross-origin attacks

### 3. `auth-middleware.test.ts`
Tests for authentication middleware (requireAuth, requireAdmin, requireSuperAdmin).

**requireAuth Tests:**
- Allows requests with valid session
- Blocks requests without session (401)
- Blocks requests without userId in session

**requireAdmin Tests:**
- Allows admin users
- Allows super_admin users
- Blocks non-admin users (403)
- Blocks unauthenticated requests (401)
- Handles user not found
- Handles database errors gracefully (500)

**requireSuperAdmin Tests:**
- Allows only super_admin users
- Blocks admin users (not super_admin)
- Blocks standard users
- Blocks unauthenticated requests

**Key scenarios:**
- ✅ Authentication check works
- ✅ Role-based authorization works
- ✅ Error handling is robust

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test rate-limit.test.ts
```

## Test Coverage

The tests cover the core security middleware:
- Rate limiting (all predefined limiters)
- CSRF protection
- Security headers
- Authentication
- Authorization (admin/super admin)

## What's NOT Tested Yet

- Integration tests for full request/response cycles
- End-to-end tests with actual HTTP requests
- Database-dependent route tests
- File upload security tests
- Session management tests

## Adding New Tests

When adding new security features, please add corresponding tests:

1. Create a new `.test.ts` file in this directory
2. Follow the existing patterns for mock objects
3. Test both success and failure scenarios
4. Test error handling
5. Update this README with the new test coverage

## Continuous Integration

These tests should run:
- Before every commit (pre-commit hook)
- In CI/CD pipeline
- Before deployments

## Security Testing Best Practices

1. **Test the negative cases** - What should be blocked?
2. **Test boundary conditions** - Exact limits, just over limits
3. **Test error handling** - What happens when things go wrong?
4. **Test different user types** - Guest, standard, admin, super_admin
5. **Test authentication states** - Authenticated vs unauthenticated

## Related Documentation

- [Rate Limiting Implementation](../../server/middlewares/rate-limit.ts)
- [CSRF Protection](../../server/middlewares/security-headers.ts)
- [Auth Middleware](../../server/middlewares/auth.ts)
- [File Asset System Plan](../../plans/file-asset-system-plan.md)
