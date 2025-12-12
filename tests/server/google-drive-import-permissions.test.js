/**
 * Google Drive Import Permission Tests for SUPER_ADMIN Bypass
 *
 * These tests verify that the SUPER_ADMIN bypass functionality works correctly
 * for Google Drive imports while maintaining security for other roles.
 *
 * Test Coverage:
 * - SUPER_ADMIN can import into any client without userClients entry
 * - Non-super_admins are blocked without userClients entry
 * - Audit fields record correct uploader userId
 * - Import logic passes correct clientId
 *
 * To run these tests:
 * npm test -- google-drive-import-permissions.test.ts
 */

const { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } = require('vitest');
const request = require('supertest');
const { db } = require('../../server/db');
const { users, clients, userClients, googleDriveConnections, assets } = require('../../shared/schema');
const { eq } = require('drizzle-orm');

// Mock app for testing
const app = require('../../server/index');

const API_BASE = 'http://localhost:3001/api';
let superAdminAuthCookie;
let regularAdminAuthCookie;
let standardUserAuthCookie;
let superAdminUserId;
let regularAdminUserId;
let standardUserId;
let testClientId;
let anotherClientId;
let unauthorizedClientId;

// Type declarations for test responses
const TestUser = class {
  constructor(id, email, name, role) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.role = role;
  }
};

const TestClient = class {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }
};

const LoginResponse = class {
  constructor(headers, body) {
    this.headers = headers;
    this.body = body;
  }
};

const ClientResponse = class {
  constructor(body) {
    this.body = body;
  }
};

// Test data cleanup utilities
const cleanupTestData = async () => {
  try {
    // Clean up in order to respect foreign key constraints
    await db.delete(assets);
    await db.delete(googleDriveConnections);
    await db.delete(userClients);
    await db.delete(clients);
    await db.delete(users);
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
};

// Create test users with proper roles
const createTestUsers = async () => {
  // Create super admin
  const [superAdmin] = await db.insert(users).values({
    email: 'superadmin@test.com',
    name: 'Super Admin',
    role: 'super_admin',
    password: 'test-password'
  }).returning();
  superAdminUserId = superAdmin.id;

  // Create regular admin
  const [regularAdmin] = await db.insert(users).values({
    email: 'admin@test.com',
    name: 'Regular Admin',
    role: 'admin',
    password: 'test-password'
  }).returning();
  regularAdminUserId = regularAdmin.id;

  // Create standard user
  const [standardUser] = await db.insert(users).values({
    email: 'standard@test.com',
    name: 'Standard User',
    role: 'standard',
    password: 'test-password'
  }).returning();
  standardUserId = standardUser.id;

  return { superAdmin, regularAdmin, standardUser };
};

// Create test clients
const createTestClients = async () => {
  const [client1] = await db.insert(clients).values({
    name: 'Test Client 1',
    description: 'First test client'
  }).returning();
  testClientId = client1.id;

  const [client2] = await db.insert(clients).values({
    name: 'Test Client 2',
    description: 'Second test client'
  }).returning();
  anotherClientId = client2.id;

  const [client3] = await db.insert(clients).values({
    name: 'Unauthorized Client',
    description: 'Client for testing unauthorized access'
  }).returning();
  unauthorizedClientId = client3.id;

  return { client1, client2, client3 };
};

// Set up user-client associations
const setupUserClientAssociations = async () => {
  // Regular admin has access to testClientId only
  await db.insert(userClients).values({
    userId: regularAdminUserId,
    clientId: testClientId
  });

  // Standard user has access to testClientId and anotherClientId
  await db.insert(userClients).values({
    userId: standardUserId,
    clientId: testClientId
  });

  await db.insert(userClients).values({
    userId: standardUserId,
    clientId: anotherClientId
  });

  // Super admin has no explicit userClients entries (testing bypass functionality)
};

// Authenticate users and get cookies
const authenticateUsers = async () => {
  // Super admin login
  const superAdminResponse = new LoginResponse(
    await request(app)
    .post('/api/auth/login')
    .send({
      email: 'superadmin@test.com',
      password: 'test-password'
    });
  superAdminAuthCookie = superAdminResponse.headers['set-cookie'];

  // Regular admin login
  const regularAdminResponse = new LoginResponse(
    await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@test.com',
      password: 'test-password'
    });
  regularAdminAuthCookie = regularAdminResponse.headers['set-cookie'];

  // Standard user login
  const standardResponse = new LoginResponse(
    await request(app)
    .post('/api/auth/login')
    .send({
      email: 'standard@test.com',
      password: 'test-password'
    });
  standardUserAuthCookie = standardResponse.headers['set-cookie'];

  return { superAdminAuthCookie, regularAdminAuthCookie, standardUserAuthCookie };
};

// Mock Google Drive connection for testing
const setupMockGoogleDriveConnection = async (userId) => {
  await db.insert(googleDriveConnections).values({
    userId,
    encryptedAccessToken: 'mock-encrypted-access-token',
    encryptedRefreshToken: 'mock-encrypted-refresh-token',
    scopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
    ]
  });
};

describe('Google Drive Import Permissions - SUPER_ADMIN Bypass', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test users
    await createTestUsers();
    
    // Create test clients
    await createTestClients();
    
    // Set up user-client associations
    await setupUserClientAssociations();
    
    // Authenticate users
    await authenticateUsers();
    
    // Set up mock Google Drive connections for all users
    await setupMockGoogleDriveConnection(superAdminUserId);
    await setupMockGoogleDriveConnection(regularAdminUserId);
    await setupMockGoogleDriveConnection(standardUserId);
  });

  beforeEach(async () => {
    // Clean up assets before each test
    await db.delete(assets);
  });

  afterAll(async () => {
    // Cleanup all test data
    await cleanupTestData();
  });

  describe('SUPER_ADMIN Import Bypass', () => {
    it('should allow SUPER_ADMIN to import into any client without userClients entry', async () => {
      const importData = {
        files: [
          {
            id: 'file1',
            name: 'test-file.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: unauthorizedClientId // Client that super admin has no association with
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);
      
      // Verify SSE response
      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });

      await new Promise((resolve) => {
        response.on('end', () => {
          const fullResponse = chunks.join('');
          const events = fullResponse.split('\n').filter(line => line.startsWith('data: '));
          
          // Should have a finished event
          const finishedEvent = events.find(event => {
            const data = JSON.parse(event.slice(6));
            return data.status === 'finished';
          });
          
          expect(finishedEvent).toBeDefined();
          if (finishedEvent) {
            const data = JSON.parse(finishedEvent.slice(6));
            expect(data.imported).toBe(1);
            expect(data.failed).toBe(0);
          }
          resolve(true);
        });
      });
    });

    it('should block non-super_admin without userClients entry', async () => {
      const importData = {
        files: [
          {
            id: 'file1',
            name: 'test-file.pdf', 
            mimeType: 'application/pdf'
          }
        ],
        clientId: unauthorizedClientId // Client that regular admin has no association with
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        message: 'Not authorized for this client'
      });
    });

    it('should allow non-super_admin with valid userClients entry', async () => {
      const importData = {
        files: [
          {
            id: 'file1',
            name: 'test-file.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId // Client that regular admin has association with
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);
      
      // Verify SSE response
      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(chunk.toString());
      });

      await new Promise((resolve) => {
        response.on('end', () => {
          const fullResponse = chunks.join('');
          const events = fullResponse.split('\n').filter(line => line.startsWith('data: '));
          
          const finishedEvent = events.find(event => {
            const data = JSON.parse(event.slice(6));
            return data.status === 'finished';
          });
          
          expect(finishedEvent).toBeDefined();
          if (finishedEvent) {
            const data = JSON.parse(finishedEvent.slice(6));
            expect(data.imported).toBe(1);
            expect(data.failed).toBe(0);
          }
          resolve(true);
        });
      });
    });
  });

  describe('Audit Field Logging Tests', () => {
    it('should record correct uploader userId for SUPER_ADMIN imports', async () => {
      const importData = {
        files: [
          {
            id: 'audit-test-file',
            name: 'audit-test-file.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: unauthorizedClientId
      };

      // Make import request
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);

      // Wait for SSE to complete
      await new Promise((resolve) => {
        response.on('end', resolve);
      });

      // Verify audit field - check that uploadedBy matches super admin
      const [importedAsset] = await db.select()
        .from(assets)
        .where(eq(assets.uploadedBy, superAdminUserId));

      expect(importedAsset).toBeDefined();
      expect(importedAsset.uploadedBy).toBe(superAdminUserId);
      expect(importedAsset.clientId).toBe(unauthorizedClientId);
      expect(importedAsset.originalFileName).toBe('audit-test-file.pdf');
    });

    it('should record correct uploader userId for regular admin imports', async () => {
      const importData = {
        files: [
          {
            id: 'admin-audit-file',
            name: 'admin-audit-file.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      // Make import request
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);

      // Wait for SSE to complete
      await new Promise((resolve) => {
        response.on('end', resolve);
      });

      // Verify audit field - check that uploadedBy matches regular admin
      const [importedAsset] = await db.select()
        .from(assets)
        .where(eq(assets.uploadedBy, regularAdminUserId));

      expect(importedAsset).toBeDefined();
      expect(importedAsset.uploadedBy).toBe(regularAdminUserId);
      expect(importedAsset.clientId).toBe(testClientId);
      expect(importedAsset.originalFileName).toBe('admin-audit-file.pdf');
    });
  });

  describe('Import Security Validation', () => {
    it('should validate file array input', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: 'not-an-array', // Invalid input
          clientId: testClientId
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: 'No files selected for import'
      });
    });

    it('should validate clientId requirement', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: [],
          clientId: null // Missing clientId
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: 'Client ID is required'
      });
    });

    it('should validate empty files array', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: [], // Empty array
          clientId: testClientId
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: 'No files selected for import'
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .send({
          files: [{ id: 'file1', name: 'test.pdf', mimeType: 'application/pdf' }],
          clientId: testClientId
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        message: 'Not authenticated'
      });
    });
  });

  describe('Import Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const importData = {
        files: [
          {
            id: 'file1',
            name: 'rate-limit-test.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      // Make multiple rapid requests
      const requests = Array(5).fill(null).map(() => 
        request(app)
          .post('/api/google-drive/import')
          .set('Cookie', superAdminAuthCookie)
          .send(importData)
      );

      const responses = await Promise.all(requests);
      
      // First request should succeed, subsequent ones should be rate limited
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(429); // Too Many Requests
      expect(responses[2].status).toBe(429);
      expect(responses[3].status).toBe(429);
      expect(responses[4].status).toBe(429);
    });
  });

  describe('Error Handling', () => {
    it('should handle Google Drive authentication errors gracefully', async () => {
      // Disconnect Google Drive to simulate auth failure
      await request(app)
        .delete('/api/google-drive/disconnect')
        .set('Cookie', superAdminAuthCookie);

      const importData = {
        files: [
          {
            id: 'file1',
            name: 'auth-error-test.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        message: 'Google Drive authentication required'
      });
    });

    it('should handle malformed file data', async () => {
      const importData = {
        files: [
          {
            id: '', // Missing required field
            name: 'malformed-test.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(400);
    });
  });
});