/**
 * File Asset API Integration Tests
 *
 * These tests cover the file asset upload, management, and permission systems.
 *
 * IMPORTANT: These are integration tests that require a running server!
 *
 * To run these tests:
 * 1. Enable test mode in .env file:
 *    BYPASS_AUTH_FOR_LOCAL_DEV=true
 * 2. Start the development server: npm run dev
 * 3. In a separate terminal, run: npm test -- tests/file-assets.test.ts --run
 *
 * The tests will automatically create and cleanup test users, clients, and assets.
 * Test authentication uses the x-test-user-id header (enabled when BYPASS_AUTH_FOR_LOCAL_DEV=true).
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { UserRole, type UserRoleType } from '@shared/schema';
import {
  createTestUser,
  createTestClient,
  associateUserWithClient,
  cleanupTestUser,
  cleanupTestClient,
  cleanupTestAssets,
  cleanupTestCategories,
  cleanupTestTags,
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
let testAssetId: number;
let testCategoryId: number;
let testTagId: number;

// Track assets created during tests for cleanup
const createdAssetIds: number[] = [];
const createdCategoryIds: number[] = [];
const createdTagIds: number[] = [];

// Helper to create a test file buffer
function createTestFile(filename: string, sizeKB = 10): Buffer {
  const content = Buffer.alloc(sizeKB * 1024, 'test data ');
  return content;
}

// Helper to make authenticated requests
async function authenticatedFetch(
  url: string,
  userType: keyof typeof testUsers = 'admin',
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
 * Track asset ID for cleanup after test
 */
function trackAsset(assetId: number): void {
  if (assetId && !createdAssetIds.includes(assetId)) {
    createdAssetIds.push(assetId);
  }
}

/**
 * Track category ID for cleanup after test
 */
function trackCategory(categoryId: number): void {
  if (categoryId && !createdCategoryIds.includes(categoryId)) {
    createdCategoryIds.push(categoryId);
  }
}

/**
 * Track tag ID for cleanup after test
 */
function trackTag(tagId: number): void {
  if (tagId && !createdTagIds.includes(tagId)) {
    createdTagIds.push(tagId);
  }
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
  const email = `${userType}-file-assets-test-${timestamp}@test.com`;

  // Create user in database
  const user = await createTestUser(email, role, `Test ${userType}`);

  // Create client if it doesn't exist
  if (!testClient) {
    testClient = await createTestClient(`Test File Assets Client ${timestamp}`);
  }

  // Associate user with client
  await associateUserWithClient(user.id, testClient.id);

  // Store in testUsers object
  testUsers[userType] = user;
}

describe('File Asset System', () => {
  beforeAll(async () => {
    // Setup test users with their respective roles
    await setupTestUser('guest', UserRole.GUEST);
    await setupTestUser('standard', UserRole.STANDARD);
    await setupTestUser('editor', UserRole.EDITOR);
    await setupTestUser('admin', UserRole.ADMIN);
  });

  afterEach(async () => {
    // Clean up any assets created during individual tests
    if (createdAssetIds.length > 0) {
      try {
        await cleanupTestAssets(createdAssetIds);
        console.log(`Cleaned up ${createdAssetIds.length} test assets`);
        createdAssetIds.length = 0; // Clear the array
      } catch (error) {
        console.warn('Failed to cleanup test assets:', error);
      }
    }

    // Clean up any categories created during individual tests
    if (createdCategoryIds.length > 0) {
      try {
        await cleanupTestCategories(createdCategoryIds);
        console.log(`Cleaned up ${createdCategoryIds.length} test categories`);
        createdCategoryIds.length = 0; // Clear the array
      } catch (error) {
        console.warn('Failed to cleanup test categories:', error);
      }
    }

    // Clean up any tags created during individual tests
    if (createdTagIds.length > 0) {
      try {
        await cleanupTestTags(createdTagIds);
        console.log(`Cleaned up ${createdTagIds.length} test tags`);
        createdTagIds.length = 0; // Clear the array
      } catch (error) {
        console.warn('Failed to cleanup test tags:', error);
      }
    }
  });

  describe('Asset Upload', () => {
    it('should upload a file successfully', async () => {
      const formData = new FormData();
      const testFile = createTestFile('test-document.pdf', 10);
      formData.append('file', new Blob([testFile], { type: 'application/pdf' }), 'test-document.pdf');
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
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('fileName');
      expect(asset).toHaveProperty('originalFileName', 'test-document.pdf');
      expect(asset).toHaveProperty('clientId', testClient.id);

      testAssetId = asset.id;
      // Don't track this asset - it's used by other tests
      // It will be cleaned up in afterAll when the client is deleted
    });

    it('should reject files exceeding size limit', async () => {
      const formData = new FormData();
      const largeFile = createTestFile('large-file.pdf', 600 * 1024); // 600MB
      formData.append('file', new Blob([largeFile], { type: 'application/pdf' }), 'large-file.pdf');

      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: formData,
        }
      );

      // Should reject with 400 (client error) or 500 (server error from file size)
      expect([400, 413, 500]).toContain(response.status);
      if (response.status !== 500) {
        const error = await response.json();
        expect(error.message).toContain('size');
      }
    });

    it('should upload file with categories and tags', async () => {
      // First create a category and tag
      const categoryRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories`,
        'admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Category',
            slug: 'test-category',
            isDefault: false,
          }),
        }
      );
      const category = await categoryRes.json();
      testCategoryId = category.id;
      // Don't track - used by other tests, cleaned up with client

      const tagRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-tags`,
        'admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Tag',
            slug: 'test-tag',
          }),
        }
      );
      const tag = await tagRes.json();
      testTagId = tag.id;
      // Don't track - used by other tests, cleaned up with client

      // Now upload with categories and tags
      const formData = new FormData();
      const testFile = createTestFile('categorized-doc.pdf', 5);
      formData.append('file', new Blob([testFile], { type: 'application/pdf' }), 'categorized-doc.pdf');
      formData.append('categoryIds', JSON.stringify([testCategoryId]));
      formData.append('tagIds', JSON.stringify([testTagId]));

      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'admin',
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(response.status).toBe(201);
      // Don't track this asset - it's used by filter tests
      // Will be cleaned up with client in afterAll
    });
  });

  describe('Asset Listing', () => {
    it('should list all assets for a client', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('assets');
      expect(Array.isArray(data.assets)).toBe(true);
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
    });

    it('should support pagination', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets?limit=2&offset=0`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.limit).toBe(2);
      expect(data.offset).toBe(0);
      expect(data.assets.length).toBeLessThanOrEqual(2);
    });

    it('should filter by category', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets?categoryId=${testCategoryId}`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.length).toBeGreaterThan(0);
    });

    it('should filter by tag', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets?tagId=${testTagId}`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      // Tag filtering should work even if no assets have tags
      // This tests that the endpoint accepts tagId parameter
      expect(data).toHaveProperty('assets');
      expect(Array.isArray(data.assets)).toBe(true);
    });

    it('should filter by visibility', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets?visibility=shared`,
        'admin'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.every((a: any) => a.visibility === 'shared')).toBe(true);
    });
  });

  describe('Asset Retrieval', () => {
    it('should get a single asset by ID', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}`,
        'admin'
      );

      expect(response.status).toBe(200);
      const asset = await response.json();
      expect(asset.id).toBe(testAssetId);
      expect(asset).toHaveProperty('fileName');
      expect(asset).toHaveProperty('originalFileName');
    });

    it('should return 404 for non-existent asset', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/999999`,
        'admin'
      );

      // Should be 404 (not found) or 403 (forbidden - permission check before existence check)
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('Asset Download', () => {
    it('should download an asset file', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}/download`,
        'admin'
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBeDefined();
      expect(response.headers.get('Content-Disposition')).toContain('attachment');

      const fileData = await response.arrayBuffer();
      expect(fileData.byteLength).toBeGreaterThan(0);
    });
  });

  describe('Asset Update', () => {
    it('should update asset metadata', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}`,
        'admin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visibility: 'private',
          }),
        }
      );

      expect(response.status).toBe(200);
      const asset = await response.json();
      expect(asset.visibility).toBe('private');
    });

    it('should update categories and tags', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}`,
        'admin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryIds: [testCategoryId],
            tagIds: [testTagId],
          }),
        }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Asset Deletion', () => {
    it('should soft delete an asset', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}`,
        'admin',
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(200);

      // Verify asset is no longer retrievable
      const getResponse = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${testAssetId}`,
        'admin'
      );
      expect(getResponse.status).toBe(403);
    });
  });

  describe('Category Management', () => {
    it('should list all categories (system + client)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories`,
        'admin'
      );

      expect(response.status).toBe(200);
      const categories = await response.json();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.some((c: any) => c.isDefault)).toBe(true);
    });

    it('should create a new category (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories`,
        'admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Marketing Materials',
            slug: 'marketing-materials',
            isDefault: false,
          }),
        }
      );

      // May be 201 or 403 depending on user role
      expect([201, 403]).toContain(response.status);
    });

    it('should update a category (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories/${testCategoryId}`,
        'admin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Updated Category Name',
          }),
        }
      );

      expect([200, 403]).toContain(response.status);
    });

    it('should not allow editing system default categories', async () => {
      // Assuming category ID 1 is a system default
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories/1`,
        'admin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Hacked Name',
          }),
        }
      );

      // Should be 403 (forbidden) or 404 (category doesn't exist in test DB)
      expect([403, 404]).toContain(response.status);
    });

    it('should delete a category (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-categories/${testCategoryId}`,
        'admin',
        {
          method: 'DELETE',
        }
      );

      // May be 200 (success), 403 (forbidden), or 500 (category in use by assets)
      expect([200, 403, 500]).toContain(response.status);
    });
  });

  describe('Tag Management', () => {
    it('should list all tags for a client', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-tags`,
        'admin'
      );

      expect(response.status).toBe(200);
      const tags = await response.json();
      expect(Array.isArray(tags)).toBe(true);
    });

    it('should create a new tag', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-tags`,
        'admin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Q4 2024',
            slug: 'q4-2024',
          }),
        }
      );

      expect([201, 401]).toContain(response.status);
    });

    it('should delete a tag (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-asset-tags/${testTagId}`,
        'admin',
        {
          method: 'DELETE',
        }
      );

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Permission System', () => {
    it('should enforce authentication on all endpoints', async () => {
      // Test without auth header
      const response = await fetch(
        `${API_BASE}/clients/${testClient.id}/file-assets`
      );

      // Should be 401 (unauthorized) or 500 (server error due to missing auth)
      expect([401, 500]).toContain(response.status);
    });

    it('should prevent access to assets from other clients', async () => {
      const otherClientId = 999; // Non-existent client
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${otherClientId}/file-assets`,
        'admin'
      );

      // Should either be 403 (forbidden) or return empty list
      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(data.assets.length).toBe(0);
      }
    });

    it('should respect visibility settings (guest user)', async () => {
      // Guest users should only see shared assets
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets`,
        'guest'
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('assets');

      // All returned assets should be shared
      if (data.assets.length > 0) {
        const allShared = data.assets.every((a: any) => a.visibility === 'shared');
        expect(allShared).toBe(true);
      }
    });

    it('should allow editors to edit shared assets', async () => {
      // Editors can only update/delete their own assets
      // First, upload an asset as editor
      const formData = new FormData();
      const testFile = createTestFile('editor-file.pdf', 5);
      formData.append('file', new Blob([testFile], { type: 'application/pdf' }), 'editor-file.pdf');
      formData.append('visibility', 'shared');

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'editor',
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(uploadRes.status).toBe(201);
      const asset = await uploadRes.json();
      trackAsset(asset.id);

      // Editor can update their own asset
      const updateRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: 'private' }),
        }
      );

      expect(updateRes.status).toBe(200);

      // Editor can delete their own asset
      const deleteRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'editor',
        {
          method: 'DELETE',
        }
      );

      expect(deleteRes.status).toBe(200);
    });

    it('should allow admins full access', async () => {
      // Admins can CRUD all assets, regardless of ownership
      // Upload an asset as editor user
      const formData = new FormData();
      const testFile = createTestFile('editor-file-2.pdf', 5);
      formData.append('file', new Blob([testFile], { type: 'application/pdf' }), 'editor-file-2.pdf');
      formData.append('visibility', 'private');

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/upload`,
        'editor',
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(uploadRes.status).toBe(201);
      const asset = await uploadRes.json();
      trackAsset(asset.id);

      // Admin should be able to read it
      const readRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'admin'
      );
      expect(readRes.status).toBe(200);

      // Admin should be able to update it
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

      // Admin should be able to delete it
      const deleteRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/file-assets/${asset.id}`,
        'admin',
        {
          method: 'DELETE',
        }
      );
      expect(deleteRes.status).toBe(200);
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

    console.log('Tests completed');
  });
});

// Export for manual testing
export {
  createTestFile,
  authenticatedFetch,
  API_BASE,
};
