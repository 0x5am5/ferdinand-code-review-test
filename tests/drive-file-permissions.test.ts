/**
 * Google Drive File Permission Tests
 *
 * These tests verify that Ferdinand's role-based permission system
 * correctly enforces access control for imported Google Drive files.
 *
 * Test Coverage:
 * - Role-based permission checks (GUEST, STANDARD, EDITOR, ADMIN, SUPER_ADMIN)
 * - Import permission validation
 * - Asset visibility enforcement
 * - Owner-based restrictions for STANDARD users
 * - Permission helper functions
 *
 * To run these tests:
 * npm test -- drive-file-permissions.test.ts
 */

import { describe, it, expect } from 'vitest';
import { UserRole } from '@shared/schema';
import {
  hasPermission,
  canImportDriveFiles,
  checkDriveFilePermission,
  getInitialImportPermissions,
  getRolePermissionDescription,
  getRolePermissions,
  DRIVE_FILE_PERMISSIONS,
} from '../server/services/drive-file-permissions';

describe('Drive File Permissions', () => {
  describe('Permission Matrix (DRIVE_FILE_PERMISSIONS)', () => {
    it('should define correct permissions for GUEST role', () => {
      const perms = DRIVE_FILE_PERMISSIONS[UserRole.GUEST];
      expect(perms.read).toBe(true); // Can view shared files
      expect(perms.write).toBe(false);
      expect(perms.delete).toBe(false);
      expect(perms.share).toBe(false);
      expect(perms.canImport).toBe(false);
    });

    it('should define correct permissions for STANDARD role', () => {
      const perms = DRIVE_FILE_PERMISSIONS[UserRole.STANDARD];
      expect(perms.read).toBe(true);
      expect(perms.write).toBe(true); // Can edit own files
      expect(perms.delete).toBe(false);
      expect(perms.share).toBe(false);
      expect(perms.canImport).toBe(true);
    });

    it('should define correct permissions for EDITOR role', () => {
      const perms = DRIVE_FILE_PERMISSIONS[UserRole.EDITOR];
      expect(perms.read).toBe(true);
      expect(perms.write).toBe(true); // Can edit all files
      expect(perms.delete).toBe(false);
      expect(perms.share).toBe(true);
      expect(perms.canImport).toBe(true);
    });

    it('should define correct permissions for ADMIN role', () => {
      const perms = DRIVE_FILE_PERMISSIONS[UserRole.ADMIN];
      expect(perms.read).toBe(true);
      expect(perms.write).toBe(true);
      expect(perms.delete).toBe(true);
      expect(perms.share).toBe(true);
      expect(perms.canImport).toBe(true);
    });

    it('should define correct permissions for SUPER_ADMIN role', () => {
      const perms = DRIVE_FILE_PERMISSIONS[UserRole.SUPER_ADMIN];
      expect(perms.read).toBe(true);
      expect(perms.write).toBe(true);
      expect(perms.delete).toBe(true);
      expect(perms.share).toBe(true);
      expect(perms.canImport).toBe(true);
    });
  });

  describe('hasPermission() - Base Permission Checks', () => {
    describe('GUEST role', () => {
      it('should allow read for shared files only', () => {
        expect(
          hasPermission(UserRole.GUEST, 'read', { assetVisibility: 'shared' })
        ).toBe(true);
        expect(
          hasPermission(UserRole.GUEST, 'read', { assetVisibility: 'private' })
        ).toBe(false);
      });

      it('should deny write, delete, and share permissions', () => {
        expect(
          hasPermission(UserRole.GUEST, 'write', { assetVisibility: 'shared' })
        ).toBe(false);
        expect(
          hasPermission(UserRole.GUEST, 'delete', { assetVisibility: 'shared' })
        ).toBe(false);
        expect(
          hasPermission(UserRole.GUEST, 'share', { assetVisibility: 'shared' })
        ).toBe(false);
      });
    });

    describe('STANDARD role', () => {
      it('should allow read for all files', () => {
        expect(
          hasPermission(UserRole.STANDARD, 'read', { assetVisibility: 'shared' })
        ).toBe(true);
        expect(
          hasPermission(UserRole.STANDARD, 'read', {
            assetVisibility: 'private',
          })
        ).toBe(true);
      });

      it('should allow write only for owned files', () => {
        expect(
          hasPermission(UserRole.STANDARD, 'write', { isOwner: true })
        ).toBe(true);
        expect(
          hasPermission(UserRole.STANDARD, 'write', { isOwner: false })
        ).toBe(false);
      });

      it('should deny delete regardless of ownership', () => {
        expect(
          hasPermission(UserRole.STANDARD, 'delete', { isOwner: true })
        ).toBe(false);
        expect(
          hasPermission(UserRole.STANDARD, 'delete', { isOwner: false })
        ).toBe(false);
      });

      it('should deny share permission', () => {
        expect(hasPermission(UserRole.STANDARD, 'share', {})).toBe(false);
      });
    });

    describe('EDITOR role', () => {
      it('should allow read and write for all files', () => {
        expect(hasPermission(UserRole.EDITOR, 'read', {})).toBe(true);
        expect(hasPermission(UserRole.EDITOR, 'write', {})).toBe(true);
      });

      it('should allow share permission', () => {
        expect(hasPermission(UserRole.EDITOR, 'share', {})).toBe(true);
      });

      it('should deny delete permission', () => {
        expect(hasPermission(UserRole.EDITOR, 'delete', {})).toBe(false);
      });
    });

    describe('ADMIN role', () => {
      it('should allow all permissions', () => {
        expect(hasPermission(UserRole.ADMIN, 'read', {})).toBe(true);
        expect(hasPermission(UserRole.ADMIN, 'write', {})).toBe(true);
        expect(hasPermission(UserRole.ADMIN, 'delete', {})).toBe(true);
        expect(hasPermission(UserRole.ADMIN, 'share', {})).toBe(true);
      });
    });

    describe('SUPER_ADMIN role', () => {
      it('should allow all permissions', () => {
        expect(hasPermission(UserRole.SUPER_ADMIN, 'read', {})).toBe(true);
        expect(hasPermission(UserRole.SUPER_ADMIN, 'write', {})).toBe(true);
        expect(hasPermission(UserRole.SUPER_ADMIN, 'delete', {})).toBe(true);
        expect(hasPermission(UserRole.SUPER_ADMIN, 'share', {})).toBe(true);
      });
    });
  });

  describe('canImportDriveFiles() - Import Permission Checks', () => {
    it('should deny import for GUEST role', () => {
      expect(canImportDriveFiles(UserRole.GUEST)).toBe(false);
    });

    it('should allow import for STANDARD role', () => {
      expect(canImportDriveFiles(UserRole.STANDARD)).toBe(true);
    });

    it('should allow import for EDITOR role', () => {
      expect(canImportDriveFiles(UserRole.EDITOR)).toBe(true);
    });

    it('should allow import for ADMIN role', () => {
      expect(canImportDriveFiles(UserRole.ADMIN)).toBe(true);
    });

    it('should allow import for SUPER_ADMIN role', () => {
      expect(canImportDriveFiles(UserRole.SUPER_ADMIN)).toBe(true);
    });
  });

  describe('checkDriveFilePermission() - Comprehensive Permission Checks', () => {
    const mockAssetData = {
      uploadedBy: 123,
      visibility: 'shared' as const,
      isGoogleDrive: true,
      driveOwner: 'owner@example.com',
    };

    describe('GUEST role checks', () => {
      it('should allow read for shared files', () => {
        const result = checkDriveFilePermission(456, UserRole.GUEST, 'read', {
          ...mockAssetData,
          visibility: 'shared',
        });
        expect(result.allowed).toBe(true);
        expect(result.userRole).toBe(UserRole.GUEST);
      });

      it('should deny read for private files', () => {
        const result = checkDriveFilePermission(456, UserRole.GUEST, 'read', {
          ...mockAssetData,
          visibility: 'private',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Guests can only view shared files');
      });

      it('should deny write permission', () => {
        const result = checkDriveFilePermission(456, UserRole.GUEST, 'write', {
          ...mockAssetData,
          visibility: 'shared',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('does not have write permission');
      });

      it('should deny delete permission', () => {
        const result = checkDriveFilePermission(456, UserRole.GUEST, 'delete', {
          ...mockAssetData,
          visibility: 'shared',
        });
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('does not have delete permission');
      });
    });

    describe('STANDARD role checks', () => {
      it('should allow read for any file', () => {
        const result = checkDriveFilePermission(
          123,
          UserRole.STANDARD,
          'read',
          mockAssetData
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow write for owned files', () => {
        const result = checkDriveFilePermission(
          123,
          UserRole.STANDARD,
          'write',
          {
            ...mockAssetData,
            uploadedBy: 123, // Same as userId
          }
        );
        expect(result.allowed).toBe(true);
      });

      it('should deny write for files owned by others', () => {
        const result = checkDriveFilePermission(
          456,
          UserRole.STANDARD,
          'write',
          {
            ...mockAssetData,
            uploadedBy: 123, // Different from userId
          }
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('can only write their own files');
      });

      it('should deny delete permission', () => {
        const result = checkDriveFilePermission(
          123,
          UserRole.STANDARD,
          'delete',
          mockAssetData
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('does not have delete permission');
      });
    });

    describe('EDITOR role checks', () => {
      it('should allow read for any file', () => {
        const result = checkDriveFilePermission(
          456,
          UserRole.EDITOR,
          'read',
          mockAssetData
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow write for any file', () => {
        const result = checkDriveFilePermission(
          456,
          UserRole.EDITOR,
          'write',
          mockAssetData
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow share permission', () => {
        const result = checkDriveFilePermission(
          456,
          UserRole.EDITOR,
          'share',
          mockAssetData
        );
        expect(result.allowed).toBe(true);
      });

      it('should deny delete permission', () => {
        const result = checkDriveFilePermission(
          456,
          UserRole.EDITOR,
          'delete',
          mockAssetData
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('does not have delete permission');
      });
    });

    describe('ADMIN role checks', () => {
      it('should allow all permissions', () => {
        expect(
          checkDriveFilePermission(789, UserRole.ADMIN, 'read', mockAssetData)
            .allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(789, UserRole.ADMIN, 'write', mockAssetData)
            .allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(789, UserRole.ADMIN, 'delete', mockAssetData)
            .allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(789, UserRole.ADMIN, 'share', mockAssetData)
            .allowed
        ).toBe(true);
      });
    });

    describe('SUPER_ADMIN role checks', () => {
      it('should allow all permissions', () => {
        expect(
          checkDriveFilePermission(
            789,
            UserRole.SUPER_ADMIN,
            'read',
            mockAssetData
          ).allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(
            789,
            UserRole.SUPER_ADMIN,
            'write',
            mockAssetData
          ).allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(
            789,
            UserRole.SUPER_ADMIN,
            'delete',
            mockAssetData
          ).allowed
        ).toBe(true);
        expect(
          checkDriveFilePermission(
            789,
            UserRole.SUPER_ADMIN,
            'share',
            mockAssetData
          ).allowed
        ).toBe(true);
      });
    });
  });

  describe('getInitialImportPermissions() - Import Settings', () => {
    const mockDriveMetadata = {
      isShared: false,
      isOwnedByImporter: true,
      driveOwner: 'importer@example.com',
      hasPublicLink: false,
      importerDriveRole: 'owner' as const,
    };

    it('should set importing user as Ferdinand owner', () => {
      const result = getInitialImportPermissions(
        123,
        UserRole.STANDARD,
        mockDriveMetadata
      );
      expect(result.ferdinandOwner).toBe(123);
    });

    it('should set visibility to shared for publicly shared Drive files', () => {
      const result = getInitialImportPermissions(123, UserRole.STANDARD, {
        ...mockDriveMetadata,
        hasPublicLink: true,
      });
      expect(result.initialVisibility).toBe('shared');
    });

    it('should set visibility to shared for Drive files marked as shared', () => {
      const result = getInitialImportPermissions(123, UserRole.STANDARD, {
        ...mockDriveMetadata,
        isShared: true,
      });
      expect(result.initialVisibility).toBe('shared');
    });

    it('should default to shared visibility', () => {
      const result = getInitialImportPermissions(
        123,
        UserRole.STANDARD,
        mockDriveMetadata
      );
      expect(result.initialVisibility).toBe('shared');
    });

    it('should store Drive metadata for reference', () => {
      const result = getInitialImportPermissions(
        123,
        UserRole.STANDARD,
        mockDriveMetadata
      );
      expect(result.storeDriveMetadata).toMatchObject({
        isShared: false,
        isOwnedByImporter: true,
        driveOwner: 'importer@example.com',
        hasPublicLink: false,
        importerDriveRole: 'owner',
      });
      expect(result.storeDriveMetadata.importedAt).toBeDefined();
    });
  });

  describe('Permission Helper Functions', () => {
    describe('getRolePermissionDescription()', () => {
      it('should return correct description for GUEST', () => {
        const desc = getRolePermissionDescription(UserRole.GUEST);
        expect(desc).toBe('view Drive files');
      });

      it('should return correct description for STANDARD', () => {
        const desc = getRolePermissionDescription(UserRole.STANDARD);
        expect(desc).toBe('view, edit own Drive files');
      });

      it('should return correct description for EDITOR', () => {
        const desc = getRolePermissionDescription(UserRole.EDITOR);
        expect(desc).toBe('view, edit, share Drive files');
      });

      it('should return correct description for ADMIN', () => {
        const desc = getRolePermissionDescription(UserRole.ADMIN);
        expect(desc).toBe('view, edit, delete, share Drive files');
      });

      it('should return correct description for SUPER_ADMIN', () => {
        const desc = getRolePermissionDescription(UserRole.SUPER_ADMIN);
        expect(desc).toBe('view, edit, delete, share Drive files');
      });
    });

    describe('getRolePermissions()', () => {
      it('should return comprehensive permissions for GUEST', () => {
        const result = getRolePermissions(UserRole.GUEST);
        expect(result.actions).toEqual(['read']);
        expect(result.canImport).toBe(false);
        expect(result.description).toBe('view Drive files');
      });

      it('should return comprehensive permissions for STANDARD', () => {
        const result = getRolePermissions(UserRole.STANDARD);
        expect(result.actions).toEqual(['read', 'write']);
        expect(result.canImport).toBe(true);
        expect(result.description).toBe('view, edit own Drive files');
      });

      it('should return comprehensive permissions for EDITOR', () => {
        const result = getRolePermissions(UserRole.EDITOR);
        expect(result.actions).toEqual(['read', 'write', 'share']);
        expect(result.canImport).toBe(true);
        expect(result.description).toBe('view, edit, share Drive files');
      });

      it('should return comprehensive permissions for ADMIN', () => {
        const result = getRolePermissions(UserRole.ADMIN);
        expect(result.actions).toEqual(['read', 'write', 'delete', 'share']);
        expect(result.canImport).toBe(true);
        expect(result.description).toBe('view, edit, delete, share Drive files');
      });

      it('should return comprehensive permissions for SUPER_ADMIN', () => {
        const result = getRolePermissions(UserRole.SUPER_ADMIN);
        expect(result.actions).toEqual(['read', 'write', 'delete', 'share']);
        expect(result.canImport).toBe(true);
        expect(result.description).toBe('view, edit, delete, share Drive files');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing ownership information gracefully', () => {
      const result = checkDriveFilePermission(123, UserRole.STANDARD, 'write', {
        uploadedBy: 456,
        visibility: 'shared',
        isGoogleDrive: true,
      });
      expect(result.allowed).toBe(false);
    });

    it('should handle missing visibility information with secure defaults', () => {
      const result = hasPermission(UserRole.GUEST, 'read', {});
      // Without visibility info, should default to denying access for guests
      expect(result).toBe(false);
    });

    it('should handle null drive metadata', () => {
      const result = getInitialImportPermissions(123, UserRole.STANDARD, {
        isShared: false,
        isOwnedByImporter: false,
      });
      expect(result.ferdinandOwner).toBe(123);
      expect(result.initialVisibility).toBe('shared');
    });
  });
});
