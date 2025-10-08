import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../../server/middlewares/rate-limit';

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
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

// Mock NextFunction
function createMockNext(): NextFunction {
  return jest.fn() as any;
}

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Clear any existing rate limit records between tests
    jest.clearAllMocks();
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

      middleware(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
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

      const res1 = createMockResponse();
      const res2 = createMockResponse();

      middleware(req1 as Request, res1 as Response, createMockNext());
      middleware(req2 as Request, res2 as Response, createMockNext());

      // Different IPs should have independent rate limits
      expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
      expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
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
      const res = createMockResponse();

      middleware(req as Request, res as Response, createMockNext());

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
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

  describe('Independent rate limits', () => {
    it('should maintain separate limits for different routes/middleware instances', () => {
      const middleware1 = rateLimit({ windowMs: 60000, max: 2 });
      const middleware2 = rateLimit({ windowMs: 60000, max: 5 });

      const req = createMockRequest({ session: { userId: 999 }, ip: '10.0.0.40' });

      // Use middleware1 twice
      middleware1(req as Request, createMockResponse() as Response, createMockNext());
      middleware1(req as Request, createMockResponse() as Response, createMockNext());

      // middleware2 should have its own independent limit
      const res = createMockResponse();
      middleware2(req as Request, res as Response, createMockNext());

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
    });
  });
});
