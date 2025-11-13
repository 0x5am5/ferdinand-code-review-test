/**
 * Comprehensive Role-Based Access Control (RBAC) Tests
 *
 * This test suite validates that all user roles have appropriate access
 * to features and endpoints based on the access matrix defined in ROUTE_PERMISSIONS.md
 *
 * Roles tested:
 * - GUEST: Read-only access to shared assets
 * - STANDARD: Can create and manage own assets
 * - EDITOR: Full asset management (CRUD + share)
 * - ADMIN: Client-scoped admin access
 * - SUPER_ADMIN: System-wide access
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UserRole } from '@shared/schema';
import type { Client } from '@shared/schema';
import type { Request, Response } from 'express';
import {
  TEST_USERS,
  createMockRequestWithRole,
  createMockResponse,
  createMockNext,
  expectForbidden,
  expectUnauthorized,
  expectAllowed,
  expectBlocked,
} from '../helpers/role-test-helpers';

// Import storage to spy on
import { storage } from '../../server/storage';

// Import modules under test
import { requireAuth, requireAdmin, requireSuperAdmin, canAdminAccessClient } from '../../server/middlewares/auth';
import { requireMinimumRole } from '../../server/middlewares/requireMinimumRole';
import { requireAdminRole } from '../../server/middlewares/requireAdminRole';

describe('Role-Based Access Control (RBAC)', () => {
  // Spy on storage methods
  let mockGetUser: jest.SpiedFunction<typeof storage.getUser>;
  let mockGetUserClients: jest.SpiedFunction<typeof storage.getUserClients>;

  beforeEach(() => {
    // Create spies for storage methods
    mockGetUser = jest.spyOn(storage, 'getUser');
    mockGetUserClients = jest.spyOn(storage, 'getUserClients');
  });

  afterEach(() => {
    // Restore original implementations
    jest.restoreAllMocks();
  });

  describe('Authentication Middleware (requireAuth)', () => {
    it('should allow all authenticated users regardless of role', () => {
      const roles: Array<keyof typeof TEST_USERS> = ['guest', 'standard', 'editor', 'admin', 'superAdmin'];

      roles.forEach((role) => {
        const req = createMockRequestWithRole(role);
        const { res } = createMockResponse();
        const next = createMockNext();

        requireAuth(req as Request, res as Response, next);

        expectAllowed(next);
      });
    });

    it('should block unauthenticated requests', () => {
      const req = { session: undefined } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expectUnauthorized(spies);
      expectBlocked(next);
    });
  });

  describe('Admin Access (requireAdmin)', () => {
    it('should allow ADMIN role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.admin);

      const req = createMockRequestWithRole('admin');
      const { res } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expectAllowed(next);
    });

    it('should allow SUPER_ADMIN role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.superAdmin);

      const req = createMockRequestWithRole('superAdmin');
      const { res } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expectAllowed(next);
    });

    it('should block GUEST role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.guest);

      const req = createMockRequestWithRole('guest');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expectForbidden(spies);
      expectBlocked(next);
    });

    it('should block STANDARD role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.standard);

      const req = createMockRequestWithRole('standard');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expectForbidden(spies);
      expectBlocked(next);
    });

    it('should block EDITOR role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.editor);

      const req = createMockRequestWithRole('editor');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expectForbidden(spies);
      expectBlocked(next);
    });
  });

  describe('Super Admin Access (requireSuperAdmin)', () => {
    it('should allow SUPER_ADMIN role only', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.superAdmin);

      const req = createMockRequestWithRole('superAdmin');
      const { res } = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expectAllowed(next);
    });

    it('should block ADMIN role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.admin);

      const req = createMockRequestWithRole('admin');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireSuperAdmin(req as Request, res as Response, next);

      expectForbidden(spies);
      expectBlocked(next);
    });

    it('should block all non-super-admin roles', async () => {
      const roles: Array<{ role: keyof typeof TEST_USERS; user: typeof TEST_USERS[keyof typeof TEST_USERS] }> = [
        { role: 'guest', user: TEST_USERS.guest },
        { role: 'standard', user: TEST_USERS.standard },
        { role: 'editor', user: TEST_USERS.editor },
        { role: 'admin', user: TEST_USERS.admin },
      ];

      for (const { role, user } of roles) {
        mockGetUser.mockResolvedValue(user);

        const req = createMockRequestWithRole(role);
        const { res, spies } = createMockResponse();
        const next = createMockNext();

        await requireSuperAdmin(req as Request, res as Response, next);

        expectForbidden(spies);
        expectBlocked(next);
      }
    });
  });

  describe('Minimum Role Requirements (requireMinimumRole)', () => {
    describe('EDITOR minimum role', () => {
      const middleware = requireMinimumRole(UserRole.EDITOR);

      it('should allow EDITOR role', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.editor);

        const req = createMockRequestWithRole('editor');
        const { res } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectAllowed(next);
      });

      it('should allow ADMIN role (higher)', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.admin);

        const req = createMockRequestWithRole('admin');
        const { res } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectAllowed(next);
      });

      it('should allow SUPER_ADMIN role (higher)', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.superAdmin);

        const req = createMockRequestWithRole('superAdmin');
        const { res } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectAllowed(next);
      });

      it('should block STANDARD role (lower)', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.standard);

        const req = createMockRequestWithRole('standard');
        const { res, spies } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectForbidden(spies);
        expectBlocked(next);
      });

      it('should block GUEST role (lower)', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.guest);

        const req = createMockRequestWithRole('guest');
        const { res, spies } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectForbidden(spies);
        expectBlocked(next);
      });
    });

    describe('STANDARD minimum role', () => {
      const middleware = requireMinimumRole(UserRole.STANDARD);

      it('should allow STANDARD and above', async () => {
        const roles = [
          { role: 'standard' as const, user: TEST_USERS.standard },
          { role: 'editor' as const, user: TEST_USERS.editor },
          { role: 'admin' as const, user: TEST_USERS.admin },
          { role: 'superAdmin' as const, user: TEST_USERS.superAdmin },
        ];

        for (const { role, user } of roles) {
          mockGetUser.mockResolvedValue(user);

          const req = createMockRequestWithRole(role);
          const { res } = createMockResponse();
          const next = createMockNext();

          await middleware(req as any, res as Response, next);

          expectAllowed(next);
        }
      });

      it('should block GUEST role', async () => {
        mockGetUser.mockResolvedValue(TEST_USERS.guest);

        const req = createMockRequestWithRole('guest');
        const { res, spies } = createMockResponse();
        const next = createMockNext();

        await middleware(req as any, res as Response, next);

        expectForbidden(spies);
        expectBlocked(next);
      });
    });
  });

  describe('Admin Role Middleware (requireAdminRole)', () => {
    it('should allow ADMIN role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.admin);

      const req = createMockRequestWithRole('admin');
      const { res } = createMockResponse();
      const next = createMockNext();

      await requireAdminRole(req as any, res as Response, next);

      expectAllowed(next);
    });

    it('should allow SUPER_ADMIN role', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.superAdmin);

      const req = createMockRequestWithRole('superAdmin');
      const { res } = createMockResponse();
      const next = createMockNext();

      await requireAdminRole(req as any, res as Response, next);

      expectAllowed(next);
    });

    it('should block non-admin roles', async () => {
      const roles = [
        { role: 'guest' as const, user: TEST_USERS.guest },
        { role: 'standard' as const, user: TEST_USERS.standard },
        { role: 'editor' as const, user: TEST_USERS.editor },
      ];

      for (const { role, user } of roles) {
        mockGetUser.mockResolvedValue(user);

        const req = createMockRequestWithRole(role);
        const { res, spies } = createMockResponse();
        const next = createMockNext();

        await requireAdminRole(req as any, res as Response, next);

        expectForbidden(spies);
        expectBlocked(next);
      }
    });
  });

  describe('Client-Scoped Admin Access (canAdminAccessClient)', () => {
    const TEST_CLIENT_ID = 100;

    const createMockClient = (id: number, name: string): Client => ({
      id,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      description: null,
      website: null,
      address: null,
      phone: null,
      primaryColor: null,
      displayOrder: null,
      userId: null,
      logo: null,
      featureToggles: {
        logoSystem: true,
        colorSystem: true,
        typeSystem: true,
        userPersonas: true,
        inspiration: true,
        figmaIntegration: false,
        slackIntegration: false,
        brandAssets: true,
      },
      lastEditedBy: null,
    });

    it('should allow SUPER_ADMIN to access any client', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.superAdmin);

      const hasAccess = await canAdminAccessClient(TEST_USERS.superAdmin.id, TEST_CLIENT_ID);

      expect(hasAccess).toBe(true);
    });

    it('should allow ADMIN to access assigned clients', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.admin);
      mockGetUserClients.mockResolvedValue([
        createMockClient(TEST_CLIENT_ID, 'Test Client'),
      ]);

      const hasAccess = await canAdminAccessClient(TEST_USERS.admin.id, TEST_CLIENT_ID);

      expect(hasAccess).toBe(true);
      expect(mockGetUserClients).toHaveBeenCalledWith(TEST_USERS.admin.id);
    });

    it('should block ADMIN from accessing non-assigned clients', async () => {
      mockGetUser.mockResolvedValue(TEST_USERS.admin);
      mockGetUserClients.mockResolvedValue([
        createMockClient(999, 'Other Client'),
      ]);

      const hasAccess = await canAdminAccessClient(TEST_USERS.admin.id, TEST_CLIENT_ID);

      expect(hasAccess).toBe(false);
    });

    it('should block non-admin roles', async () => {
      const roles = [
        TEST_USERS.guest,
        TEST_USERS.standard,
        TEST_USERS.editor,
      ];

      for (const user of roles) {
        mockGetUser.mockResolvedValue(user);

        const hasAccess = await canAdminAccessClient(user.id, TEST_CLIENT_ID);

        expect(hasAccess).toBe(false);
      }
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should enforce correct role hierarchy order', async () => {
      // Test that higher roles can access lower role features
      const hierarchy = [
        { role: 'guest' as const, level: 1 },
        { role: 'standard' as const, level: 2 },
        { role: 'editor' as const, level: 3 },
        { role: 'admin' as const, level: 4 },
        { role: 'superAdmin' as const, level: 5 },
      ];

      // For each minimum role level, test that higher roles pass
      for (let minLevel = 1; minLevel <= 5; minLevel++) {
        const minRole = hierarchy.find(h => h.level === minLevel)!;
        const middleware = requireMinimumRole(TEST_USERS[minRole.role].role as any);

        for (const { role, level } of hierarchy) {
          mockGetUser.mockResolvedValue(TEST_USERS[role]);

          const req = createMockRequestWithRole(role);
          const { res, spies } = createMockResponse();
          const next = createMockNext();

          await middleware(req as any, res as Response, next);

          if (level >= minLevel) {
            expectAllowed(next);
          } else {
            expectForbidden(spies);
            expectBlocked(next);
          }

          jest.clearAllMocks();
        }
      }
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle missing user gracefully', async () => {
      mockGetUser.mockResolvedValue(undefined);

      const req = createMockRequestWithRole('admin');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(spies.status).toHaveBeenCalledWith(401);
      expectBlocked(next);
    });

    it('should handle database errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Database error'));

      const req = createMockRequestWithRole('admin');
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      await requireAdmin(req as Request, res as Response, next);

      expect(spies.status).toHaveBeenCalledWith(500);
      expectBlocked(next);
    });

    it('should not allow session without userId', () => {
      const req = { session: {} } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      requireAuth(req as Request, res as Response, next);

      expectUnauthorized(spies);
      expectBlocked(next);
    });
  });
});
