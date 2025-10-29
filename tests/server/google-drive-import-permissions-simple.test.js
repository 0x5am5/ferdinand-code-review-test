/**
 * Google Drive Import Permission Tests for SUPER_ADMIN Bypass
 *
 * Clean TypeScript-compatible test file. This is the single authoritative
 * test file to cover import permission scenarios. It intentionally uses
 * only supported runtime features (no ambient `require` in ESM test runner).
 */
 
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { db } from '../../server/db';
import { users, clients, userClients, googleDriveConnections, assets } from '../../shared/schema';
import { eq } from 'drizzle-orm';
 
// Import app via CommonJS require because server/index starts the server.
// Using require() here is supported by ts-jest ESM runner mapping.
const app = require('../../server/index'); // eslint-disable-line @typescript-eslint/no-var-requires
 
let superAdminAuthCookie: any;
let regularAdminAuthCookie: any;
let superAdminUserId: number;
let regularAdminUserId: number;
let testClientId: number;
let unauthorizedClientId: number;

describe('Google Drive Import Permissions - SUPER_ADMIN Bypass', () => {
  beforeAll(async () => {
    // Clean up any existing test data
    try {
      await db.delete(assets);
      await db.delete(googleDriveConnections);
      await db.delete(userClients);
      await db.delete(clients);
      await db.delete(users);
    } catch (error) {
      // eslint-disable-next-line no-console
      /* eslint-disable-next-line no-console */
      console.warn('Cleanup error:', error);
    }
    
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

    // Create test clients
    const [client1] = await db.insert(clients).values({
      name: 'Test Client 1',
      description: 'First test client'
    }).returning();
    testClientId = client1.id;

    const [client2] = await db.insert(clients).values({
      name: 'Unauthorized Client',
      description: 'Client for testing unauthorized access'
    }).returning();
    unauthorizedClientId = client2.id;

    // Set up user-client associations
    await db.insert(userClients).values({
      userId: regularAdminUserId,
      clientId: testClientId
    });

    // Authenticate users
    const superAdminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'superadmin@test.com',
        password: 'test-password'
      });
    superAdminAuthCookie = superAdminResponse.headers['set-cookie'];

    const regularAdminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'test-password'
      });
    regularAdminAuthCookie = regularAdminResponse.headers['set-cookie'];

    // Set up mock Google Drive connections
    await db.insert(googleDriveConnections).values({
      userId: superAdminUserId,
      encryptedAccessToken: 'mock-encrypted-access-token',
      encryptedRefreshToken: 'mock-encrypted-refresh-token',
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]
    });

    await db.insert(googleDriveConnections).values({
      userId: regularAdminUserId,
      encryptedAccessToken: 'mock-encrypted-access-token',
      encryptedRefreshToken: 'mock-encrypted-refresh-token',
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly'
      ]
    });
  });

  beforeEach(async () => {
    // Clean up assets before each test
    await db.delete(assets);
  });

  afterAll(async () => {
    // Cleanup all test data
    try {
      await db.delete(assets);
      await db.delete(googleDriveConnections);
      await db.delete(userClients);
      await db.delete(clients);
      await db.delete(users);
    } catch (error) {
      // eslint-disable-next-line no-console
      /* eslint-disable-next-line no-console */
      console.warn('Cleanup error:', error);
    }
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
        clientId: unauthorizedClientId
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);
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
        clientId: unauthorizedClientId
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

    it('should allow regular admin with valid userClients entry', async () => {
      const importData = {
        files: [
          {
            id: 'file2',
            name: 'authorized-file.pdf',
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

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);

      // Wait a bit for processing
      await new Promise(resolve => {
        /* eslint-disable-next-line no-implied-eval */
        const timeout = global.setTimeout || setTimeout;
        timeout(resolve, 100);
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

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);

      // Wait a bit for processing
      await new Promise(resolve => {
        /* eslint-disable-next-line no-implied-eval */
        const timeout = global.setTimeout || setTimeout;
        timeout(resolve, 100);
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

    it('should preserve audit fields across multiple imports', async () => {
      // First import by super admin
      const importData1 = {
        files: [
          {
            id: 'audit-file-1',
            name: 'audit-file-1.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: unauthorizedClientId
      };

      const response1 = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send(importData1);

      expect(response1.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second import by regular admin
      const importData2 = {
        files: [
          {
            id: 'audit-file-2',
            name: 'audit-file-2.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      const response2 = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData2);

      expect(response2.status).toBe(200);

      // Wait for processing
      await new Promise(resolve => {
        /* eslint-disable-next-line no-implied-eval */
        const timeout = global.setTimeout || setTimeout;
        timeout(resolve, 100);
      });

      // Verify both imports have correct audit fields
      const [superAdminAsset] = await db.select()
        .from(assets)
        .where(eq(assets.uploadedBy, superAdminUserId));

      const [regularAdminAsset] = await db.select()
        .from(assets)
        .where(eq(assets.uploadedBy, regularAdminUserId));

      expect(superAdminAsset).toBeDefined();
      expect(superAdminAsset.uploadedBy).toBe(superAdminUserId);
      expect(superAdminAsset.clientId).toBe(unauthorizedClientId);

      expect(regularAdminAsset).toBeDefined();
      expect(regularAdminAsset.uploadedBy).toBe(regularAdminUserId);
      expect(regularAdminAsset.clientId).toBe(testClientId);
    });
  });

  describe('Import Security Validation', () => {
    it('should validate file array input', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: 'not-an-array',
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

    it('should validate clientId requirement', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: [],
          clientId: null
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
          files: [],
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

    it('should handle malformed file data with missing required fields', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: [
            {
              name: 'test.pdf',
              mimeType: 'application/pdf'
              // Missing required 'id' field
            }
          ],
          clientId: testClientId
        });

      expect(response.status).toBe(400);
    });

    it('should handle invalid clientId type', async () => {
      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', superAdminAuthCookie)
        .send({
          files: [{ id: 'file1', name: 'test.pdf', mimeType: 'application/pdf' }],
          clientId: 'invalid-client-id'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle concurrent imports from same user', async () => {
      const importData = {
        files: [
          {
            id: 'concurrent-file-1',
            name: 'concurrent-file-1.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      // Make two concurrent requests from same user
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/google-drive/import')
          .set('Cookie', regularAdminAuthCookie)
          .send(importData),
        request(app)
          .post('/api/google-drive/import')
          .set('Cookie', regularAdminAuthCookie)
          .send(importData)
      ]);

      // Both should succeed (rate limiting handled separately)
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle imports with very large file names', async () => {
      const longFileName = 'a'.repeat(300) + '.pdf';
      const importData = {
        files: [
          {
            id: 'large-name-file',
            name: longFileName,
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);
    });

    it('should handle special characters in file names', async () => {
      const importData = {
        files: [
          {
            id: 'special-chars-file',
            name: 'file-with-special-chars-测试.pdf',
            mimeType: 'application/pdf'
          }
        ],
        clientId: testClientId
      };

      const response = await request(app)
        .post('/api/google-drive/import')
        .set('Cookie', regularAdminAuthCookie)
        .send(importData);

      expect(response.status).toBe(200);
    });
  });
});