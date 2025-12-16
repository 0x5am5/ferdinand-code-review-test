/**
 * Test Database Mock
 *
 * Provides a simple in-memory database mock for tests
 * to avoid requiring real database connections during testing.
 */

import type { User, Client, TestUser, TestClient } from '@shared/schema';
import { vi } from 'vitest';

// In-memory storage for test data
const testData = {
  users: new Map<number, User>(),
  clients: new Map<number, Client>(),
  userClients: new Map<number, { userId: number; clientId: number }>(),
  sessions: new Map<string, any>(),
  nextUserId: 1,
  nextClientId: 1,
  nextUserClientId: 1,
};

/**
 * Reset all test data between tests
 */
export function resetTestDatabase() {
  testData.users.clear();
  testData.clients.clear();
  testData.userClients.clear();
  testData.sessions.clear();
  testData.nextUserId = 1;
  testData.nextClientId = 1;
  testData.nextUserClientId = 1;
}

/**
 * Create a mock database instance with basic operations
 */
export const testDb = {
  /**
   * Mock select query builder
   */
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        // Return array of matching users
        then: vi.fn((resolve) => {
          const results: User[] = [];
          testData.users.forEach((user) => results.push(user));
          return Promise.resolve(results);
        }),
      })),
      // For queries without where clause
      then: vi.fn((resolve) => {
        const results: User[] = [];
        testData.users.forEach((user) => results.push(user));
        return Promise.resolve(results);
      }),
    })),
  })),

  /**
   * Mock insert query builder
   */
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => {
        return Promise.resolve([{ id: testData.nextUserId++ }]);
      }),
      // For inserts without returning
      then: vi.fn((resolve) => {
        return Promise.resolve({ insertId: testData.nextUserId++ });
      }),
    })),
  })),

  /**
   * Mock delete query builder
   */
  delete: vi.fn(() => ({
    where: vi.fn(() => {
      return Promise.resolve();
    }),
  })),

  /**
   * Mock update query builder
   */
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => {
        return Promise.resolve();
      }),
    })),
  })),
};

/**
 * Test helper: Add a user to the test database
 */
export function addTestUser(user: Partial<User> & { email: string; role: string }): User {
  const id = testData.nextUserId++;
  const fullUser: User = {
    id,
    email: user.email,
    name: user.name || `Test User ${id}`,
    role: user.role as any,
    password: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: null,
  };
  testData.users.set(id, fullUser);
  return fullUser;
}

/**
 * Test helper: Add a client to the test database
 */
export function addTestClient(client: Partial<Client> & { name: string }): Client {
  const id = testData.nextClientId++;
  const fullClient: Client = {
    id,
    name: client.name,
    description: client.description || null,
    website: null,
    address: null,
    phone: null,
    logo: null,
    primaryColor: null,
    displayOrder: null,
    userId: client.userId || null,
    featureToggles: {},
    lastEditedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  testData.clients.set(id, fullClient);
  return fullClient;
}

/**
 * Test helper: Get user by ID
 */
export function getTestUser(id: number): User | undefined {
  return testData.users.get(id);
}

/**
 * Test helper: Get user by email
 */
export function getTestUserByEmail(email: string): User | undefined {
  for (const user of testData.users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return undefined;
}

/**
 * Test helper: Associate user with client
 */
export function associateTestUserWithClient(userId: number, clientId: number) {
  const id = testData.nextUserClientId++;
  testData.userClients.set(id, { userId, clientId });
}

// Export the test database for use in tests
export { testData };
