/**
 * Brand Asset Description Middleware Unit Tests (JUP-29)
 *
 * This test suite validates that the middleware stack properly enforces
 * role-based permissions for editing brand asset descriptions.
 *
 * Test Coverage:
 * - requireMinimumRole(EDITOR) middleware enforcement
 * - Permission checks for all user roles
 * - Authentication requirement validation
 * - Error handling for missing/invalid users
 *
 * Run: npm test tests/unit/brand-asset-description-middleware.test.ts
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';

// Mock storage module with proper jest mock functions
const mockGetUser = jest.fn() as jest.MockedFunction<any>;

// Mock the storage module before importing middlewares
jest.mock('../../server/storage/index.js', () => ({
  storage: {
    getUser: mockGetUser,
  },
}));

import { requireAuth } from '../../server/middlewares/auth';
import { requireMinimumRole } from '../../server/middlewares/requireMinimumRole';

// Mock Request object
function createMockRequest(overrides = {}): any {
  return {
    session: { userId: 1 } as any,
    params: { clientId: '1', assetId: '1' },
    body: {},
    ...overrides,
  };
}

// Mock Response object
function createMockResponse(): Partial<Response> {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

// Mock NextFunction
function createMockNext(): NextFunction {
  return jest.fn() as any;
}

describe('Brand Asset Description Middleware (JUP-29)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementation to avoid cross-test pollution
    mockGetUser.mockReset();
  });

  describe('PATCH /api/clients/:clientId/brand-assets/:assetId/description - Authentication', () => {
    it('should return 401 when no session exists', () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Authentication required'),
        })
      );
    });

    it('should return 401 when userId is missing from session', () => {
      const req = createMockRequest({ session: {} as any });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Authentication required'),
        })
      );
    });

    it('should allow authenticated users to proceed', () => {
      const req = createMockRequest({ session: { userId: 123 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/clients/:clientId/brand-assets/:assetId/description - Role Permissions', () => {
    describe('Privileged Roles - Should Be Allowed', () => {
      it('should allow super admin to update descriptions', async () => {
        mockGetUser.mockResolvedValue({
          id: 1,
          role: UserRole.SUPER_ADMIN,
          email: 'superadmin@example.com',
        });

        const req = createMockRequest({ session: { userId: 1 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(1);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should allow admin to update descriptions', async () => {
        mockGetUser.mockResolvedValue({
          id: 2,
          role: UserRole.ADMIN,
          email: 'admin@example.com',
        });

        const req = createMockRequest({ session: { userId: 2 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(2);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should allow editor to update descriptions', async () => {
        mockGetUser.mockResolvedValue({
          id: 3,
          role: UserRole.EDITOR,
          email: 'editor@example.com',
        });

        const req = createMockRequest({ session: { userId: 3 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(3);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('Unprivileged Roles - Should Be Denied', () => {
      it('should return 403 when standard user tries to update descriptions', async () => {
        mockGetUser.mockResolvedValue({
          id: 4,
          role: UserRole.STANDARD,
          email: 'standard@example.com',
        });

        const req = createMockRequest({ session: { userId: 4 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(4);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('editor role or higher required'),
          })
        );
      });

      it('should return 403 when guest user tries to update descriptions', async () => {
        mockGetUser.mockResolvedValue({
          id: 5,
          role: UserRole.GUEST,
          email: 'guest@example.com',
        });

        const req = createMockRequest({ session: { userId: 5 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(5);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('editor role or higher required'),
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should return 401 when no session exists', async () => {
        const req = createMockRequest({});
        delete req.session;
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Not authenticated'),
          })
        );
      });

      it('should return 401 when userId is missing from session', async () => {
        const req = createMockRequest({ session: {} as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it('should return 404 when user is not found in database', async () => {
        mockGetUser.mockResolvedValue(null);

        const req = createMockRequest({ session: { userId: 999 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(mockGetUser).toHaveBeenCalledWith(999);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('User not found'),
          })
        );
      });

      it('should handle database errors gracefully', async () => {
        mockGetUser.mockRejectedValue(new Error('Database connection failed'));

        const req = createMockRequest({ session: { userId: 1 } as any });
        const res = createMockResponse();
        const next = createMockNext();

        const middleware = requireMinimumRole(UserRole.EDITOR);
        await middleware(req as any, res as Response, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Error verifying permissions'),
          })
        );
      });
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should confirm editor is the minimum required role', async () => {
      // Test that editor exactly meets the requirement
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.EDITOR,
        email: 'editor@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req as any, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should confirm standard role is below required level', async () => {
      mockGetUser.mockResolvedValue({
        id: 2,
        role: UserRole.STANDARD,
        email: 'standard@example.com',
      });

      const req = createMockRequest({ session: { userId: 2 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should confirm guest role is below required level', async () => {
      mockGetUser.mockResolvedValue({
        id: 3,
        role: UserRole.GUEST,
        email: 'guest@example.com',
      });

      const req = createMockRequest({ session: { userId: 3 } as any });
      const res = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req as any, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Complete Middleware Chain Simulation', () => {
    it('should pass through requireAuth then requireMinimumRole for editor', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.EDITOR,
        email: 'editor@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();

      // First middleware: requireAuth
      requireAuth(req as Request, res as Response, next1);
      expect(next1).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();

      // Second middleware: requireMinimumRole(EDITOR)
      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req as any, res as Response, next2);
      expect(next2).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should fail at requireAuth for unauthenticated request', () => {
      const req = createMockRequest({ session: undefined });
      const res = createMockResponse();
      const next1 = createMockNext();

      // First middleware: requireAuth - should fail here
      requireAuth(req as Request, res as Response, next1);
      expect(next1).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);

      // Second middleware: requireMinimumRole would not be reached
    });

    it('should fail at requireMinimumRole for standard user', async () => {
      mockGetUser.mockResolvedValue({
        id: 1,
        role: UserRole.STANDARD,
        email: 'standard@example.com',
      });

      const req = createMockRequest({ session: { userId: 1 } as any });
      const res = createMockResponse();
      const next1 = createMockNext();
      const next2 = createMockNext();

      // First middleware: requireAuth - passes
      requireAuth(req as Request, res as Response, next1);
      expect(next1).toHaveBeenCalled();

      // Second middleware: requireMinimumRole - should fail here
      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req as any, res as Response, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Feature Documentation', () => {
    it('should document the middleware stack for description endpoint', () => {
      const endpointConfig = {
        method: 'PATCH',
        path: '/api/clients/:clientId/brand-assets/:assetId/description',
        middlewares: [
          'validateClientId',
          'requireAuth',
          'requireMinimumRole(UserRole.EDITOR)',
        ],
        allowedRoles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.EDITOR],
        deniedRoles: [UserRole.STANDARD, UserRole.GUEST],
      };

      expect(endpointConfig.middlewares).toContain('requireAuth');
      expect(endpointConfig.middlewares).toContain('requireMinimumRole(UserRole.EDITOR)');
      expect(endpointConfig.allowedRoles).toHaveLength(3);
      expect(endpointConfig.deniedRoles).toHaveLength(2);
    });
  });
});
