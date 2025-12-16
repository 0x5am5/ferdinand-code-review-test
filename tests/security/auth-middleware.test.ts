import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock the storage module before importing auth
vi.mock('../../server/storage', () => ({
  storage: {
    getUser: vi.fn(),
  },
}));

// Mock the audit-logger module to prevent side effects during tests
vi.mock('../../server/utils/audit-logger', () => ({
  logRoleSwitchingAudit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { requireAuth, canAdminAccessClient, canAdminAccessUser } from '../../server/middlewares/auth';
import { requireMinimumRole } from '../../server/middlewares/requireMinimumRole';
import { UserRole } from '@shared/schema';
import { storage } from '../../server/storage';

const mockGetUser = storage.getUser as ReturnType<typeof vi.fn>;

// Mock Request object
function createMockRequest(overrides = {}): any {
  return {
    session: { userId: 1 } as any,
    path: '/test',
    method: 'GET',
    headers: {},
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

  describe('requireMinimumRole(ADMIN)', () => {
    it('should allow admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.ADMIN,
        email: 'admin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(mockGetUser).toHaveBeenCalledWith(1);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow super_admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block non-admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.EDITOR,
        email: 'editor@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('admin role or higher required'),
      }));
    });

    it('should block requests without session', async () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should handle user not found', async () => {
      mockGetUser.mockResolvedValue(null);

      const req = createMockRequest({ session: { userId: 999 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('User not found'),
      }));
    });

    it('should handle database errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Database error'));

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Error verifying permissions'),
      }));
    });
  });

  describe('requireMinimumRole(SUPER_ADMIN)', () => {
    it('should allow super_admin users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.SUPER_ADMIN)(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block admin users (not super_admin)', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.ADMIN,
        email: 'admin@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.SUPER_ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('super_admin role or higher required'),
      }));
    });

    it('should block standard users', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.STANDARD,
        email: 'user@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.SUPER_ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block requests without session', async () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.SUPER_ADMIN)(req as any, res as Response, next);

      expect(mockGetUser).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Role Switching with X-Viewing-Role Header', () => {
    it('should allow super_admin to switch to admin role', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: { 'x-viewing-role': UserRole.ADMIN },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow super_admin to switch to editor role', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: { 'x-viewing-role': UserRole.EDITOR },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.EDITOR)(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should block super_admin viewing as editor from admin-only endpoint', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: { 'x-viewing-role': UserRole.EDITOR },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('admin role or higher required'),
      }));
    });

    it('should block non-super_admin from using X-Viewing-Role header', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.ADMIN,
        email: 'admin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: { 'x-viewing-role': UserRole.EDITOR },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.EDITOR)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('super administrators'),
      }));
    });

    it('should block invalid role values in X-Viewing-Role header', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.SUPER_ADMIN,
        email: 'superadmin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: { 'x-viewing-role': 'invalid_role' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.EDITOR)(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Invalid viewing role'),
      }));
    });

    it('should use actual role when no X-Viewing-Role header is present', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.ADMIN,
        email: 'admin@example.com',
      });

      const req = createMockRequest({
        session: { userId: 1 } as any,
        headers: {},
      });
      const res = createMockResponse();
      const next = createMockNext();

      await requireMinimumRole(UserRole.ADMIN)(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
