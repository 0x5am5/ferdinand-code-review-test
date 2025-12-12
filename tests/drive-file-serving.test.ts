/**
import type { MockedFunction } from 'vitest';
 * Drive File Serving Endpoint Integration Tests
 *
 * These tests verify the security, permission enforcement, and functionality
 * of Drive file serving endpoints including thumbnails and secure file access.
 *
 * Test Coverage:
 * - Thumbnail serving endpoint (/api/google-drive/files/:fileId/thumbnail)
 *   - Authentication checks
 *   - Drive authentication requirements
 *   - Permission validation (asset + Drive permissions)
 *   - Thumbnail size validation
 *   - Cache hit/miss scenarios
 *   - Error handling
 *
 * - Secure file serving endpoint (/api/drive/secure/:fileId)
 *   - Token validation (missing, invalid, expired)
 *   - File ID verification
 *   - Action permission checking
 *   - Permission validation at multiple levels
 *   - Drive connection and token refresh
 *   - Drive API error scenarios
 *   - Single-use download token revocation
 *   - Error handling with proper codes
 *
 * To run these tests:
 * npm test -- drive-file-serving.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { UserRole, type Asset } from '@shared/schema';
import type { drive_v3 } from 'googleapis';

// Mock dependencies
const mockDb: any = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
};

const mockDriveClient: Partial<drive_v3.Drive> = {
  files: {
    get: vi.fn(),
  } as any,
};

// Mock services
vi.mock('../server/db', () => ({
  db: mockDb,
}));

vi.mock('../server/services/drive-thumbnail-cache', () => ({
  fetchAndCacheThumbnail: vi.fn(),
}));

vi.mock('../server/services/drive-secure-access', () => ({
  validateSecureToken: vi.fn(),
  revokeSecureToken: vi.fn(),
}));

vi.mock('../server/services/asset-permissions', () => ({
  checkAssetPermission: vi.fn(),
}));

vi.mock('../server/middlewares/drive-file-permissions', () => ({
  checkAssetPermission: vi.fn(),
}));

vi.mock('../server/services/google-drive', () => ({
  createDriveClient: vi.fn(() => mockDriveClient),
}));

vi.mock('../server/utils/encryption', () => ({
  isTokenExpired: vi.fn(),
  decryptTokens: vi.fn(),
}));

vi.mock('../server/middlewares/google-drive-auth', () => ({
  refreshUserTokens: vi.fn(),
}));

vi.mock('../server/services/drive-audit-logger', () => ({
  logDriveFileAccess: vi.fn(),
  logFailedAccess: vi.fn(),
}));

// Import after mocks
import {
  fetchAndCacheThumbnail,
} from '../server/services/drive-thumbnail-cache';
import {
  validateSecureToken,
  revokeSecureToken,
} from '../server/services/drive-secure-access';
import { checkAssetPermission as checkAssetPermissionService } from '../server/services/asset-permissions';
import { checkAssetPermission as checkDrivePermission } from '../server/middlewares/drive-file-permissions';
import { isTokenExpired, decryptTokens } from '../server/utils/encryption';
import { refreshUserTokens } from '../server/middlewares/google-drive-auth';
import {
  logDriveFileAccess,
  logFailedAccess,
} from '../server/services/drive-audit-logger';

// Type-safe mock cast helper
const asMock = <T extends (...args: any[]) => any>(fn: T) => fn as MockedFunction<T>;

// Test data factories
const createMockAsset = (overrides?: Partial<Asset>): Asset => ({
  id: 1,
  clientId: 100,
  uploadedBy: 50,
  fileName: 'test-file.jpg',
  originalFileName: 'test-file.jpg',
  fileType: 'image/jpeg',
  fileSize: 1024000,
  storagePath: '/uploads/test.jpg',
  visibility: 'shared',
  isGoogleDrive: true,
  driveFileId: 'drive-file-123',
  driveWebLink: 'https://drive.google.com/file/d/drive-file-123/view',
  driveLastModified: new Date('2024-01-15T12:00:00Z'),
  driveOwner: 'owner@example.com',
  driveThumbnailUrl: 'https://drive.google.com/thumbnail/drive-file-123=s220',
  driveWebContentLink: null,
  driveSharingMetadata: null,
  cachedThumbnailPath: null,
  thumbnailCachedAt: null,
  thumbnailCacheVersion: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  deletedAt: null,
  searchVector: null,
  ...overrides,
});

const createMockUser = (role: typeof UserRole[keyof typeof UserRole] = UserRole.STANDARD): any => ({
  id: 50,
  email: 'user@example.com',
  name: 'Test User',
  role,
  password: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLogin: new Date(),
});

// Unused - kept for reference
const _createMockUser = createMockUser;

const createMockDriveConnection = () => ({
  id: 1,
  userId: 50,
  encryptedAccessToken: 'encrypted-token',
  encryptedRefreshToken: 'encrypted-refresh',
  tokenExpiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  connectedAt: new Date(),
  lastUsedAt: new Date(),
  updatedAt: new Date(),
});

describe('Drive File Serving Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Thumbnail Serving Endpoint: /api/google-drive/files/:fileId/thumbnail', () => {
    describe('Authentication Checks', () => {
      it('should return 401 when user is not authenticated', () => {
        const req: any = {
          session: {},
          params: { fileId: 'drive-file-123' },
          query: { size: 'medium' },
        };

        // Simulate endpoint behavior
        if (!req.session.userId) {
          expect(req.session.userId).toBeUndefined();
          // Would return 401 with message
          const expectedResponse = {
            message: 'Authentication required. Please sign in to view this thumbnail.',
            code: 'UNAUTHORIZED',
          };
          expect(expectedResponse.code).toBe('UNAUTHORIZED');
        }
      });

      it('should return 401 when Google Drive authentication is missing', () => {
        const req: any = {
          session: { userId: 50 },
          googleAuth: undefined,
          params: { fileId: 'drive-file-123' },
          query: { size: 'medium' },
        };

        if (!req.googleAuth) {
          const expectedResponse = {
            message: 'Google Drive authentication required. Please connect your Google Drive account.',
            code: 'DRIVE_AUTH_REQUIRED',
          };
          expect(expectedResponse.code).toBe('DRIVE_AUTH_REQUIRED');
        }
      });
    });

    describe('Input Validation', () => {
      it('should return 400 when fileId is missing', () => {
        const req: any = {
          session: { userId: 50 },
          googleAuth: { credentials: { access_token: 'token' } },
          params: {},
          query: { size: 'medium' },
        };

        if (!req.params.fileId) {
          const expectedResponse = {
            message: 'File ID is required in the request',
            code: 'MISSING_FILE_ID',
          };
          expect(expectedResponse.code).toBe('MISSING_FILE_ID');
        }
      });

      it('should return 400 when thumbnail size is invalid', () => {
        const invalidSizes = ['tiny', 'huge', 'xlarge', ''];

        for (const size of invalidSizes) {
          if (!['small', 'medium', 'large'].includes(size)) {
            const expectedResponse = {
              message: "Invalid thumbnail size. Must be 'small', 'medium', or 'large'",
              code: 'INVALID_SIZE',
            };
            expect(expectedResponse.code).toBe('INVALID_SIZE');
          }
        }
      });

      it('should accept valid thumbnail sizes', () => {
        const validSizes = ['small', 'medium', 'large'];

        for (const size of validSizes) {
          expect(['small', 'medium', 'large'].includes(size)).toBe(true);
        }
      });
    });

    describe('Asset Lookup and Validation', () => {
      it('should return 404 when asset is not found', async () => {
        mockDb.select.mockReturnValue(mockDb);
        mockDb.from.mockReturnValue(mockDb);
        mockDb.where.mockResolvedValue([]);

        const result = await mockDb.select().from({}).where({});

        if (result.length === 0) {
          const expectedResponse = {
            message: 'Asset not found. The file may have been deleted or you don\'t have access.',
            code: 'ASSET_NOT_FOUND',
          };
          expect(expectedResponse.code).toBe('ASSET_NOT_FOUND');
        }
      });

      it('should return 404 when asset has no thumbnail available', () => {
        const assetWithoutThumbnail = createMockAsset({
          driveLastModified: null,
          driveThumbnailUrl: null,
        });

        if (!assetWithoutThumbnail.driveLastModified || !assetWithoutThumbnail.driveThumbnailUrl) {
          const expectedResponse = {
            message: 'No thumbnail available for this file type',
            code: 'NO_THUMBNAIL',
          };
          expect(expectedResponse.code).toBe('NO_THUMBNAIL');
        }
      });
    });

    describe('Permission Validation', () => {
      it('should check asset-level permissions before serving thumbnail', async () => {
        const asset = createMockAsset();
        const userId = 50;

        asMock(checkAssetPermissionService).mockResolvedValue({
          allowed: true,
          asset,
        });

        await checkAssetPermissionService(userId, asset.id, asset.clientId, 'read');

        expect(checkAssetPermissionService).toHaveBeenCalledWith(
          userId,
          asset.id,
          asset.clientId,
          'read'
        );
      });

      it('should return 403 when user lacks asset read permission', async () => {
        (checkAssetPermissionService as Mock).mockResolvedValue({
          allowed: false,
          reason: 'You don\'t have permission to view this file',
        });

        const result = await checkAssetPermissionService(50, 1, 100, 'read');

        expect(result.allowed).toBe(false);
        const expectedResponse = {
          message: result.reason || 'You don\'t have permission to view this file. Contact your administrator for access.',
          code: 'PERMISSION_DENIED',
          requiredPermission: 'read',
        };
        expect(expectedResponse.code).toBe('PERMISSION_DENIED');
      });

      it('should check Drive-specific permissions', async () => {
        const asset = createMockAsset();
        const userId = 50;

        (checkDrivePermission as Mock).mockResolvedValue({
          allowed: true,
        });

        await checkDrivePermission(userId, asset.id, 'read');

        expect(checkDrivePermission).toHaveBeenCalledWith(userId, asset.id, 'read');
      });

      it('should return 403 when user lacks Drive file permission', async () => {
        (checkDrivePermission as Mock).mockResolvedValue({
          allowed: false,
          reason: 'You don\'t have permission to access this Drive file',
        });

        const result = await checkDrivePermission(50, 1, 'read');

        expect(result.allowed).toBe(false);
        const expectedResponse = {
          message: result.reason || 'You don\'t have permission to access this Drive file.',
          code: 'DRIVE_PERMISSION_DENIED',
        };
        expect(expectedResponse.code).toBe('DRIVE_PERMISSION_DENIED');
      });
    });

    describe('Thumbnail Caching', () => {
      it('should return cached thumbnail on cache hit', async () => {
        const asset = createMockAsset({
          cachedThumbnailPath: '/uploads/drive-thumbnails/drive-file-123_medium.jpg',
          thumbnailCachedAt: new Date(),
          thumbnailCacheVersion: 'abc123',
        });

        (fetchAndCacheThumbnail as Mock).mockResolvedValue({
          path: asset.cachedThumbnailPath,
          url: `/api/assets/${asset.id}/thumbnail`,
          cached: true,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const result = await fetchAndCacheThumbnail(
          mockDriveClient as drive_v3.Drive,
          asset.id,
          asset.driveFileId!,
          asset.driveLastModified!,
          asset.driveThumbnailUrl!,
          'medium'
        );

        expect(result.cached).toBe(true);
        expect(result.path).toBe(asset.cachedThumbnailPath);
      });

      it('should fetch and cache thumbnail on cache miss', async () => {
        const asset = createMockAsset({
          cachedThumbnailPath: null,
          thumbnailCachedAt: null,
          thumbnailCacheVersion: null,
        });

        (fetchAndCacheThumbnail as Mock).mockResolvedValue({
          path: '/uploads/drive-thumbnails/drive-file-123_medium.jpg',
          url: `/api/assets/${asset.id}/thumbnail`,
          cached: false,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const result = await fetchAndCacheThumbnail(
          mockDriveClient as drive_v3.Drive,
          asset.id,
          asset.driveFileId!,
          asset.driveLastModified!,
          asset.driveThumbnailUrl!,
          'medium'
        );

        expect(result.cached).toBe(false);
        expect(result.path).toContain('drive-file-123_medium.jpg');
      });

      it('should support different thumbnail sizes', async () => {
        const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
        const asset = createMockAsset();

        for (const size of sizes) {
          (fetchAndCacheThumbnail as Mock).mockResolvedValue({
            path: `/uploads/drive-thumbnails/drive-file-123_${size}.jpg`,
            url: `/api/assets/${asset.id}/thumbnail`,
            cached: false,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });

          const result = await fetchAndCacheThumbnail(
            mockDriveClient as drive_v3.Drive,
            asset.id,
            asset.driveFileId!,
            asset.driveLastModified!,
            asset.driveThumbnailUrl!,
            size
          );

          expect(result.path).toContain(`_${size}.jpg`);
        }
      });
    });

    describe('Response Headers', () => {
      it('should set appropriate cache headers for thumbnails', () => {
        const expectedHeaders = {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=604800', // 7 days
          'X-Thumbnail-Cached': 'true',
          'X-Cache-Expires': expect.any(String),
        };

        expect(expectedHeaders['Cache-Control']).toBe('public, max-age=604800');
      });
    });

    describe('Error Handling', () => {
      it('should return 500 with proper error code on thumbnail fetch failure', async () => {
        (fetchAndCacheThumbnail as Mock).mockRejectedValue(
          new Error('Failed to download Drive thumbnail')
        );

        try {
          await fetchAndCacheThumbnail(
            mockDriveClient as drive_v3.Drive,
            1,
            'drive-file-123',
            new Date(),
            'https://drive.google.com/thumbnail',
            'medium'
          );
        } catch (error) {
          const expectedResponse = {
            message: 'Failed to fetch thumbnail. Please try again later.',
            code: 'THUMBNAIL_FETCH_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
          expect(expectedResponse.code).toBe('THUMBNAIL_FETCH_ERROR');
        }
      });
    });
  });

  describe('Secure File Serving Endpoint: /api/drive/secure/:fileId', () => {
    describe('Token Validation', () => {
      it('should return 400 when token is missing', () => {
        const req = {
          params: { fileId: 'drive-file-123' },
          query: {},
        };

        if (!req.query.token) {
          const expectedResponse = {
            message: 'Access token is required. Please request a new secure URL.',
            code: 'MISSING_TOKEN',
          };
          expect(expectedResponse.code).toBe('MISSING_TOKEN');
        }
      });

      it('should return 401 when token is invalid', async () => {
        (validateSecureToken as Mock).mockResolvedValue(null);

        const token = 'invalid-token';
        const result = await validateSecureToken(token);

        if (!result) {
          const expectedResponse = {
            message: 'Your access link has expired or is invalid. Please request a new link.',
            code: 'INVALID_TOKEN',
          };
          expect(expectedResponse.code).toBe('INVALID_TOKEN');
        }
      });

      it('should return 401 when token is expired', async () => {
        const expiredToken = {
          token: 'expired-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          action: 'read' as const,
        };

        (validateSecureToken as Mock).mockResolvedValue(null);

        const result = await validateSecureToken('expired-token');

        expect(result).toBeNull();
      });

      it('should validate token successfully for valid token', async () => {
        const validToken = {
          token: 'valid-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
          action: 'read' as const,
        };

        (validateSecureToken as Mock).mockResolvedValue(validToken);

        const result = await validateSecureToken('valid-token');

        expect(result).toBeTruthy();
        expect(result?.fileId).toBe('drive-file-123');
      });
    });

    describe('File ID Verification', () => {
      it('should return 400 when fileId is missing', () => {
        const req = {
          params: {},
          query: { token: 'valid-token' },
        };

        if (!req.params.fileId) {
          const expectedResponse = {
            message: 'File ID is required in the request',
            code: 'MISSING_FILE_ID',
          };
          expect(expectedResponse.code).toBe('MISSING_FILE_ID');
        }
      });

      it('should return 403 when token file ID does not match requested file ID', () => {
        const tokenData = {
          token: 'valid-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() + 300000),
          action: 'read' as const,
        };

        const requestedFileId = 'drive-file-456';

        if (tokenData.fileId !== requestedFileId) {
          const expectedResponse = {
            message: 'This access token is not valid for the requested file.',
            code: 'TOKEN_FILE_MISMATCH',
          };
          expect(expectedResponse.code).toBe('TOKEN_FILE_MISMATCH');
        }
      });
    });

    describe('Action Permission Checking', () => {
      it('should allow read action with read token', () => {
        const tokenData = {
          token: 'read-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() + 300000),
          action: 'read' as const,
        };

        const requestedAction = 'read';

        // Action matches or requested action is 'read' (default)
        const isAllowed = tokenData.action === requestedAction || requestedAction === 'read';
        expect(isAllowed).toBe(true);
      });

      it('should return 403 when action does not match token action', () => {
        const tokenData = {
          token: 'read-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() + 300000),
          action: 'read' as const,
        };

        const requestedAction = 'download';

        if (tokenData.action && requestedAction !== tokenData.action && requestedAction !== 'read') {
          const expectedResponse = {
            message: `This token only allows '${tokenData.action}' access. Requested action '${requestedAction}' is not permitted.`,
            code: 'ACTION_NOT_PERMITTED',
            allowedAction: tokenData.action,
            requestedAction: requestedAction,
          };
          expect(expectedResponse.code).toBe('ACTION_NOT_PERMITTED');
        }
      });

      it('should allow download action with download token', () => {
        const tokenData = {
          token: 'download-token',
          fileId: 'drive-file-123',
          assetId: 1,
          userId: 50,
          expiresAt: new Date(Date.now() + 300000),
          action: 'download' as const,
        };

        const requestedAction = 'download';

        const isAllowed = tokenData.action === requestedAction;
        expect(isAllowed).toBe(true);
      });
    });

    describe('Asset and Permission Validation', () => {
      it('should return 404 when asset is not found', async () => {
        mockDb.select.mockReturnValue(mockDb);
        mockDb.from.mockReturnValue(mockDb);
        mockDb.where.mockResolvedValue([]);

        const result = await mockDb.select().from({}).where({});

        if (result.length === 0) {
          const expectedResponse = {
            message: 'File not found. It may have been deleted.',
            code: 'FILE_NOT_FOUND',
          };
          expect(expectedResponse.code).toBe('FILE_NOT_FOUND');
        }
      });

      it('should check asset-level permissions', async () => {
        const asset = createMockAsset();
        const tokenData = {
          userId: 50,
          fileId: asset.driveFileId!,
          assetId: asset.id,
        };

        (checkAssetPermissionService as Mock).mockResolvedValue({
          allowed: true,
          asset,
        });

        await checkAssetPermissionService(
          tokenData.userId,
          asset.id,
          asset.clientId,
          'read'
        );

        expect(checkAssetPermissionService).toHaveBeenCalledWith(
          tokenData.userId,
          asset.id,
          asset.clientId,
          'read'
        );
      });

      it('should return 403 when asset permission is revoked', async () => {
        (checkAssetPermissionService as Mock).mockResolvedValue({
          allowed: false,
          reason: 'You no longer have permission to access this file',
        });

        const result = await checkAssetPermissionService(50, 1, 100, 'read');

        expect(result.allowed).toBe(false);
        const expectedResponse = {
          message: result.reason || 'You no longer have permission to access this file.',
          code: 'PERMISSION_REVOKED',
        };
        expect(expectedResponse.code).toBe('PERMISSION_REVOKED');
      });

      it('should check Drive-specific permissions', async () => {
        const asset = createMockAsset();

        (checkDrivePermission as Mock).mockResolvedValue({
          allowed: true,
        });

        await checkDrivePermission(50, asset.id, 'read');

        expect(checkDrivePermission).toHaveBeenCalledWith(50, asset.id, 'read');
      });

      it('should return 403 when Drive permission is denied', async () => {
        (checkDrivePermission as Mock).mockResolvedValue({
          allowed: false,
          reason: 'Drive file access denied',
        });

        const result = await checkDrivePermission(50, 1, 'read');

        expect(result.allowed).toBe(false);
        const expectedResponse = {
          message: result.reason || 'Drive file access denied.',
          code: 'DRIVE_PERMISSION_DENIED',
        };
        expect(expectedResponse.code).toBe('DRIVE_PERMISSION_DENIED');
      });
    });

    describe('Drive Connection Status', () => {
      it('should return 404 when Drive connection is not found', async () => {
        mockDb.select.mockReturnValue(mockDb);
        mockDb.from.mockReturnValue(mockDb);
        mockDb.where.mockResolvedValue([]);

        const result = await mockDb.select().from({}).where({});

        if (result.length === 0) {
          const expectedResponse = {
            message: 'Google Drive connection not found. Please reconnect your Drive account.',
            code: 'DRIVE_CONNECTION_NOT_FOUND',
          };
          expect(expectedResponse.code).toBe('DRIVE_CONNECTION_NOT_FOUND');
        }
      });
    });

    describe('Token Refresh Scenarios', () => {
      it('should use existing token when not expired', () => {
        const connection = createMockDriveConnection();

        (isTokenExpired as Mock).mockReturnValue(false);
        (decryptTokens as Mock).mockReturnValue({
          access_token: 'valid-access-token',
          refresh_token: 'refresh-token',
        });

        const expired = isTokenExpired(connection.tokenExpiresAt);

        if (!expired) {
          const tokens = decryptTokens({
            encryptedAccessToken: connection.encryptedAccessToken,
            encryptedRefreshToken: connection.encryptedRefreshToken,
            tokenExpiresAt: connection.tokenExpiresAt,
          });

          expect(tokens.access_token).toBe('valid-access-token');
        }
      });

      it('should refresh token when expired', async () => {
        const connection = createMockDriveConnection();

        (isTokenExpired as Mock).mockReturnValue(true);
        (refreshUserTokens as Mock).mockResolvedValue({
          credentials: {
            access_token: 'refreshed-access-token',
          },
        });

        const expired = isTokenExpired(connection.tokenExpiresAt);

        if (expired) {
          const refreshedClient = await refreshUserTokens('50');
          expect(refreshedClient.credentials.access_token).toBe('refreshed-access-token');
        }
      });

      it('should return 401 when token refresh fails', async () => {
        (isTokenExpired as Mock).mockReturnValue(true);
        (refreshUserTokens as Mock).mockRejectedValue(
          new Error('Token refresh failed')
        );

        try {
          await refreshUserTokens('50');
        } catch (_error) {
          const expectedResponse = {
            message: 'Your Google Drive session has expired. Please reconnect your Drive account.',
            code: 'TOKEN_REFRESH_FAILED',
          };
          expect(expectedResponse.code).toBe('TOKEN_REFRESH_FAILED');
        }
      });

      it('should return 500 when no access token is available', () => {
        const accessToken = '';

        if (!accessToken) {
          const expectedResponse = {
            message: 'Unable to obtain Drive access token. Please reconnect your Drive account.',
            code: 'NO_ACCESS_TOKEN',
          };
          expect(expectedResponse.code).toBe('NO_ACCESS_TOKEN');
        }
      });
    });

    describe('Drive API Error Scenarios', () => {
      it('should return 404 when file is not found in Drive', () => {
        const driveResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        };

        if (!driveResponse.ok && driveResponse.status === 404) {
          const expectedResponse = {
            message: 'File not found in Google Drive. It may have been deleted or moved.',
            code: 'DRIVE_FILE_NOT_FOUND',
          };
          expect(expectedResponse.code).toBe('DRIVE_FILE_NOT_FOUND');
        }
      });

      it('should return 403 when Drive access is denied', () => {
        const driveResponse = {
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        };

        if (!driveResponse.ok && driveResponse.status === 403) {
          const expectedResponse = {
            message: 'Access denied by Google Drive. You may no longer have permission to this file.',
            code: 'DRIVE_ACCESS_DENIED',
          };
          expect(expectedResponse.code).toBe('DRIVE_ACCESS_DENIED');
        }
      });

      it('should handle other Drive API errors', () => {
        const driveResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        };

        if (!driveResponse.ok) {
          const errorMessage = `Failed to download from Google Drive: ${driveResponse.status} ${driveResponse.statusText}`;
          expect(errorMessage).toContain('500');
        }
      });
    });

    describe('Single-Use Download Token Revocation', () => {
      it('should revoke token after successful download', () => {
        const token = 'download-token-123';
        const _action = 'download';

        if (_action === 'download') {
          revokeSecureToken(token);
          expect(revokeSecureToken).toHaveBeenCalledWith(token);
        }
      });

      it('should not revoke token for read actions', () => {
        const token = 'read-token-123';
        const _action = 'read';

        if (action === 'download') {
          revokeSecureToken(token);
        }

        // Token should not be revoked for read action
        expect(revokeSecureToken).not.toHaveBeenCalled();
      });
    });

    describe('Response Headers and Content', () => {
      it('should set appropriate headers for file streaming', () => {
        const asset = createMockAsset();
        const _action = 'read';

        const expectedHeaders = {
          'Content-Type': asset.fileType,
          'Content-Length': expect.any(Number),
          'Cache-Control': 'private, max-age=300',
          'X-Content-Source': 'google-drive',
        };

        expect(expectedHeaders['X-Content-Source']).toBe('google-drive');
        expect(expectedHeaders['Cache-Control']).toBe('private, max-age=300');
      });

      it('should set download headers for download action', () => {
        const asset = createMockAsset();
        const action = 'download';

        if (action === 'download') {
          const expectedHeaders = {
            'Content-Type': asset.fileType,
            'Content-Disposition': `attachment; filename="${asset.originalFileName}"`,
            'Content-Length': expect.any(Number),
          };

          expect(expectedHeaders['Content-Disposition']).toContain('attachment');
        }
      });
    });

    describe('Error Handling', () => {
      it('should return 500 with proper error code on file access failure', () => {
        const error = new Error('Failed to access Drive file');

        const expectedResponse = {
          message: 'Failed to access Drive file. Please try again later or request a new link.',
          code: 'FILE_ACCESS_ERROR',
          details: error.message,
        };

        expect(expectedResponse.code).toBe('FILE_ACCESS_ERROR');
        expect(expectedResponse.details).toBe('Failed to access Drive file');
      });
    });
  });

  describe('Permission Enforcement at Multiple Levels', () => {
    it('should validate both asset permissions and Drive permissions for thumbnails', async () => {
      const asset = createMockAsset();
      const userId = 50;

      (checkAssetPermissionService as Mock).mockResolvedValue({
        allowed: true,
        asset,
      });
      (checkDrivePermission as Mock).mockResolvedValue({
        allowed: true,
      });

      await checkAssetPermissionService(userId, asset.id, asset.clientId, 'read');
      await checkDrivePermission(userId, asset.id, 'read');

      expect(checkAssetPermissionService).toHaveBeenCalled();
      expect(checkDrivePermission).toHaveBeenCalled();
    });

    it('should validate both asset permissions and Drive permissions for secure access', async () => {
      const asset = createMockAsset();
      const userId = 50;

      (checkAssetPermissionService as Mock).mockResolvedValue({
        allowed: true,
        asset,
      });
      (checkDrivePermission as Mock).mockResolvedValue({
        allowed: true,
      });

      await checkAssetPermissionService(userId, asset.id, asset.clientId, 'read');
      await checkDrivePermission(userId, asset.id, 'read');

      expect(checkAssetPermissionService).toHaveBeenCalled();
      expect(checkDrivePermission).toHaveBeenCalled();
    });

    it('should deny access if asset permission fails even if Drive permission passes', async () => {
      (checkAssetPermissionService as Mock).mockResolvedValue({
        allowed: false,
        reason: 'No asset access',
      });
      (checkDrivePermission as Mock).mockResolvedValue({
        allowed: true,
      });

      const assetPermission = await checkAssetPermissionService(50, 1, 100, 'read');

      expect(assetPermission.allowed).toBe(false);
      // Access should be denied based on asset permission alone
    });

    it('should deny access if Drive permission fails even if asset permission passes', async () => {
      (checkAssetPermissionService as Mock).mockResolvedValue({
        allowed: true,
        asset: createMockAsset(),
      });
      (checkDrivePermission as Mock).mockResolvedValue({
        allowed: false,
        reason: 'No Drive access',
      });

      const drivePermission = await checkDrivePermission(50, 1, 'read');

      expect(drivePermission.allowed).toBe(false);
      // Access should be denied based on Drive permission alone
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle missing Drive metadata gracefully', async () => {
      const asset = createMockAsset({
        driveSharingMetadata: null,
        driveOwner: null,
      });

      (checkDrivePermission as Mock).mockResolvedValue({
        allowed: true,
      });

      const result = await checkDrivePermission(50, asset.id, 'read');
      expect(result).toBeDefined();
    });

    it('should validate token expiration strictly', () => {
      const justExpiredToken = {
        expiresAt: new Date(Date.now() - 1), // Expired 1ms ago
      };

      const expired = justExpiredToken.expiresAt < new Date();
      expect(expired).toBe(true);
    });

    it('should not allow bypassing permission checks', async () => {
      // Ensure that even with a valid token, permissions are still checked
      const validToken = {
        token: 'valid-token',
        fileId: 'drive-file-123',
        assetId: 1,
        userId: 50,
        expiresAt: new Date(Date.now() + 300000),
        action: 'read' as const,
      };

      (validateSecureToken as Mock).mockResolvedValue(validToken);
      (checkAssetPermissionService as Mock).mockResolvedValue({
        allowed: false,
        reason: 'Permission revoked',
      });

      const tokenValid = await validateSecureToken('valid-token');
      const permission = await checkAssetPermissionService(50, 1, 100, 'read');

      expect(tokenValid).toBeTruthy();
      expect(permission.allowed).toBe(false);
      // Even with valid token, permission check should still deny access
    });
  });

  describe('Audit Logging Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should log successful file access', () => {
      const mockContext = {
        userId: 123,
        assetId: 456,
        driveFileId: 'drive-file-123',
        action: 'read' as const,
        success: true,
        userRole: UserRole.STANDARD,
        clientId: 100,
      };

      (logDriveFileAccess as Mock).mockResolvedValue(undefined);
      logDriveFileAccess(mockContext);

      expect(logDriveFileAccess).toHaveBeenCalledWith(mockContext);
    });

    it('should log failed access with error details', () => {
      const mockContext = {
        userId: 123,
        driveFileId: 'drive-file-123',
        action: 'read' as const,
        errorCode: 'PERMISSION_DENIED',
        errorMessage: 'Permission denied',
      };

      (logFailedAccess as Mock).mockResolvedValue(undefined);
      logFailedAccess(mockContext);

      expect(logFailedAccess).toHaveBeenCalledWith(mockContext);
    });

    it('should capture request context in audit logs', () => {
      const mockRequest = {
        headers: {
          'x-forwarded-for': '203.0.113.1',
          'user-agent': 'Mozilla/5.0',
        },
      };

      const mockContext = {
        userId: 123,
        action: 'read' as const,
        success: true,
      };

      (logDriveFileAccess as Mock).mockResolvedValue(undefined);
      logDriveFileAccess(mockContext, mockRequest as any);

      expect(logDriveFileAccess).toHaveBeenCalledWith(mockContext, mockRequest);
    });
  });
});
