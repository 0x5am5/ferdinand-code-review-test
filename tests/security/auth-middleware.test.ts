import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import type { MockedFunction } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock storage module with proper vitest mock functions
// Use vi.hoisted() to avoid hoisting issues with mock functions
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn() as MockedFunction<any>,
}));

// Mock the storage module before importing auth
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: mockGetUser,
  },
}));

import { requireAuth, requireAdmin, requireSuperAdmin } from '../../server/middlewares/auth';

// Mock Request object
function createMockRequest(overrides = {}): any {
  return {
    session: { userId: 1 } as any,
    ...overrides,
  };
}

// Mock Response object
function createMockResponse(): Partial<Response> {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

// Mock NextFunction
function createMockNext(): NextFunction {
  return vi.fn() as any;
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should allow requests with valid session', () => {
      const req = createMockRequest({ session: { userId: 123 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block requests without session', () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Authentication required'),
      }));
    });

    it('should block requests without userId in session', () => {
      const req = createMockRequest({ session: {} as any });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'admin',
        email: 'admin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(mockGetUser).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow super_admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'super_admin',
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block non-admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'editor',
        email: 'editor@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Admin access required'),
      }));
    });

    it('should block requests without session', async () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      const req = createMockRequest({ session: { userId: 999 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('User not found'),
      }));
    });

    it('should handle database errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Error verifying permissions'),
      }));
    });
  });

  describe('requireSuperAdmin', () => {
    it('should allow super_admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'super_admin',
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block admin users (not super_admin)', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'admin',
        email: 'admin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Super admin access required'),
      }));
    });

    it('should block standard users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: 'standard',
        email: 'user@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block requests without session', async () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
