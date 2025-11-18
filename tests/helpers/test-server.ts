/**
 * Test Server Helper
 *
 * Provides utilities for integration testing with proper authentication
 */

import { db } from '../../server/db';
import { users, clients, userClients, session } from '@shared/schema';
import { eq, inArray, and } from 'drizzle-orm';
import type { UserRoleType } from '@shared/schema';

export interface TestUser {
  id: number;
  email: string;
  name: string;
  role: UserRoleType;
  sessionId?: string;
  cookie?: string;
}

export interface TestClient {
  id: number;
  name: string;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(
  email: string,
  role: UserRoleType,
  name?: string
): Promise<TestUser> {
  // Check if user already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  if (existing.length > 0) {
    return existing[0] as TestUser;
  }

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: name || `Test ${role}`,
      role,
    })
    .returning();

  return user as TestUser;
}

/**
 * Create a test client in the database
 */
export async function createTestClient(name: string): Promise<TestClient> {
  const [client] = await db
    .insert(clients)
    .values({
      name,
      featureToggles: {},
    })
    .returning();

  return { id: client.id, name: client.name };
}

/**
 * Associate a user with a client
 */
export async function associateUserWithClient(
  userId: number,
  clientId: number
): Promise<void> {
  // Check if association already exists
  const existing = await db
    .select()
    .from(userClients)
    .where(eq(userClients.userId, userId));

  if (existing.length > 0) {
    return;
  }

  await db.insert(userClients).values({
    userId,
    clientId,
  });
}

/**
 * Create a test session for a user
 * Returns a session cookie string that can be used in requests
 */
export async function createTestSession(userId: number): Promise<string> {
  const sessionId = `test-session-${userId}-${Date.now()}`;

  // Create session data
  const sessionData = {
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000),
      secure: false,
      httpOnly: true,
      path: '/',
    },
    userId,
  };

  const expiresAt = new Date(Date.now() + 86400000);

  // Insert into session table
  await db.insert(session).values({
    sid: sessionId,
    sess: sessionData,
    expire: expiresAt,
  });

  // Return cookie string
  return `connect.sid=${sessionId}`;
}

/**
 * Clean up test data
 */
export async function cleanupTestUser(userId: number): Promise<void> {
  // Delete user-client associations
  await db.delete(userClients).where(eq(userClients.userId, userId));

  // Note: Sessions will expire naturally or can be cleaned up separately
  // The session table uses 'sess' json field which contains userId

  // Delete user
  await db.delete(users).where(eq(users.id, userId));
}

export async function cleanupTestClient(clientId: number): Promise<void> {
  // Delete user-client associations
  await db.delete(userClients).where(eq(userClients.clientId, clientId));

  // Delete assets associated with this client
  const { assets, assetCategoryAssignments, assetTagAssignments, assetCategories, assetTags } = await import('@shared/schema');

  // Get all assets for this client to clean up their files
  const clientAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.clientId, clientId));

  const assetIds = clientAssets.map(a => a.id);

  if (assetIds.length > 0) {
    // Delete physical files and thumbnails for each asset
    const { deleteFile } = await import('../../server/storage/index');
    const { deleteThumbnails } = await import('../../server/services/thumbnail');

    for (const asset of clientAssets) {
      // Delete the actual file
      if (asset.storagePath) {
        try {
          await deleteFile(asset.storagePath);
        } catch (error) {
          console.warn(`Failed to delete file for asset ${asset.id}:`, error);
        }
      }

      // Delete thumbnails
      try {
        await deleteThumbnails(asset.id);
      } catch (error) {
        console.warn(`Failed to delete thumbnails for asset ${asset.id}:`, error);
      }
    }

    // Delete category assignments for all assets
    await db.delete(assetCategoryAssignments).where(
      inArray(assetCategoryAssignments.assetId, assetIds)
    );

    // Delete tag assignments for all assets
    await db.delete(assetTagAssignments).where(
      inArray(assetTagAssignments.assetId, assetIds)
    );
  }

  // Delete assets
  await db.delete(assets).where(eq(assets.clientId, clientId));

  // Delete custom categories for this client (non-default only)
  await db.delete(assetCategories).where(eq(assetCategories.clientId, clientId));

  // Delete custom tags for this client
  await db.delete(assetTags).where(eq(assetTags.clientId, clientId));

  // Delete client
  await db.delete(clients).where(eq(clients.id, clientId));

  console.log(`Cleaned up client ${clientId}: ${clientAssets.length} assets, files, thumbnails, categories, and tags`);
}

/**
 * Clean up uploaded files for specific asset IDs
 * Useful for cleaning up after individual tests
 */
export async function cleanupTestAssets(assetIds: number[]): Promise<void> {
  if (assetIds.length === 0) return;

  const { assets, assetCategoryAssignments, assetTagAssignments } = await import('@shared/schema');
  const { deleteFile } = await import('../../server/storage/index');
  const { deleteThumbnails } = await import('../../server/services/thumbnail');

  // Get assets to clean up their files
  const assetsToClean = await db
    .select()
    .from(assets)
    .where(inArray(assets.id, assetIds));

  // Delete physical files and thumbnails
  for (const asset of assetsToClean) {
    if (asset.storagePath) {
      try {
        await deleteFile(asset.storagePath);
      } catch (error) {
        console.warn(`Failed to delete file for asset ${asset.id}:`, error);
      }
    }

    try {
      await deleteThumbnails(asset.id);
    } catch (error) {
      console.warn(`Failed to delete thumbnails for asset ${asset.id}:`, error);
    }
  }

  // Delete category assignments
  await db.delete(assetCategoryAssignments).where(
    inArray(assetCategoryAssignments.assetId, assetIds)
  );

  // Delete tag assignments
  await db.delete(assetTagAssignments).where(
    inArray(assetTagAssignments.assetId, assetIds)
  );

  // Delete asset records
  await db.delete(assets).where(inArray(assets.id, assetIds));
}

/**
 * Clean up categories by ID
 */
export async function cleanupTestCategories(categoryIds: number[]): Promise<void> {
  if (categoryIds.length === 0) return;

  const { assetCategories, assetCategoryAssignments } = await import('@shared/schema');

  // Delete category assignments first
  await db.delete(assetCategoryAssignments).where(
    inArray(assetCategoryAssignments.categoryId, categoryIds)
  );

  // Delete categories
  await db.delete(assetCategories).where(inArray(assetCategories.id, categoryIds));
}

/**
 * Clean up tags by ID
 */
export async function cleanupTestTags(tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;

  const { assetTags, assetTagAssignments } = await import('@shared/schema');

  // Delete tag assignments first
  await db.delete(assetTagAssignments).where(
    inArray(assetTagAssignments.tagId, tagIds)
  );

  // Delete tags
  await db.delete(assetTags).where(inArray(assetTags.id, tagIds));
}

/**
 * Clean up section metadata by client and section types
 */
export async function cleanupTestSectionMetadata(
  metadata: Array<{ clientId: number; sectionType: string }>,
): Promise<void> {
  if (metadata.length === 0) return;

  const { sectionMetadata } = await import('@shared/schema');

  for (const { clientId, sectionType } of metadata) {
    await db
      .delete(sectionMetadata)
      .where(
        and(
          eq(sectionMetadata.clientId, clientId),
          eq(sectionMetadata.sectionType, sectionType),
        ),
      );
  }
}
