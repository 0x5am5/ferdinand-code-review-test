/**
 * Rate Limit Middleware Tests
 *
 * Comprehensive test suite for Express rate limiting middleware.
 * Tests rate limiting behavior, headers, time window resets, and various rate limiters.
 *
 * Test Coverage:
 * - Rate limiting middleware behavior
 * - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After)
 * - Rate limit resets after time window
 * - Custom key generators
 * - Predefined rate limiters (upload, auth, API, etc.)
 * - Different user contexts (authenticated vs. IP-based)
 * - Concurrent requests handling
 *
 * To run these tests:
 * npm test -- rate-limit-middleware.test.ts
 */
// @ts-nocheck - Disabling type checks for test file to avoid Jest mock type issues
import { describe, it, expect, jest } from '@jest/globals';
import { rateLimit, uploadRateLimit, strictUploadRateLimit, apiRateLimit, authRateLimit, invitationRateLimit, tokenCreationRateLimit, mutationRateLimit, driveFileAccessRateLimit, driveThumbnailRateLimit, driveImportRateLimit, driveListingRateLimit, } from '../server/middlewares/rate-limit';
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Creates a mock Express request
 */
function createMockRequest(overrides = {}) {
    return {
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        headers: {},
        session: {},
        ...overrides,
    };
}
/**
 * Creates a mock Express response
 */
function createMockResponse() {
    const res = {
        statusCode: 200,
        jsonData: null,
        headerData: {},
    };
    res.status = jest.fn((code) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn((data) => {
        res.jsonData = data;
        return res;
    });
    res.setHeader = jest.fn((name, value) => {
        res.headerData[name] = value;
        return res;
    });
    return res;
}
/**
 * Creates a mock next function
 */
function createMockNext() {
    return jest.fn();
}
/**
 * Wait for a specified time
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ============================================================================
// Test Suite: rateLimit() - Basic Functionality
// ============================================================================
describe('Rate Limit Middleware - rateLimit()', () => {
    describe('Basic Rate Limiting', () => {
        it('should allow first request', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 5,
            });
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();
            middleware(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should allow requests below limit', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 3,
            });
            const req = createMockRequest({ ip: '192.168.1.1' });
            const res = createMockResponse();
            const next = createMockNext();
            // Make 3 requests (at limit)
            middleware(req, res, next);
            middleware(req, res, next);
            middleware(req, res, next);
            expect(next).toHaveBeenCalledTimes(3);
            expect(res.status).not.toHaveBeenCalled();
        });
        it('should block requests when limit exceeded', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 2,
            });
            const req = createMockRequest({ ip: '192.168.1.2' });
            const res = createMockResponse();
            const next = createMockNext();
            // Make 2 requests (at limit)
            middleware(req, res, next);
            middleware(req, res, next);
            // Third request should be blocked
            const res3 = createMockResponse();
            const next3 = createMockNext();
            middleware(req, res3, next3);
            expect(next3).not.toHaveBeenCalled();
            expect(res3.status).toHaveBeenCalledWith(429);
            expect(res3.jsonData.message).toBe('Too many requests, please try again later');
        });
        it('should return custom error message', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
                message: 'Custom rate limit message',
            });
            const req = createMockRequest({ ip: '192.168.1.3' });
            const res = createMockResponse();
            const next = createMockNext();
            // First request
            middleware(req, res, next);
            // Second request (blocked)
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(res2.jsonData.message).toBe('Custom rate limit message');
        });
    });
    describe('Rate Limit Headers', () => {
        it('should set X-RateLimit-Limit header', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 10,
            });
            const req = createMockRequest({ ip: '192.168.1.4' });
            const res = createMockResponse();
            const next = createMockNext();
            middleware(req, res, next);
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
        });
        it('should set X-RateLimit-Remaining header', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 5,
            });
            const req = createMockRequest({ ip: '192.168.1.5' });
            const res = createMockResponse();
            const next = createMockNext();
            middleware(req, res, next);
            middleware(req, res, next);
            expect(res.headerData['X-RateLimit-Remaining']).toBe(3); // 5 - 2
        });
        it('should set X-RateLimit-Reset header', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 5,
            });
            const req = createMockRequest({ ip: '192.168.1.6' });
            const res = createMockResponse();
            const next = createMockNext();
            middleware(req, res, next);
            expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
            expect(res.headerData['X-RateLimit-Reset']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });
        it('should set Retry-After header when rate limit exceeded', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req = createMockRequest({ ip: '192.168.1.7' });
            const res = createMockResponse();
            const next = createMockNext();
            // First request
            middleware(req, res, next);
            // Second request (blocked)
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(res2.headerData['Retry-After']).toBeGreaterThan(0);
            expect(res2.headerData['Retry-After']).toBeLessThanOrEqual(60);
        });
        it('should set X-RateLimit-Remaining to 0 when limit exceeded', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req = createMockRequest({ ip: '192.168.1.8' });
            const res = createMockResponse();
            const next = createMockNext();
            // First request
            middleware(req, res, next);
            // Second request (blocked)
            const res2 = createMockResponse();
            middleware(req, res2, createMockNext());
            expect(res2.headerData['X-RateLimit-Remaining']).toBe(0);
        });
    });
    describe('Time Window Reset', () => {
        it('should reset rate limit after window expires', async () => {
            const middleware = rateLimit({
                windowMs: 100, // 100ms window for testing
                max: 1,
            });
            const req = createMockRequest({ ip: '192.168.1.9' });
            const res = createMockResponse();
            const next = createMockNext();
            // First request
            middleware(req, res, next);
            // Wait for window to expire
            await wait(150);
            // New request should be allowed
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(next2).toHaveBeenCalledTimes(1);
            expect(res2.status).not.toHaveBeenCalled();
        });
        it('should maintain rate limit within window period', async () => {
            const middleware = rateLimit({
                windowMs: 200,
                max: 1,
            });
            const req = createMockRequest({ ip: '192.168.1.10' });
            const res = createMockResponse();
            const next = createMockNext();
            // First request
            middleware(req, res, next);
            // Wait less than window period
            await wait(50);
            // Second request should be blocked
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(next2).not.toHaveBeenCalled();
            expect(res2.status).toHaveBeenCalledWith(429);
        });
        it('should create new window after reset', async () => {
            const middleware = rateLimit({
                windowMs: 100,
                max: 2,
            });
            const req = createMockRequest({ ip: '192.168.1.11' });
            // Use 2 requests in first window
            middleware(req, createMockResponse(), createMockNext());
            middleware(req, createMockResponse(), createMockNext());
            // Wait for window reset
            await wait(150);
            // Should have 2 new requests available
            const res3 = createMockResponse();
            const next3 = createMockNext();
            middleware(req, res3, next3);
            expect(res3.headerData['X-RateLimit-Remaining']).toBe(1);
        });
    });
    describe('Key Generation', () => {
        it('should use IP address by default', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req1 = createMockRequest({ ip: '192.168.1.20' });
            const req2 = createMockRequest({ ip: '192.168.1.21' });
            // Each IP gets its own limit
            middleware(req1, createMockResponse(), createMockNext());
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req2, res2, next2);
            expect(next2).toHaveBeenCalled(); // Different IP, not blocked
        });
        it('should use user ID when authenticated', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req1 = createMockRequest({
                ip: '192.168.1.22',
                session: { userId: 'user123' },
            });
            const req2 = createMockRequest({
                ip: '192.168.1.23', // Different IP
                session: { userId: 'user123' }, // Same user
            });
            // First request
            middleware(req1, createMockResponse(), createMockNext());
            // Second request (same user, different IP, should be blocked)
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req2, res2, next2);
            expect(next2).not.toHaveBeenCalled(); // Same user, blocked
            expect(res2.status).toHaveBeenCalledWith(429);
        });
        it('should use custom key generator', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
                keyGenerator: (req) => `custom:${req.headers['x-api-key'] || 'anonymous'}`,
            });
            const req1 = createMockRequest({
                headers: { 'x-api-key': 'key123' },
            });
            const req2 = createMockRequest({
                headers: { 'x-api-key': 'key456' },
            });
            // Each API key gets its own limit
            middleware(req1, createMockResponse(), createMockNext());
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req2, res2, next2);
            expect(next2).toHaveBeenCalled(); // Different key, not blocked
        });
        it('should handle X-Forwarded-For header', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req = createMockRequest({
                ip: undefined,
                socket: { remoteAddress: undefined },
                headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1' },
            });
            middleware(req, createMockResponse(), createMockNext());
            // Second request should be blocked (same forwarded IP)
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(next2).not.toHaveBeenCalled();
        });
        it('should handle unknown IP', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 1,
            });
            const req = createMockRequest({
                ip: undefined,
                socket: { remoteAddress: undefined },
                headers: {},
            });
            middleware(req, createMockResponse(), createMockNext());
            // Should still work with unknown IP
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req, res2, next2);
            expect(next2).not.toHaveBeenCalled(); // Same "unknown" IP
        });
    });
    describe('Concurrent Requests', () => {
        it('should handle concurrent requests correctly', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 5,
            });
            const req = createMockRequest({ ip: '192.168.1.30' });
            // Make 5 concurrent requests
            const results = Array.from({ length: 5 }, () => {
                const res = createMockResponse();
                const next = createMockNext();
                middleware(req, res, next);
                return { res, next };
            });
            // All 5 should succeed
            results.forEach(({ next }) => {
                expect(next).toHaveBeenCalled();
            });
            // 6th request should be blocked
            const res6 = createMockResponse();
            const next6 = createMockNext();
            middleware(req, res6, next6);
            expect(next6).not.toHaveBeenCalled();
            expect(res6.status).toHaveBeenCalledWith(429);
        });
        it('should track remaining count correctly with concurrent requests', () => {
            const middleware = rateLimit({
                windowMs: 60000,
                max: 10,
            });
            const req = createMockRequest({ ip: '192.168.1.31' });
            // Make 3 requests
            const results = Array.from({ length: 3 }, () => {
                const res = createMockResponse();
                middleware(req, res, createMockNext());
                return res;
            });
            // Check remaining on last response
            expect(results[2].headerData['X-RateLimit-Remaining']).toBe(7); // 10 - 3
        });
    });
});
// ============================================================================
// Test Suite: Predefined Rate Limiters
// ============================================================================
describe('Rate Limit Middleware - Predefined Rate Limiters', () => {
    describe('uploadRateLimit', () => {
        it('should limit to 50 uploads per hour per user', () => {
            const req = createMockRequest({
                session: { userId: 'user123' },
            });
            // Make 50 requests
            for (let i = 0; i < 50; i++) {
                uploadRateLimit(req, createMockResponse(), createMockNext());
            }
            // 51st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            uploadRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('file uploads');
        });
        it('should use custom error message for uploads', () => {
            const req = createMockRequest({
                session: { userId: 'user456' },
            });
            // Exceed limit
            for (let i = 0; i < 51; i++) {
                uploadRateLimit(req, createMockResponse(), createMockNext());
            }
            const res = createMockResponse();
            uploadRateLimit(req, res, createMockNext());
            expect(res.jsonData.message).toBe('Too many file uploads. Please try again later.');
        });
    });
    describe('strictUploadRateLimit', () => {
        it('should limit to 10 uploads per hour per IP', () => {
            const req = createMockRequest({ ip: '192.168.1.40' });
            // Make 10 requests
            for (let i = 0; i < 10; i++) {
                strictUploadRateLimit(req, createMockResponse(), createMockNext());
            }
            // 11th request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            strictUploadRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('sign in for higher limits');
        });
        it('should always use IP address (not user ID)', () => {
            const req = createMockRequest({
                ip: '192.168.1.41',
                session: { userId: 'user123' },
            });
            // Make 10 requests
            for (let i = 0; i < 10; i++) {
                strictUploadRateLimit(req, createMockResponse(), createMockNext());
            }
            // Should be blocked even with user ID
            const res = createMockResponse();
            strictUploadRateLimit(req, res, createMockNext());
            expect(res.status).toHaveBeenCalledWith(429);
        });
    });
    describe('apiRateLimit', () => {
        it('should limit to 100 requests per 15 minutes', () => {
            const req = createMockRequest({
                session: { userId: 'user789' },
            });
            // Make 100 requests
            for (let i = 0; i < 100; i++) {
                apiRateLimit(req, createMockResponse(), createMockNext());
            }
            // 101st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            apiRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('authRateLimit', () => {
        it('should limit to 10 auth attempts per 15 minutes per IP', () => {
            const req = createMockRequest({ ip: '192.168.1.50' });
            // Make 10 requests
            for (let i = 0; i < 10; i++) {
                authRateLimit(req, createMockResponse(), createMockNext());
            }
            // 11th request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            authRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('authentication attempts');
        });
        it('should always use IP address for auth (prevent brute force)', () => {
            const req = createMockRequest({
                ip: '192.168.1.51',
                session: { userId: 'user123' },
            });
            // Make 10 requests
            for (let i = 0; i < 10; i++) {
                authRateLimit(req, createMockResponse(), createMockNext());
            }
            // Should be blocked (IP-based, not user-based)
            const res = createMockResponse();
            authRateLimit(req, res, createMockNext());
            expect(res.status).toHaveBeenCalledWith(429);
        });
    });
    describe('invitationRateLimit', () => {
        it('should limit to 20 invitations per hour', () => {
            const req = createMockRequest({
                session: { userId: 'user321' },
            });
            // Make 20 requests
            for (let i = 0; i < 20; i++) {
                invitationRateLimit(req, createMockResponse(), createMockNext());
            }
            // 21st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            invitationRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('invitations');
        });
    });
    describe('tokenCreationRateLimit', () => {
        it('should limit to 10 token creations per hour', () => {
            const req = createMockRequest({
                session: { userId: 'user654' },
            });
            // Make 10 requests
            for (let i = 0; i < 10; i++) {
                tokenCreationRateLimit(req, createMockResponse(), createMockNext());
            }
            // 11th request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            tokenCreationRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('API tokens');
        });
    });
    describe('mutationRateLimit', () => {
        it('should limit to 200 mutations per 15 minutes', () => {
            const req = createMockRequest({
                session: { userId: 'user987' },
            });
            // Make 200 requests
            for (let i = 0; i < 200; i++) {
                mutationRateLimit(req, createMockResponse(), createMockNext());
            }
            // 201st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            mutationRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
        });
    });
    describe('Drive Rate Limiters', () => {
        it('should limit drive file access to 100 per 15 minutes', () => {
            const req = createMockRequest({
                session: { userId: 'user111' },
            });
            // Make 100 requests
            for (let i = 0; i < 100; i++) {
                driveFileAccessRateLimit(req, createMockResponse(), createMockNext());
            }
            // 101st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            driveFileAccessRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('Drive file requests');
        });
        it('should limit drive thumbnails to 200 per 5 minutes', () => {
            const req = createMockRequest({
                session: { userId: 'user222' },
            });
            // Make 200 requests
            for (let i = 0; i < 200; i++) {
                driveThumbnailRateLimit(req, createMockResponse(), createMockNext());
            }
            // 201st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            driveThumbnailRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('thumbnail requests');
        });
        it('should limit drive imports to 50 per hour', () => {
            const req = createMockRequest({
                session: { userId: 'user333' },
            });
            // Make 50 requests
            for (let i = 0; i < 50; i++) {
                driveImportRateLimit(req, createMockResponse(), createMockNext());
            }
            // 51st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            driveImportRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('file imports');
        });
        it('should limit drive listing to 100 per 10 minutes', () => {
            const req = createMockRequest({
                session: { userId: 'user444' },
            });
            // Make 100 requests
            for (let i = 0; i < 100; i++) {
                driveListingRateLimit(req, createMockResponse(), createMockNext());
            }
            // 101st request should be blocked
            const res = createMockResponse();
            const next = createMockNext();
            driveListingRateLimit(req, res, next);
            expect(next).not.toHaveBeenCalled();
            expect(res.jsonData.message).toContain('Drive listing requests');
        });
    });
});
// ============================================================================
// Test Suite: Edge Cases and Error Handling
// ============================================================================
describe('Rate Limit Middleware - Edge Cases', () => {
    it('should handle missing IP address gracefully', () => {
        const middleware = rateLimit({
            windowMs: 60000,
            max: 5,
        });
        const req = createMockRequest({
            ip: undefined,
            socket: {},
            headers: {},
        });
        const res = createMockResponse();
        const next = createMockNext();
        middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });
    it('should handle multiple IPs in X-Forwarded-For', () => {
        const middleware = rateLimit({
            windowMs: 60000,
            max: 1,
        });
        const req = createMockRequest({
            headers: { 'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.0.2.1' },
        });
        middleware(req, createMockResponse(), createMockNext());
        // Second request with same forwarded IPs should be blocked
        const res2 = createMockResponse();
        const next2 = createMockNext();
        middleware(req, res2, next2);
        expect(next2).not.toHaveBeenCalled();
    });
    it('should handle zero max limit', () => {
        const middleware = rateLimit({
            windowMs: 60000,
            max: 0,
        });
        const req = createMockRequest({ ip: '192.168.1.60' });
        const res = createMockResponse();
        const next = createMockNext();
        middleware(req, res, next);
        // Should block immediately
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(429);
    });
    it('should handle very short time windows', async () => {
        const middleware = rateLimit({
            windowMs: 50,
            max: 1,
        });
        const req = createMockRequest({ ip: '192.168.1.61' });
        middleware(req, createMockResponse(), createMockNext());
        await wait(60);
        // Should allow new request after window
        const res2 = createMockResponse();
        const next2 = createMockNext();
        middleware(req, res2, next2);
        expect(next2).toHaveBeenCalled();
    });
    it('should calculate correct retry-after time', async () => {
        const middleware = rateLimit({
            windowMs: 5000, // 5 seconds
            max: 1,
        });
        const req = createMockRequest({ ip: '192.168.1.62' });
        middleware(req, createMockResponse(), createMockNext());
        // Wait 2 seconds
        await wait(2000);
        // Block second request
        const res2 = createMockResponse();
        middleware(req, res2, createMockNext());
        const retryAfter = res2.headerData['Retry-After'];
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(5);
    });
});
