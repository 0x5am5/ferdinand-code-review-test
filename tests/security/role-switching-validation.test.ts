/**
import type { MockedFunction } from 'vitest';
 * Role Switching Validation Security Tests
 *
 * Comprehensive test suite for X-Viewing-Role header validation and authorization.
 * Ensures that role switching is properly secured and cannot be exploited for privilege escalation.
 *
 * Security Requirements Tested:
 * - Only SUPER_ADMIN users can use role switching
 * - Non-admins attempting to use the header are denied (prevents privilege escalation)
 * - Invalid role values are rejected
 * - All attempts are logged for audit purposes
 * - Clear 403 responses for unauthorized attempts
 *
 * Run: npm test -- tests/security/role-switching-validation.test.ts
 */

import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@shared/schema';
import {
  TEST_USERS,
  createMockRequestWithRole,
  createMockResponse,
  createMockNext,
  expectForbidden,
  expectAllowed,
  expectBlocked,
} from '../helpers/role-test-helpers';

// Mock storage module
// Use vi.hoisted() to avoid hoisting issues with mock functions
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn() as MockedFunction<any>,
}));

vi.mock('../../server/storage', () => ({
  storage: {
    getUser: mockGetUser,
  },
}));

// Mock audit logger to verify logging calls
// Use vi.hoisted() for these mocks as well
const { mockLogRoleSwitchingAudit, mockGetClientIp } = vi.hoisted(() => ({
  mockLogRoleSwitchingAudit: vi.fn() as MockedFunction<any>,
  mockGetClientIp: vi.fn((req: any) => {
    if (req?.ip) return req.ip;
    if (req?.headers?.['x-forwarded-for']) {
      const forwarded = req.headers['x-forwarded-for'];
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return undefined;
  }),
}));

vi.mock('../../server/utils/audit-logger', () => ({
  logRoleSwitchingAudit: (arg: any) => mockLogRoleSwitchingAudit(arg),
  getClientIp: (arg: any) => mockGetClientIp(arg),
}));

// Import middleware after mocks are set up
import { requireMinimumRole } from '../../server/middlewares/requireMinimumRole';

describe('Role Switching Validation Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockImplementation((userId: number) => {
      const user = Object.values(TEST_USERS).find((u) => u.id === userId);
      return Promise.resolve(user || null);
    });
  });

  describe('Super Admin Role Switching (Allowed)', () => {
    it('should allow super admin to switch to ADMIN role', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.ADMIN,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(spies.status).not.toHaveBeenCalled();
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USERS.superAdmin.id,
          userRole: UserRole.SUPER_ADMIN,
          requestedViewingRole: UserRole.ADMIN,
          authorizationDecision: 'allowed',
        })
      );
    });

    it('should allow super admin to switch to EDITOR role', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.EDITOR,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(spies.status).not.toHaveBeenCalled();
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationDecision: 'allowed',
          requestedViewingRole: UserRole.EDITOR,
        })
      );
    });

    it('should allow super admin to switch to STANDARD role', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.STANDARD,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.STANDARD);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationDecision: 'allowed',
          requestedViewingRole: UserRole.STANDARD,
        })
      );
    });

    it('should allow super admin to switch to GUEST role', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.GUEST,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.GUEST);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationDecision: 'allowed',
          requestedViewingRole: UserRole.GUEST,
        })
      );
    });

    it('should allow super admin to use their actual role when no header is present', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {},
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.SUPER_ADMIN);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(spies.status).not.toHaveBeenCalled();
      // Should not log when no header is present
      expect(mockLogRoleSwitchingAudit).not.toHaveBeenCalled();
    });
  });

  describe('Privilege Escalation Prevention (Denied)', () => {
    it('should deny ADMIN user attempting to use X-Viewing-Role header', async () => {
      const req = {
        ...createMockRequestWithRole('admin', {
          headers: {
            'x-viewing-role': UserRole.SUPER_ADMIN,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(spies.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Role switching is only available for super administrators'),
        })
      );
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USERS.admin.id,
          userRole: UserRole.ADMIN,
          requestedViewingRole: UserRole.SUPER_ADMIN,
          authorizationDecision: 'denied',
          reason: expect.stringContaining('Non-super-admin user'),
        })
      );
    });

    it('should deny EDITOR user attempting to use X-Viewing-Role header', async () => {
      const req = {
        ...createMockRequestWithRole('editor', {
          headers: {
            'x-viewing-role': UserRole.ADMIN,
          },
        }),
        path: '/api/test',
        method: 'POST',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userRole: UserRole.EDITOR,
          authorizationDecision: 'denied',
        })
      );
    });

    it('should deny STANDARD user attempting to use X-Viewing-Role header', async () => {
      const req = {
        ...createMockRequestWithRole('standard', {
          headers: {
            'x-viewing-role': UserRole.ADMIN,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.STANDARD);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userRole: UserRole.STANDARD,
          authorizationDecision: 'denied',
        })
      );
    });

    it('should deny GUEST user attempting to use X-Viewing-Role header', async () => {
      const req = {
        ...createMockRequestWithRole('guest', {
          headers: {
            'x-viewing-role': UserRole.EDITOR,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.GUEST);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userRole: UserRole.GUEST,
          authorizationDecision: 'denied',
        })
      );
    });
  });

  describe('Invalid Role Value Validation', () => {
    it('should deny super admin with invalid role value', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': 'invalid_role',
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.SUPER_ADMIN);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(spies.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid viewing role specified'),
        })
      );
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationDecision: 'denied',
          reason: expect.stringContaining('Invalid role value'),
        })
      );
    });

    it('should deny super admin with empty string role value', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': '',
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.SUPER_ADMIN);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expectForbidden(res);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationDecision: 'denied',
        })
      );
    });

    it('should handle array header values (take first value)', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': [UserRole.ADMIN, UserRole.EDITOR],
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expectAllowed(next);
      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedViewingRole: UserRole.ADMIN,
          authorizationDecision: 'allowed',
        })
      );
    });
  });

  describe('Audit Logging', () => {
    it('should log all required audit fields for allowed role switch', async () => {
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.EDITOR,
          },
        }),
        path: '/api/clients/123',
        method: 'POST',
        ip: '192.168.1.1',
      } as any;
      const { res } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.EDITOR);
      await middleware(req, res as Response, next);

      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USERS.superAdmin.id,
          userEmail: TEST_USERS.superAdmin.email,
          userRole: UserRole.SUPER_ADMIN,
          requestedViewingRole: UserRole.EDITOR,
          authorizationDecision: 'allowed',
          timestamp: expect.any(Date),
          requestPath: '/api/clients/123',
          requestMethod: 'POST',
          ipAddress: '192.168.1.1',
        })
      );
    });

    it('should log all required audit fields for denied role switch', async () => {
      const req = {
        ...createMockRequestWithRole('admin', {
          headers: {
            'x-viewing-role': UserRole.SUPER_ADMIN,
          },
        }),
        path: '/api/users',
        method: 'DELETE',
        ip: '10.0.0.1',
      } as any;
      const { res } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expect(mockLogRoleSwitchingAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USERS.admin.id,
          userEmail: TEST_USERS.admin.email,
          userRole: UserRole.ADMIN,
          requestedViewingRole: UserRole.SUPER_ADMIN,
          authorizationDecision: 'denied',
          reason: expect.any(String),
          timestamp: expect.any(Date),
          requestPath: '/api/users',
          requestMethod: 'DELETE',
          ipAddress: '10.0.0.1',
        })
      );
    });
  });

  describe('Effective Role Permission Checks', () => {
    it('should enforce permissions based on effective (switched) role, not actual role', async () => {
      // Super admin switches to GUEST role, then tries to access ADMIN-only endpoint
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.GUEST,
          },
        }),
        path: '/api/users',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      // Require ADMIN role
      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      // Should be denied because effective role (GUEST) doesn't meet ADMIN requirement
      expectBlocked(next);
      expectForbidden(res);
      expect(spies.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('ADMIN role or higher required'),
        })
      );
    });

    it('should allow access when effective role meets minimum requirement', async () => {
      // Super admin switches to ADMIN role, then accesses ADMIN-only endpoint
      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.ADMIN,
          },
        }),
        path: '/api/users',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      // Require ADMIN role
      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      // Should be allowed because effective role (ADMIN) meets requirement
      expectAllowed(next);
      expect(spies.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user gracefully', async () => {
      mockGetUser.mockResolvedValue(null);

      const req = {
        ...createMockRequestWithRole('superAdmin', {
          headers: {
            'x-viewing-role': UserRole.ADMIN,
          },
        }),
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expect(spies.status).toHaveBeenCalledWith(404);
      expect(spies.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not found',
        })
      );
    });

    it('should handle unauthenticated requests', async () => {
      const req = {
        session: undefined,
        headers: {
          'x-viewing-role': UserRole.ADMIN,
        },
      } as any;
      const { res, spies } = createMockResponse();
      const next = createMockNext();

      const middleware = requireMinimumRole(UserRole.ADMIN);
      await middleware(req, res as Response, next);

      expectBlocked(next);
      expect(spies.status).toHaveBeenCalledWith(401);
      expect(spies.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Not authenticated',
        })
      );
    });
  });
});

