import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection, securityHeaders } from '../../server/middlewares/security-headers';

// Mock Request object
function createMockRequest(overrides = {}): Partial<Request> {
  return {
    method: 'POST',
    protocol: 'https',
    get: jest.fn((header: string) => {
      const headers: Record<string, string> = {
        host: 'example.com',
        origin: 'https://example.com',
        ...overrides,
      };
      return headers[header.toLowerCase()];
    }) as any,
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

describe('CSRF Protection Middleware', () => {
  describe('Method exemptions', () => {
    it('should allow GET requests without origin check', () => {
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests without origin check', () => {
      const req = createMockRequest({ method: 'HEAD' });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without origin check', () => {
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Origin validation', () => {
    it('should allow POST requests with matching origin', () => {
      const req = createMockRequest({
        method: 'POST',
        protocol: 'https',
        get: jest.fn((header: string) => {
          if (header === 'host') return 'example.com';
          if (header === 'origin') return 'https://example.com';
          return null;
        }),
      });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block POST requests with mismatched origin', () => {
      const req = createMockRequest({
        method: 'POST',
        protocol: 'https',
        get: jest.fn((header: string) => {
          if (header === 'host') return 'example.com';
          if (header === 'origin') return 'https://evil.com';
          return null;
        }),
      });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('CSRF'),
      }));
    });

    it('should block POST requests without origin or referer', () => {
      const req = createMockRequest({
        method: 'POST',
        get: jest.fn(() => null),
      });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow POST requests with matching referer when origin is missing', () => {
      const req = createMockRequest({
        method: 'POST',
        protocol: 'https',
        get: jest.fn((header: string) => {
          if (header === 'host') return 'example.com';
          if (header === 'referer') return 'https://example.com/some/path';
          if (header === 'origin') return null;
          return null;
        }),
      });
      const res = createMockResponse();
      const next = createMockNext();

      csrfProtection(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Different HTTP methods', () => {
    ['POST', 'PUT', 'PATCH', 'DELETE'].forEach(method => {
      it(`should validate ${method} requests`, () => {
        const req = createMockRequest({
          method,
          protocol: 'https',
          get: jest.fn((header: string) => {
            if (header === 'host') return 'example.com';
            if (header === 'origin') return 'https://evil.com';
            return null;
          }),
        });
        const res = createMockResponse();
        const next = createMockNext();

        csrfProtection(req as Request, res as Response, next);

        expect(res.status).toHaveBeenCalledWith(403);
      });
    });
  });
});

describe('Security Headers Middleware', () => {
  it('should set X-Content-Type-Options header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  it('should set X-Frame-Options header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
  });

  it('should set X-XSS-Protection header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
  });

  it('should set Referrer-Policy header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

  it('should set Content-Security-Policy header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining("default-src 'self'"));
  });

  it('should set Permissions-Policy header', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', expect.stringContaining('camera=()'));
  });

  it('should call next() to continue the request', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
  });

  it('should set all security headers together', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = createMockNext();

    securityHeaders(req as Request, res as Response, next);

    // Verify all main security headers are set
    expect(res.setHeader).toHaveBeenCalledTimes(6); // 6 security headers
  });
});
