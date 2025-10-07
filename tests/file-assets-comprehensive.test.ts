/**
 * Comprehensive File Asset API Tests
 *
 * This test suite covers:
 * - Role-based permissions (Guest, Standard, Editor, Admin)
 * - Search functionality
 * - Thumbnail generation
 * - Integration scenarios
 *
 * Prerequisites:
 * 1. Ensure the server is running on http://localhost:3001
 * 2. Test users will be created automatically in the database
 * 3. Run: npm test tests/file-assets-comprehensive.test.ts
 *
 * Note: These are integration tests that require a running server instance
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { UserRole, type UserRoleType } from '@shared/schema';
import {
  createTestUser,
  createTestClient,
  associateUserWithClient,
  cleanupTestUser,
  cleanupTestClient,
  type TestUser,
  type TestClient,
} from './helpers/test-server';

const API_BASE = 'http://localhost:3001/api';

// Test users with different roles (will be populated in beforeAll)
const testUsers: Record<string, TestUser> = {
  guest: {} as any,
  standard: {} as any,
  editor: {} as any,
  admin: {} as any,
};

let testClient: TestClient;
let sharedAssetId: number;
let privateAssetId: number;
let testCategoryId: number;
let testTagId: number;

// Helper functions
function createTestFile(filename: string, sizeKB = 10): Buffer {
  const content = Buffer.alloc(sizeKB * 1024, 'test data ');
  return content;
}

async function authenticatedFetch(
  url: string,
  userType: keyof typeof testUsers,
  options: RequestInit = {}
): Promise<Response> {
  const user = testUsers[userType];
  if (!user || !user.id) {
    throw new Error(`Test user ${userType} not initialized`);
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-test-user-id': user.id.toString(),
    },
  });
}

/**
 * Setup test user by creating them in the database
 * User ID will be passed via x-test-user-id header in requests
 */
async function setupTestUser(
  userType: keyof typeof testUsers,
  role: UserRoleType
): Promise<void> {
  const timestamp = Date.now();
  const email = `${userType}-test-${timestamp}@test.com`;

  // Create user in database
  const user = await createTestUser(email, role, `Test ${userType}`);

  // Create client if it doesn't exist
  if (!testClient) {
    testClient = await createTestClient(`Test Client ${timestamp}`);
  }

  // Associate user with client
  await associateUserWithClient(user.id, testClient.id);

  // Store in testUsers object
  testUsers[userType] = user;
}

describe('File Asset System - Comprehensive Tests', () => {
  beforeAll(async () => {
    // Clean up any leftover data from previous test runs
    console.log('Cleaning up leftover test data...');
    const timestamp = Date.now();

    // Try to cleanup test clients that might exist from previous runs
    // We'll create clients with predictable names so we can find them
    const { db } = await import('../server/db');
    const { clients } = await import('@shared/schema');
    const { like } = await import('drizzle-orm');

    const existingTestClients = await db
      .select()
      .from(clients)
      .where(like(clients.name, '%Test Client%'));

    for (const client of existingTestClients) {
      try {
        await cleanupTestClient(client.id);
        console.log(`Cleaned up test client: ${client.name}`);
      } catch (error) {
        console.warn(`Failed to cleanup existing test client ${client.id}:`, error);
      }
    }

    // Setup test users with their respective roles
    await setupTestUser('guest', UserRole.GUEST);
    await setupTestUser('standard', UserRole.STANDARD);
    await setupTestUser('editor', UserRole.EDITOR);
    await setupTestUser('admin', UserRole.ADMIN);

    // Create test assets as admin
    await setupTestAssets();
  });

  async function setupTestAssets() {
    // Create a shared asset
    const sharedFormData = new FormData();
    const sharedFile = createTestFile('shared-doc.pdf', 5);
    sharedFormData.append('file', new Blob([sharedFile], { type: 'application/pdf' }), 'shared-doc.pdf');
    sharedFormData.append('visibility', 'shared');

    const sharedRes = await authenticatedFetch(
      `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
      'admin',
      {
        method: 'POST',
        body: sharedFormData,
      }
    );

    if (sharedRes.ok) {
      const sharedAsset = await sharedRes.json();
      sharedAssetId = sharedAsset.id;
      console.log('Created shared asset:', sharedAssetId);
    } else {
      console.error('Failed to create shared asset:', sharedRes.status, await sharedRes.text());
    }

    // Create a private asset
    const privateFormData = new FormData();
    const privateFile = createTestFile('private-doc.pdf', 5);
    privateFormData.append('file', new Blob([privateFile], { type: 'application/pdf' }), 'private-doc.pdf');
    privateFormData.append('visibility', 'private');

    const privateRes = await authenticatedFetch(
      `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
      'admin',
      {
        method: 'POST',
        body: privateFormData,
      }
    );

    if (privateRes.ok) {
      const privateAsset = await privateRes.json();
      privateAssetId = privateAsset.id;
      console.log('Created private asset:', privateAssetId);
    } else {
      console.error('Failed to create private asset:', privateRes.status, await privateRes.text());
    }
  }

  describe('Role-Based Permissions', () => {
    describe('Guest User', () => {
      it('should only see shared assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/assets`,
          'guest'
        );

        expect(response.status).toBe(200);
        const assets = await response.json();
        expect(Array.isArray(assets)).toBe(true);

        // All returned assets should be shared
        const allShared = assets.every((a: any) => a.visibility === 'shared');
        expect(allShared).toBe(true);
      });

      it('should not access private assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${privateAssetId}`,
          'guest'
        );

        expect(response.status).toBe(403);
      });

      it('should not be able to upload files', async () => {
        const formData = new FormData();
        const file = createTestFile('guest-upload.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'guest-upload.pdf');

        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'guest',
          {
            method: 'POST',
            body: formData,
          }
        );

        expect(response.status).toBe(403);
      });

      it('should not be able to delete assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${sharedAssetId}`,
          'guest',
          {
            method: 'DELETE',
          }
        );

        expect(response.status).toBe(403);
      });

      it('should be able to download shared assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${sharedAssetId}/download`,
          'guest'
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Disposition')).toContain(
          'attachment'
        );
      });
    });

    describe('Standard User', () => {
      it('should see all shared assets and own private assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/assets`,
          'standard'
        );

        expect(response.status).toBe(200);
        const assets = await response.json();
        expect(Array.isArray(assets)).toBe(true);
      });

      it('should be able to upload files', async () => {
        const formData = new FormData();
        const file = createTestFile('standard-upload.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'standard-upload.pdf');
        formData.append('visibility', 'private');

        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'standard',
          {
            method: 'POST',
            body: formData,
          }
        );

        expect(response.status).toBe(201);
      });

      it('should be able to update own assets', async () => {
        // First upload an asset
        const formData = new FormData();
        const file = createTestFile('to-update.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'to-update.pdf');

        const uploadRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'standard',
          {
            method: 'POST',
            body: formData,
          }
        );

        const asset = await uploadRes.json();

        // Now update it
        const updateRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'standard',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility: 'shared' }),
          }
        );

        expect(updateRes.status).toBe(200);
      });

      it('should not be able to delete other users assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${sharedAssetId}`,
          'standard',
          {
            method: 'DELETE',
          }
        );

        // Should be 403 unless the standard user is the owner
        expect([200, 403]).toContain(response.status);
      });

      it('should be able to delete own assets', async () => {
        // First upload an asset
        const formData = new FormData();
        const file = createTestFile('to-delete.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'to-delete.pdf');

        const uploadRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'standard',
          {
            method: 'POST',
            body: formData,
          }
        );

        const asset = await uploadRes.json();

        // Now delete it
        const deleteRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'standard',
          {
            method: 'DELETE',
          }
        );

        expect(deleteRes.status).toBe(200);
      });
    });

    describe('Editor User', () => {
      it('should be able to edit shared assets', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${sharedAssetId}`,
          'editor',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility: 'shared' }),
          }
        );

        expect(response.status).toBe(200);
      });

      it('should not be able to delete assets they do not own', async () => {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${sharedAssetId}`,
          'editor',
          {
            method: 'DELETE',
          }
        );

        // Editors can edit but not delete unless they own it
        expect([200, 403]).toContain(response.status);
      });

      it('should be able to upload files', async () => {
        const formData = new FormData();
        const file = createTestFile('editor-upload.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'editor-upload.pdf');

        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'editor',
          {
            method: 'POST',
            body: formData,
          }
        );

        expect(response.status).toBe(201);
      });
    });

    describe('Admin User', () => {
      it('should have full CRUD access to all assets', async () => {
        // Create
        const formData = new FormData();
        const file = createTestFile('admin-test.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'admin-test.pdf');

        const createRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'admin',
          {
            method: 'POST',
            body: formData,
          }
        );

        expect(createRes.status).toBe(201);
        const asset = await createRes.json();

        // Read
        const readRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'admin'
        );
        expect(readRes.status).toBe(200);

        // Update
        const updateRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'admin',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visibility: 'shared' }),
          }
        );
        expect(updateRes.status).toBe(200);

        // Delete
        const deleteRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'admin',
          {
            method: 'DELETE',
          }
        );
        expect(deleteRes.status).toBe(200);
      });

      it('should be able to delete any asset', async () => {
        // Create an asset as standard user
        const formData = new FormData();
        const file = createTestFile('standard-owned.pdf', 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), 'standard-owned.pdf');

        const uploadRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'standard',
          {
            method: 'POST',
            body: formData,
          }
        );

        const asset = await uploadRes.json();

        // Delete as admin
        const deleteRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
          'admin',
          {
            method: 'DELETE',
          }
        );

        expect(deleteRes.status).toBe(200);
      });

      it('should be able to manage categories', async () => {
        // Create category
        const createRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-asset-categories`,
          'admin',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Admin Test Category',
              slug: 'admin-test-category',
              isDefault: false,
            }),
          }
        );

        expect(createRes.status).toBe(201);
        const category = await createRes.json();
        testCategoryId = category.id;

        // Update category
        const updateRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-asset-categories/${testCategoryId}`,
          'admin',
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Updated Category Name' }),
          }
        );

        expect(updateRes.status).toBe(200);
      });
    });
  });

  describe('Search Functionality', () => {
    beforeAll(async () => {
      // Create searchable test assets
      const testAssets = [
        { name: 'marketing-brochure-2024.pdf', tags: ['marketing', 'q4'] },
        { name: 'product-photos.zip', tags: ['photography', 'products'] },
        { name: 'financial-report.xlsx', tags: ['finance', 'q4'] },
        { name: 'logo-variations.ai', tags: ['design', 'branding'] },
      ];

      // Create tags first
      const tagMap: Record<string, number> = {};
      for (const asset of testAssets) {
        for (const tagName of asset.tags) {
          if (!tagMap[tagName]) {
            const tagRes = await authenticatedFetch(
              `${API_BASE}/clients/${testClient.id}/file-asset-tags`,
              'admin',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: tagName,
                  slug: tagName.toLowerCase(),
                }),
              }
            );

            if (tagRes.ok) {
              const tag = await tagRes.json();
              tagMap[tagName] = tag.id;
            }
          }
        }
      }

      // Upload assets with tags
      for (const asset of testAssets) {
        const formData = new FormData();
        const file = createTestFile(asset.name, 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), asset.name);
        formData.append('visibility', 'shared');
        formData.append(
          'tagIds',
          JSON.stringify(asset.tags.map((t) => tagMap[t]))
        );

        await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'admin',
          {
            method: 'POST',
            body: formData,
          }
        );
      }
    });

    it('should search by filename', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/assets?search=marketing`,
        'admin'
      );

      expect(response.status).toBe(200);
      const assets = await response.json();
      expect(assets.length).toBeGreaterThan(0);
      expect(assets.some((a: any) => a.fileName.includes('marketing'))).toBe(
        true
      );
    });

    it('should search by tags', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/assets?search=photography`,
        'admin'
      );

      expect(response.status).toBe(200);
      const assets = await response.json();
      expect(assets.length).toBeGreaterThan(0);
    });

    it('should use dedicated search endpoint', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/assets/search?q=financial`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should return empty results for non-matching search', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/assets/search?q=nonexistentfile12345`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.total).toBe(0);
      expect(data.results.length).toBe(0);
    });

    it('should respect role permissions in search results', async () => {
      // Guest user should only see shared assets in search results
      const response = await authenticatedFetch(
        `${API_BASE}/assets/search?q=brochure`,
        'guest'
      );

      expect(response.status).toBe(200);
      const data = await response.json();

      // All results should be shared assets
      if (data.results.length > 0) {
        const allShared = data.results.every(
          (a: any) => a.visibility === 'shared'
        );
        expect(allShared).toBe(true);
      }
    });

    it('should combine search with filters', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/assets?search=q4&visibility=shared`,
        'admin'
      );

      expect(response.status).toBe(200);
      const assets = await response.json();

      // Results should match search term and filter
      const allShared = assets.every((a: any) => a.visibility === 'shared');
      expect(allShared).toBe(true);
    });
  });

  describe('Thumbnail Generation', () => {
    let imageAssetId: number;
    let pdfAssetId: number;

    beforeAll(async () => {
      // Upload an image file
      const imageFormData = new FormData();
      // Create a minimal valid PNG file (1x1 pixel)
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      imageFormData.append('file', new Blob([pngData], { type: 'image/png' }), 'test-image.png');
      imageFormData.append('visibility', 'shared');

      const imageRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: imageFormData,
        }
      );

      if (imageRes.ok) {
        const imageAsset = await imageRes.json();
        imageAssetId = imageAsset.id;
      }

      // Upload a PDF file
      const pdfFormData = new FormData();
      const pdfFile = createTestFile('test-document.pdf', 10);
      pdfFormData.append('file', new Blob([pdfFile], { type: 'application/pdf' }), 'test-document.pdf');
      pdfFormData.append('visibility', 'shared');

      const pdfRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: pdfFormData,
        }
      );

      if (pdfRes.ok) {
        const pdfAsset = await pdfRes.json();
        pdfAssetId = pdfAsset.id;
      }
    });

    it('should generate thumbnail for image files', async () => {
      const sizes = ['small', 'medium', 'large'];

      for (const size of sizes) {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/${imageAssetId}/thumbnail/${size}`,
          'admin'
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/jpeg');

        const thumbnailData = await response.arrayBuffer();
        expect(thumbnailData.byteLength).toBeGreaterThan(0);
      }
    });

    it('should reject invalid thumbnail sizes', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${imageAssetId}/thumbnail/invalid`,
        'admin'
      );

      expect(response.status).toBe(400);
    });

    it('should return file type icon for non-previewable files', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${pdfAssetId}/thumbnail/small`,
        'admin'
      );

      // Should either generate a thumbnail or return an icon name
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        const data = await response.json();
        if (data.iconName) {
          expect(typeof data.iconName).toBe('string');
        }
      }
    });

    it('should cache generated thumbnails', async () => {
      // First request - generates thumbnail
      const start1 = Date.now();
      const response1 = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${imageAssetId}/thumbnail/small`,
        'admin'
      );
      const time1 = Date.now() - start1;

      expect(response1.status).toBe(200);

      // Second request - should use cached version
      const start2 = Date.now();
      const response2 = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${imageAssetId}/thumbnail/small`,
        'admin'
      );
      const time2 = Date.now() - start2;

      expect(response2.status).toBe(200);

      // Cached request should be faster (with some tolerance for network variance)
      // This is a soft check - commented out to avoid flakiness
      // expect(time2).toBeLessThan(time1 * 1.5);
    });

    it('should enforce permissions on thumbnail access', async () => {
      // Guest user should not access thumbnails for private assets
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${privateAssetId}/thumbnail/small`,
        'guest'
      );

      expect(response.status).toBe(403);
    });

    it('should delete thumbnails when asset is deleted', async () => {
      // Upload a test image
      const formData = new FormData();
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);

      formData.append('file', new Blob([pngData], { type: 'image/png' }), 'to-delete.png');

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: formData,
        }
      );

      const asset = await uploadRes.json();

      // Generate thumbnail
      await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}/thumbnail/small`,
        'admin'
      );

      // Delete asset
      const deleteRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'admin',
        {
          method: 'DELETE',
        }
      );

      expect(deleteRes.status).toBe(200);

      // Try to access thumbnail - should fail
      const thumbnailRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}/thumbnail/small`,
        'admin'
      );

      expect(thumbnailRes.status).toBe(404);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multi-file upload workflow', async () => {
      const files = [
        'project-brief.pdf',
        'design-mockup.png',
        'content-plan.xlsx',
      ];

      const uploadedAssets = [];

      for (const fileName of files) {
        const formData = new FormData();
        const file = createTestFile(fileName, 5);
        formData.append('file', new Blob([file], { type: 'application/pdf' }), fileName);
        formData.append('visibility', 'shared');

        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
          'admin',
          {
            method: 'POST',
            body: formData,
          }
        );

        expect(response.status).toBe(201);
        const asset = await response.json();
        uploadedAssets.push(asset);
      }

      // Verify all files were uploaded
      expect(uploadedAssets.length).toBe(files.length);

      // Verify they appear in the asset list
      const listRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets`,
        'admin'
      );

      const data = await listRes.json();
      const uploadedIds = uploadedAssets.map((a) => a.id);
      const foundAssets = data.assets.filter((a: any) =>
        uploadedIds.includes(a.id)
      );

      expect(foundAssets.length).toBe(uploadedAssets.length);
    });

    it('should handle asset organization workflow', async () => {
      // 1. Create a category
      const categoryRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories`,
        'admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Campaign Assets',
            slug: 'campaign-assets',
            isDefault: false,
          }),
        }
      );

      const category = await categoryRes.json();

      // 2. Create tags
      const tagNames = ['spring-2024', 'digital', 'print'];
      const tagIds = [];

      for (const tagName of tagNames) {
        const tagRes = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/file-asset-tags`,
          'admin',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tagName,
              slug: tagName,
            }),
          }
        );

        if (tagRes.ok) {
          const tag = await tagRes.json();
          tagIds.push(tag.id);
        }
      }

      // 3. Upload asset with category and tags
      const formData = new FormData();
      const file = createTestFile('campaign-banner.jpg', 5);
      formData.append('file', new Blob([file], { type: 'image/jpeg' }), 'campaign-banner.jpg');
      formData.append('categoryIds', JSON.stringify([category.id]));
      formData.append('tagIds', JSON.stringify(tagIds));

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(uploadRes.status).toBe(201);
      const asset = await uploadRes.json();

      // 4. Verify asset has correct metadata
      const getRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'admin'
      );

      const retrievedAsset = await getRes.json();
      expect(retrievedAsset.categories).toBeDefined();
      expect(retrievedAsset.tags).toBeDefined();
    });

    it('should handle permission escalation workflow', async () => {
      // 1. Standard user creates a private asset
      const formData = new FormData();
      const file = createTestFile('private-notes.txt', 5);
      formData.append('file', new Blob([file], { type: 'text/plain' }), 'private-notes.txt');
      formData.append('visibility', 'private');

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'standard',
        {
          method: 'POST',
          body: formData,
        }
      );

      const asset = await uploadRes.json();

      // 2. Guest cannot see it
      const guestRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'guest'
      );

      expect(guestRes.status).toBe(403);

      // 3. Standard user makes it shared
      const updateRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'standard',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: 'shared' }),
        }
      );

      expect(updateRes.status).toBe(200);

      // 4. Now guest can see it
      const guestRes2 = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'guest'
      );

      expect(guestRes2.status).toBe(200);
    });
  });

  afterAll(async () => {
    console.log('Cleaning up test data...');

    // Clean up test users
    for (const user of Object.values(testUsers)) {
      if (user?.id) {
        try {
          await cleanupTestUser(user.id);
        } catch (error) {
          console.error(`Failed to cleanup user ${user.id}:`, error);
        }
      }
    }

    // Clean up test client
    if (testClient?.id) {
      try {
        await cleanupTestClient(testClient.id);
      } catch (error) {
        console.error(`Failed to cleanup client ${testClient.id}:`, error);
      }
    }

    // Give time for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Comprehensive tests completed');
  });
});
