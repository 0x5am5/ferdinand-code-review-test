/**
 * File Asset API Integration Tests
 *
 * These tests cover the file asset upload, management, and permission systems.
 *
 * To run these tests:
 * 1. Ensure the server is running on http://localhost:3001
 * 2. Ensure you have valid test credentials
 * 3. Run: npx tsx tests/file-assets.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { cleanupTestAssets, cleanupTestCategories, cleanupTestTags } from './helpers/test-server';

const API_BASE = 'http://localhost:3001/api';
let authCookie: string;
let testClientId: number;
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
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: authCookie,
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

describe('File Asset System', () => {
  beforeAll(async () => {
    // TODO: Implement authentication
    // For now, assumes dev auth bypass is enabled
    testClientId = 1; // Replace with actual test client ID
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
      formData.append('file', new Blob([testFile]), 'test-document.pdf');
      formData.append('visibility', 'shared');

      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/upload`,
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
      expect(asset).toHaveProperty('clientId', testClientId);

      testAssetId = asset.id;
      trackAsset(asset.id);
    });

    it('should reject files exceeding size limit', async () => {
      const formData = new FormData();
      const largeFile = createTestFile('large-file.pdf', 600 * 1024); // 600MB
      formData.append('file', new Blob([largeFile]), 'large-file.pdf');

      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('size');
    });

    it('should upload file with categories and tags', async () => {
      // First create a category and tag
      const categoryRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-categories`,
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
      trackCategory(category.id);

      const tagRes = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-tags`,
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
      trackTag(tag.id);

      // Now upload with categories and tags
      const formData = new FormData();
      const testFile = createTestFile('categorized-doc.pdf', 5);
      formData.append('file', new Blob([testFile]), 'categorized-doc.pdf');
      formData.append('categoryIds', JSON.stringify([testCategoryId]));
      formData.append('tagIds', JSON.stringify([testTagId]));

      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      expect(response.status).toBe(201);
      if (response.ok) {
        const asset = await response.json();
        trackAsset(asset.id);
      }
    });
  });

  describe('Asset Listing', () => {
    it('should list all assets for a client', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets`
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
        `${API_BASE}/clients/${testClientId}/file-assets?limit=2&offset=0`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.limit).toBe(2);
      expect(data.offset).toBe(0);
      expect(data.assets.length).toBeLessThanOrEqual(2);
    });

    it('should filter by category', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets?categoryId=${testCategoryId}`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.length).toBeGreaterThan(0);
    });

    it('should filter by tag', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets?tagId=${testTagId}`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.length).toBeGreaterThan(0);
    });

    it('should filter by visibility', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets?visibility=shared`
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assets.every((a: any) => a.visibility === 'shared')).toBe(true);
    });
  });

  describe('Asset Retrieval', () => {
    it('should get a single asset by ID', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}`
      );

      expect(response.status).toBe(200);
      const asset = await response.json();
      expect(asset.id).toBe(testAssetId);
      expect(asset).toHaveProperty('fileName');
      expect(asset).toHaveProperty('originalFileName');
    });

    it('should return 404 for non-existent asset', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/999999`
      );

      expect(response.status).toBe(404);
    });
  });

  describe('Asset Download', () => {
    it('should download an asset file', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}/download`
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
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}`,
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
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}`,
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
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(200);

      // Verify asset is no longer retrievable
      const getResponse = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-assets/${testAssetId}`
      );
      expect(getResponse.status).toBe(403);
    });
  });

  describe('Category Management', () => {
    it('should list all categories (system + client)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-categories`
      );

      expect(response.status).toBe(200);
      const categories = await response.json();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.some((c: any) => c.isDefault)).toBe(true);
    });

    it('should create a new category (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-categories`,
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
        `${API_BASE}/clients/${testClientId}/file-asset-categories/${testCategoryId}`,
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
        `${API_BASE}/clients/${testClientId}/file-asset-categories/1`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Hacked Name',
          }),
        }
      );

      expect(response.status).toBe(403);
    });

    it('should delete a category (admin only)', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-categories/${testCategoryId}`,
        {
          method: 'DELETE',
        }
      );

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Tag Management', () => {
    it('should list all tags for a client', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-tags`
      );

      expect(response.status).toBe(200);
      const tags = await response.json();
      expect(Array.isArray(tags)).toBe(true);
    });

    it('should create a new tag', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClientId}/file-asset-tags`,
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
        `${API_BASE}/clients/${testClientId}/file-asset-tags/${testTagId}`,
        {
          method: 'DELETE',
        }
      );

      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Permission System', () => {
    it('should enforce authentication on all endpoints', async () => {
      // Test without auth cookie
      const response = await fetch(
        `${API_BASE}/clients/${testClientId}/file-assets`
      );

      expect(response.status).toBe(401);
    });

    it('should prevent access to assets from other clients', async () => {
      const otherClientId = 999; // Non-existent client
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${otherClientId}/file-assets`
      );

      // Should either be 403 (forbidden) or return empty list
      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(data.assets.length).toBe(0);
      }
    });

    it('should respect visibility settings (guest user)', async () => {
      // TODO: Implement test with guest user role
      // Guest users should only see shared assets
    });

    it('should allow editors to edit shared assets', async () => {
      // TODO: Implement test with editor role
      // Editors can update but not delete shared assets
    });

    it('should allow admins full access', async () => {
      // TODO: Implement test with admin role
      // Admins can CRUD all assets
    });
  });

  afterAll(async () => {
    // Cleanup test data if needed
    console.log('Tests completed');
  });
});

// Export for manual testing
export {
  createTestFile,
  authenticatedFetch,
  API_BASE,
};
