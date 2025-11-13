import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UserRole } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";

/**
 * Test helper utilities for simulating different user roles
 * Used across all role-based access control tests
 */

export const TEST_USERS = {
  guest: {
    id: 1,
    email: "guest@test.com",
    name: "Test Guest",
    role: UserRole.GUEST,
    password: null,
    createdAt: null,
    updatedAt: null,
    lastLogin: null,
  },
  standard: {
    id: 2,
    email: "standard@test.com",
    name: "Test Standard",
    role: UserRole.STANDARD,
    password: null,
    createdAt: null,
    updatedAt: null,
    lastLogin: null,
  },
  editor: {
    id: 3,
    email: "editor@test.com",
    name: "Test Editor",
    role: UserRole.EDITOR,
    password: null,
    createdAt: null,
    updatedAt: null,
    lastLogin: null,
  },
  admin: {
    id: 4,
    email: "admin@test.com",
    name: "Test Admin",
    role: UserRole.ADMIN,
    password: null,
    createdAt: null,
    updatedAt: null,
    lastLogin: null,
  },
  superAdmin: {
    id: 5,
    email: "superadmin@test.com",
    name: "Test Super Admin",
    role: UserRole.SUPER_ADMIN,
    password: null,
    createdAt: null,
    updatedAt: null,
    lastLogin: null,
  },
};

/**
 * Create a mock Express Request object with a specific user role
 */
export function createMockRequestWithRole(
  role: keyof typeof TEST_USERS,
  overrides: Partial<Request> = {}
): Partial<Request> {
  const user = TEST_USERS[role];
  return {
    session: {
      userId: user.id,
      cookie: {} as any,
      regenerate: () => {},
      destroy: () => {},
      reload: () => {},
      resetMaxAge: () => {},
      save: () => {},
      touch: () => {},
      id: "test-session-id",
    } as any,
    ...overrides,
  };
}

/**
 * Create a mock Express Response object with jest spies
 */
export function createMockResponse(): {
  res: Partial<Response>;
  spies: {
    status: jest.MockedFunction<any>;
    json: jest.MockedFunction<any>;
    send: jest.MockedFunction<any>;
    sendStatus: jest.MockedFunction<any>;
  };
} {
  const spies = {
    status: jest.fn().mockReturnThis() as jest.MockedFunction<any>,
    json: jest.fn().mockReturnThis() as jest.MockedFunction<any>,
    send: jest.fn().mockReturnThis() as jest.MockedFunction<any>,
    sendStatus: jest.fn().mockReturnThis() as jest.MockedFunction<any>,
  };

  return {
    res: spies as any,
    spies,
  };
}

/**
 * Create a mock NextFunction
 */
export function createMockNext(): jest.MockedFunction<any> {
  return jest.fn() as jest.MockedFunction<any>;
}

/**
 * Helper to assert that a request was denied with 403 Forbidden
 */
export function expectForbidden(res: any) {
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.any(String),
    })
  );
}

/**
 * Helper to assert that a request was denied with 401 Unauthorized
 */
export function expectUnauthorized(res: any) {
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.any(String),
    })
  );
}

/**
 * Helper to assert that a request was allowed (next was called)
 */
export function expectAllowed(next: any) {
  expect(next).toHaveBeenCalled();
}

/**
 * Helper to assert that a request was blocked (next was NOT called)
 */
export function expectBlocked(next: any) {
  expect(next).not.toHaveBeenCalled();
}
