/**
 * Brand Asset Description Permissions Tests (JUP-29)
 *
 * This test suite covers role-based permissions for editing brand asset descriptions.
 * Tests the PATCH /api/clients/:clientId/brand-assets/:assetId/description endpoint.
 *
 * Test Coverage:
 * - Permission tests (super_admin, admin, editor can edit; standard, guest cannot)
 * - Authorization tests (cross-client access, ownership validation)
 * - Validation tests (valid/invalid payloads for logos, colors, fonts)
 * - Edge cases (non-existent assets, malformed IDs, invalid client context)
 *
 * Prerequisites:
 * 1. Server running on http://localhost:3001
 * 2. Run: npm test tests/brand-asset-description-permissions.test.ts
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
import { db } from '../server/db';
import { brandAssets } from '@shared/schema';

const API_BASE = 'http://localhost:3001/api';

// Test users with different roles
const testUsers: Record<string, TestUser> = {
  superAdmin: {} as TestUser,
  admin: {} as TestUser,
  editor: {} as TestUser,
  standard: {} as TestUser,
  guest: {} as TestUser,
};

let testClient: TestClient;
let otherClient: TestClient; // For cross-client authorization tests
let logoAssetId: number;
let colorAssetId: number;
let fontAssetId: number;
let otherClientAssetId: number; // Asset in different client

/**
 * Helper to make authenticated request using x-test-user-id header
 */
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
 * Setup test users with their respective roles
 */
async function setupTestUser(
  userType: keyof typeof testUsers,
  role: UserRoleType,
  clientToAssociate: TestClient
): Promise<void> {
  const timestamp = Date.now();
  const email = `${userType}-desc-test-${timestamp}@test.com`;

  const user = await createTestUser(email, role, `Test ${userType}`);
  await associateUserWithClient(user.id, clientToAssociate.id);
  testUsers[userType] = user;
}

/**
 * Create test brand assets for testing
 */
async function setupTestAssets(): Promise<void> {
  // Create logo asset
  const [logo] = await db
    .insert(brandAssets)
    .values({
      clientId: testClient.id,
      name: 'Test Logo',
      category: 'logo',
      fileData: 'base64-encoded-svg-data',
      mimeType: 'image/svg+xml',
      data: {
        type: 'main',
        format: 'svg',
        fileName: 'test-logo.svg',
        hasDarkVariant: true,
        description: 'Original light description',
        darkVariantDescription: 'Original dark description',
      },
      sortOrder: 0,
    })
    .returning();
  logoAssetId = logo.id;

  // Create color asset
  const [color] = await db
    .insert(brandAssets)
    .values({
      clientId: testClient.id,
      name: 'Test Color',
      category: 'color',
      data: {
        hex: '#FF5733',
        name: 'Brand Primary',
        category: 'brand',
        description: 'Original color description',
      },
      sortOrder: 0,
    })
    .returning();
  colorAssetId = color.id;

  // Create font asset
  const [font] = await db
    .insert(brandAssets)
    .values({
      clientId: testClient.id,
      name: 'Test Font',
      category: 'font',
      fileData: 'base64-encoded-font-data',
      mimeType: 'font/woff2',
      data: {
        fontFamily: 'Test Sans',
        weight: '400',
        style: 'normal',
        source: 'file',
        description: 'Original font description',
      },
      sortOrder: 0,
    })
    .returning();
  fontAssetId = font.id;

  // Create asset in other client for cross-client tests
  const [otherAsset] = await db
    .insert(brandAssets)
    .values({
      clientId: otherClient.id,
      name: 'Other Client Asset',
      category: 'color',
      data: {
        hex: '#000000',
        name: 'Other Color',
        category: 'neutral',
      },
      sortOrder: 0,
    })
    .returning();
  otherClientAssetId = otherAsset.id;
}

describe('Brand Asset Description Permissions (JUP-29)', () => {
  beforeAll(async () => {
    const timestamp = Date.now();

    // Create test clients
    testClient = await createTestClient(`Test Client Descriptions ${timestamp}`);
    otherClient = await createTestClient(`Other Client ${timestamp}`);

    // Setup test users
    await setupTestUser('superAdmin', UserRole.SUPER_ADMIN, testClient);
    await setupTestUser('admin', UserRole.ADMIN, testClient);
    await setupTestUser('editor', UserRole.EDITOR, testClient);
    await setupTestUser('standard', UserRole.STANDARD, testClient);
    await setupTestUser('guest', UserRole.GUEST, testClient);

    // Create test assets
    await setupTestAssets();
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    if (testClient?.id) await cleanupTestClient(testClient.id);
    if (otherClient?.id) await cleanupTestClient(otherClient.id);

    // Cleanup users
    for (const user of Object.values(testUsers)) {
      if (user.id) await cleanupTestUser(user.id);
    }
  });

  describe('Permission Tests - Logo Assets', () => {
    it('should allow super admin to update logo description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'superAdmin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated by super admin',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.description).toBe('Updated by super admin');
    });

    it('should allow admin to update logo description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'admin',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated by admin',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.description).toBe('Updated by admin');
    });

    it('should allow editor to update logo description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated by editor',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.description).toBe('Updated by editor');
    });

    it('should deny standard user from updating logo description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'standard',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Attempted by standard',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toContain('editor role or higher required');
    });

    it('should deny guest user from updating logo description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'guest',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Attempted by guest',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toContain('editor role or higher required');
    });

    it('should deny unauthenticated request', async () => {
      const response = await fetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Attempted without auth',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(401);
    });
  });

  describe('Permission Tests - Color Assets', () => {
    it('should allow editor to update color description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${colorAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated color description',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.description).toBe('Updated color description');
    });

    it('should deny standard user from updating color description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${colorAssetId}/description`,
        'standard',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Attempted by standard',
          }),
        }
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Permission Tests - Font Assets', () => {
    it('should allow editor to update font description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${fontAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated font description',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.description).toBe('Updated font description');
    });

    it('should deny guest user from updating font description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${fontAssetId}/description`,
        'guest',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Attempted by guest',
          }),
        }
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Authorization Tests - Cross-Client Access', () => {
    it('should prevent user from updating asset in different client', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${otherClient.id}/brand-assets/${otherClientAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Cross-client attempt',
          }),
        }
      );

      // Should be denied - user is not associated with otherClient
      expect(response.status).toBe(403);
    });

    it('should prevent updating asset with wrong client context', async () => {
      // Try to update testClient's asset but with otherClient's ID in URL
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${otherClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Wrong context',
            variant: 'light',
          }),
        }
      );

      // Should fail ownership check (asset.clientId !== clientId)
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toContain('Not authorized');
    });
  });

  describe('Validation Tests - Logo Descriptions', () => {
    it('should accept valid light variant description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Valid light description',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
    });

    it('should accept valid dark variant description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            darkVariantDescription: 'Valid dark description',
            variant: 'dark',
          }),
        }
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.darkVariantDescription).toBe('Valid dark description');
    });

    it('should accept both light and dark descriptions together', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Both light',
            darkVariantDescription: 'Both dark',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
    });

    it('should reject invalid variant value', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Test',
            variant: 'invalid',
          }),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid request data');
    });

    it('should handle empty description as valid', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: '',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('Validation Tests - Color Descriptions', () => {
    it('should accept valid color description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${colorAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Valid color description',
          }),
        }
      );

      expect(response.status).toBe(200);
    });

    it('should reject missing description field for color', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${colorAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid request data');
    });
  });

  describe('Validation Tests - Font Descriptions', () => {
    it('should accept valid font description', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${fontAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Valid font description',
          }),
        }
      );

      expect(response.status).toBe(200);
    });

    it('should reject missing description field for font', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${fontAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );

      expect(response.status).toBe(400);
    });
  });

  describe('Edge Cases', () => {
    it('should return 404 for non-existent asset ID', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/999999/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Test',
          }),
        }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.message).toContain('Asset not found');
    });

    it('should return 400 for invalid asset ID format', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/invalid/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Test',
          }),
        }
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('Invalid asset ID');
    });

    it('should return 400 for malformed client ID', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/invalid/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Test',
            variant: 'light',
          }),
        }
      );

      expect(response.status).toBe(400);
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json{',
        }
      );

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should preserve other asset data fields when updating description', async () => {
      // First, get the current asset state
      const beforeResponse = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets`,
        'editor'
      );
      const beforeAssets = await beforeResponse.json();
      const beforeAsset = beforeAssets.find((a: { id: number }) => a.id === logoAssetId);
      const originalType = beforeAsset.data.type;
      const originalFormat = beforeAsset.data.format;

      // Update description
      await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
        'editor',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: 'Updated description only',
            variant: 'light',
          }),
        }
      );

      // Verify other fields are preserved
      const afterResponse = await authenticatedFetch(
        `${API_BASE}/clients/${testClient.id}/brand-assets`,
        'editor'
      );
      const afterAssets = await afterResponse.json();
      const afterAsset = afterAssets.find((a: { id: number }) => a.id === logoAssetId);

      expect(afterAsset.data.type).toBe(originalType);
      expect(afterAsset.data.format).toBe(originalFormat);
      expect(afterAsset.data.description).toBe('Updated description only');
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should confirm all privileged roles can edit descriptions', async () => {
      const privilegedRoles = ['superAdmin', 'admin', 'editor'] as const;

      for (const role of privilegedRoles) {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
          role,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: `Updated by ${role}`,
              variant: 'light',
            }),
          }
        );

        expect(response.status).toBe(200);
      }
    });

    it('should confirm unprivileged roles cannot edit descriptions', async () => {
      const unprivilegedRoles = ['standard', 'guest'] as const;

      for (const role of unprivilegedRoles) {
        const response = await authenticatedFetch(
          `${API_BASE}/clients/${testClient.id}/brand-assets/${logoAssetId}/description`,
          role,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: `Attempted by ${role}`,
              variant: 'light',
            }),
          }
        );

        expect(response.status).toBe(403);
      }
    });
  });
});
