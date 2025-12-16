import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit, clearRateLimitStore } from '../../server/middlewares/rate-limit';

// Mock Request object
function createMockRequest(overrides = {}): Partial<Request> {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' } as any,
    headers: {},
    session: { userId: 1 } as any,
    ...overrides,
  };
}

// Mock Response object
function createMockResponse(): Partial<Response> {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

// Mock NextFunction
function createMockNext(): NextFunction {
  return vi.fn() as any;
}

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear any existing rate limit records between tests
    clearRateLimitStore();
    vi.clearAllMocks();
  });

  describe('Basic rate limiting', () => {
    it('should allow requests within the limit', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 5,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding the limit', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 2,
      });

      const req = createMockRequest({ ip: '192.168.1.100' });
      const res = createMockResponse();

      // Make 3 requests (1 more than limit)
      middleware(req as Request, res as Response, createMockNext());
      middleware(req as Request, res as Response, createMockNext());
      middleware(req as Request, res as Response, createMockNext());

      // Third request should be blocked
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.any(String),
      }));
    });

    it('should set rate limit headers', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 10,
      });

      const req = createMockRequest({ ip: '192.168.1.101' });
      const res = createMockResponse();
      const next = createMockNext();

      // First request - no headers set
      middleware(req as Request, res as Response, next);

      // Second request - headers should be set
      const res2 = createMockResponse();
      const next2 = createMockNext();
      middleware(req as Request, res2 as Response, next2);

      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 8);
      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('Key generation', () => {
    it('should use userId when authenticated', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 3,
      });

      const req1 = createMockRequest({ session: { userId: 123 }, ip: '10.0.0.1' });
      const req2 = createMockRequest({ session: { userId: 123 }, ip: '10.0.0.2' }); // Different IP, same user

      const res1 = createMockResponse();
      const res2 = createMockResponse();

      // Both requests from the same user should share the rate limit
      middleware(req1 as Request, res1 as Response, createMockNext());
      middleware(req2 as Request, res2 as Response, createMockNext());

      // Second request should show decremented remaining count
      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
    });

    it('should use IP address for unauthenticated users', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 3,
      });

      const req1 = createMockRequest({ session: undefined, ip: '10.0.0.10' });
      const req2 = createMockRequest({ session: undefined, ip: '10.0.0.11' }); // Different IP

      // First requests from each IP - no headers set
      middleware(req1 as Request, createMockResponse() as Response, createMockNext());
      middleware(req2 as Request, createMockResponse() as Response, createMockNext());

      // Second requests from each IP - headers should be set
      const res1 = createMockResponse();
      const res2 = createMockResponse();
      middleware(req1 as Request, res1 as Response, createMockNext());
      middleware(req2 as Request, res2 as Response, createMockNext());

      // Different IPs should have independent rate limits
      expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
    });
  });

  describe('Custom key generator', () => {
    it('should use custom key generator when provided', () => {
      const customKeyGen = (req: Request) => `custom-${req.ip}`;
      const middleware = rateLimit({
        windowMs: 60000,
        max: 2,
        keyGenerator: customKeyGen,
      });

      const req = createMockRequest({ ip: '10.0.0.20' });

      // First request - no headers set
      middleware(req as Request, createMockResponse() as Response, createMockNext());

      // Second request - headers should be set
      const res = createMockResponse();
      middleware(req as Request, res as Response, createMockNext());

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    });
  });

  describe('Retry-After header', () => {
    it('should set Retry-After header when limit exceeded', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 1,
      });

      const req = createMockRequest({ ip: '10.0.0.30' });
      const res = createMockResponse();

      // First request - allowed
      middleware(req as Request, res as Response, createMockNext());

      // Second request - blocked
      middleware(req as Request, res as Response, createMockNext());

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

});
