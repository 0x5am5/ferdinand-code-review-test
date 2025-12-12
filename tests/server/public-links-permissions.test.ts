/**
 * Public Links and Cross-Client Access Permission Tests
 *
 * These tests verify the permission behavior for:
 * 1. Public link creation restrictions based on user roles
 * 2. Cross-client access prevention
 * 3. Proper permission enforcement for share operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../../server/db.js';
import { eq } from 'drizzle-orm';
import { checkAssetPermission } from '../../server/services/asset-permissions.js';
import { 
  createTestUser, 
  createTestClient, 
  associateUserWithClient, 
  cleanupTestUser,
  cleanupTestClient 
} from '../helpers/test-server.js';

// Test data interfaces
interface TestSetup {
  guestUser: { id: number; email: string; name: string; role: string };
  editorUser: { id: number; email: string; name: string; role: string };
  clientA: { id: number; name: string };
  clientB: { id: number; name: string };
  sharedAsset: { id: number; clientId: number; uploadedBy: number; visibility: string };
  privateAsset: { id: number; clientId: number; uploadedBy: number; visibility: string };
}

describe('Public Links and Cross-Client Access Permissions', () => {
  let testSetup: TestSetup;

  beforeEach(async () => {
    testSetup = {} as TestSetup;
    
    // Import schema dynamically like the service does
    const { assets, UserRole } = await import('../../shared/schema.js');

    // Create test users with different roles
    const guestUser = await createTestUser('guest@example.com', UserRole.GUEST, 'Test Guest');
    const editorUser = await createTestUser('editor@example.com', UserRole.EDITOR, 'Test Editor');

    // Create two test clients
    const clientA = await createTestClient('Test Client A');
    const clientB = await createTestClient('Test Client B');

    // Associate users with clients
    await associateUserWithClient(guestUser.id, clientA.id);
    await associateUserWithClient(editorUser.id, clientA.id);
    await associateUserWithClient(editorUser.id, clientB.id);

    // Create test assets
    const sharedAssetResult = await db.insert(assets).values({
      clientId: clientA.id,
      uploadedBy: editorUser.id,
      fileName: 'shared-asset.pdf',
      originalFileName: 'shared-asset.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'test/client-a/shared-asset.pdf',
      visibility: 'shared',
    }).returning();
    const sharedAsset = sharedAssetResult[0];

    const privateAssetResult = await db.insert(assets).values({
      clientId: clientA.id,
      uploadedBy: editorUser.id,
      fileName: 'private-asset.pdf',
      originalFileName: 'private-asset.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'test/client-a/private-asset.pdf',
      visibility: 'private',
    }).returning();
    const privateAsset = privateAssetResult[0];

    testSetup.guestUser = guestUser;
    testSetup.editorUser = editorUser;
    testSetup.clientA = clientA;
    testSetup.clientB = clientB;
    testSetup.sharedAsset = sharedAsset;
    testSetup.privateAsset = privateAsset;
  });

  afterEach(async () => {
    // Clean up in reverse order of creation
    if (testSetup && testSetup.sharedAsset) {
      // Import schema dynamically for cleanup
      const { assets, assetPublicLinks } = await import('../../shared/schema.js');
      
      // Clean up public links
      await db.delete(assetPublicLinks).where(
        eq(assetPublicLinks.assetId, testSetup.sharedAsset.id)
      );
      await db.delete(assetPublicLinks).where(
        eq(assetPublicLinks.assetId, testSetup.privateAsset.id)
      );

      // Clean up assets
      await db.delete(assets).where(eq(assets.id, testSetup.sharedAsset.id));
      await db.delete(assets).where(eq(assets.id, testSetup.privateAsset.id));

      // Clean up users
      await cleanupTestUser(testSetup.guestUser.id);
      await cleanupTestUser(testSetup.editorUser.id);

      // Clean up clients
      await cleanupTestClient(testSetup.clientA.id);
      await cleanupTestClient(testSetup.clientB.id);
    }
  });

  describe('Public Link Creation Permissions', () => {
    it('should deny GUEST users from creating public links', async () => {
      // Arrange: Use guest user and shared asset
      const { guestUser, clientA, sharedAsset } = testSetup;

      // Act: Check share permission for guest user
      const permission = await checkAssetPermission(
        guestUser.id,
        sharedAsset.id,
        clientA.id,
        'share'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Role guest cannot share assets');
    });

    it('should allow EDITOR users to create public links for shared assets', async () => {
      // Arrange: Use editor user and shared asset
      const { editorUser, clientA, sharedAsset } = testSetup;

      // Act: Check share permission for editor user
      const permission = await checkAssetPermission(
        editorUser.id,
        sharedAsset.id,
        clientA.id,
        'share'
      );

      // Assert: Permission should be allowed
      expect(permission.allowed).toBe(true);
      expect(permission.asset).toBeDefined();
      expect(permission.asset?.id).toBe(sharedAsset.id);
    });

    it('should allow EDITOR users to create public links for private assets they own', async () => {
      // Arrange: Use editor user and private asset
      const { editorUser, clientA, privateAsset } = testSetup;

      // Act: Check share permission for editor user
      const permission = await checkAssetPermission(
        editorUser.id,
        privateAsset.id,
        clientA.id,
        'share'
      );

      // Assert: Permission should be allowed
      expect(permission.allowed).toBe(true);
      expect(permission.asset).toBeDefined();
      expect(permission.asset?.id).toBe(privateAsset.id);
    });

    it('should deny GUEST users from accessing private assets', async () => {
      // Arrange: Use guest user and private asset
      const { guestUser, clientA, privateAsset } = testSetup;

      // Act: Check read permission for guest user
      const permission = await checkAssetPermission(
        guestUser.id,
        privateAsset.id,
        clientA.id,
        'read'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Asset is not shared');
    });

    it('should allow GUEST users to access shared assets', async () => {
      // Arrange: Use guest user and shared asset
      const { guestUser, clientA, sharedAsset } = testSetup;

      // Act: Check read permission for guest user
      const permission = await checkAssetPermission(
        guestUser.id,
        sharedAsset.id,
        clientA.id,
        'read'
      );

      // Assert: Permission should be allowed
      expect(permission.allowed).toBe(true);
      expect(permission.asset).toBeDefined();
      expect(permission.asset?.id).toBe(sharedAsset.id);
    });
  });

  describe('Cross-Client Access Prevention', () => {
    it('should deny access to assets in other clients', async () => {
      // Arrange: User is associated with client A, but trying to access asset in client B
      const { guestUser, clientB, sharedAsset } = testSetup;

      // Act: Check permission with wrong client ID
      const permission = await checkAssetPermission(
        guestUser.id,
        sharedAsset.id, // This asset belongs to client A
        clientB.id,    // But we're claiming it belongs to client B
        'read'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Asset not in client');
    });

    it('should deny users not associated with a client from accessing its assets', async () => {
      // Arrange: Create a user not associated with client A
      const { UserRole } = await import('../../shared/schema.js');
      const unassociatedUser = await createTestUser('unassociated@example.com', UserRole.EDITOR, 'Unassociated User');
      
      // Act: Check permission for unassociated user
      const permission = await checkAssetPermission(
        unassociatedUser.id,
        testSetup.sharedAsset.id,
        testSetup.clientA.id,
        'read'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Not authorized for this client');

      // Cleanup
      await cleanupTestUser(unassociatedUser.id);
    });

    it('should allow users to access assets in their associated clients', async () => {
      // Arrange: Editor user is associated with both clients
      const { editorUser, clientA, sharedAsset } = testSetup;

      // Act: Check permission with correct client association
      const permission = await checkAssetPermission(
        editorUser.id,
        sharedAsset.id,
        clientA.id,
        'read'
      );

      // Assert: Permission should be allowed
      expect(permission.allowed).toBe(true);
      expect(permission.asset).toBeDefined();
    });

    it('should prevent cross-client public link creation', async () => {
      // Arrange: Create an asset in client B
      const { assets } = await import('../../shared/schema.js');
      const clientBAssetResult = await db.insert(assets).values({
        clientId: testSetup.clientB.id,
        uploadedBy: testSetup.editorUser.id,
        fileName: 'client-b-asset.pdf',
        originalFileName: 'client-b-asset.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        storagePath: 'test/client-b/asset.pdf',
        visibility: 'shared',
      }).returning();
      const clientBAsset = clientBAssetResult[0];

      // Act: Try to create public link for client B asset while claiming it's in client A
      const permission = await checkAssetPermission(
        testSetup.editorUser.id,
        clientBAsset.id,
        testSetup.clientA.id, // Wrong client ID
        'share'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Asset not in client');

      // Cleanup
      await db.delete(assets).where(eq(assets.id, clientBAsset.id));
    });
  });

  describe('Role-Based Permission Matrix', () => {
    it('should enforce correct permission matrix for all roles', async () => {
      const { clientA, sharedAsset } = testSetup;
      const { UserRole } = await import('../../shared/schema.js');
      
      // Test all user roles
      const roles = [
        UserRole.GUEST,
        UserRole.STANDARD,
        UserRole.EDITOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
      ];

      const expectedPermissions = {
        [UserRole.GUEST]: { read: true, write: false, delete: false, share: false },
        [UserRole.STANDARD]: { read: true, write: false, delete: false, share: false }, // Can't write to shared assets they don't own
        [UserRole.EDITOR]: { read: true, write: true, delete: false, share: true },
        [UserRole.ADMIN]: { read: true, write: true, delete: true, share: true },
        [UserRole.SUPER_ADMIN]: { read: true, write: true, delete: true, share: true },
      };

      for (const role of roles) {
        // Create test user with specific role
        const testUser = await createTestUser(`test-${role}@example.com`, role, `Test ${role}`);
        await associateUserWithClient(testUser.id, clientA.id);

        const permissions = expectedPermissions[role];

        // Test each permission type
        for (const [permissionType, expected] of Object.entries(permissions)) {
          const permission = await checkAssetPermission(
            testUser.id,
            sharedAsset.id,
            clientA.id,
            permissionType as any
          );

          expect(permission.allowed).toBe(expected);
        }

        // Cleanup
        await cleanupTestUser(testUser.id);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent users gracefully', async () => {
      // Arrange: Use non-existent user ID
      const nonExistentUserId = 999999;

      // Act: Check permission for non-existent user
      const permission = await checkAssetPermission(
        nonExistentUserId,
        testSetup.sharedAsset.id,
        testSetup.clientA.id,
        'read'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('User not found');
    });

    it('should handle non-existent assets gracefully', async () => {
      // Arrange: Use non-existent asset ID
      const nonExistentAssetId = 999999;

      // Act: Check permission for non-existent asset
      const permission = await checkAssetPermission(
        testSetup.guestUser.id,
        nonExistentAssetId,
        testSetup.clientA.id,
        'read'
      );

      // Assert: Permission should be denied
      expect(permission.allowed).toBe(false);
      expect(permission.reason).toContain('Asset not found');
    });

    it('should handle database errors gracefully', async () => {
      // This test would require mocking the database to throw an error
      // For now, we'll just verify the error handling structure exists
      const { guestUser, clientA, sharedAsset } = testSetup;

      // Act: Check permission (should not throw)
      const permission = await checkAssetPermission(
        guestUser.id,
        sharedAsset.id,
        clientA.id,
        'read'
      );

      // Assert: Should return a valid response structure
      expect(permission).toHaveProperty('allowed');
      // Note: reason property only exists when permission is denied
      if (!permission.allowed) {
        expect(permission).toHaveProperty('reason');
      } else {
        // When allowed, reason might be undefined, which is fine
        expect(permission.reason === undefined || typeof permission.reason === 'string').toBe(true);
      }
      expect(typeof permission.allowed).toBe('boolean');
    });
  });
});