/**
 * Google Drive File Permission Tests
 *
 * These tests verify that Ferdinand's role-based permission system
 * correctly enforces access control for imported Google Drive files.
 *
 * Test Coverage:
 * - Role-based permission checks (GUEST, STANDARD, EDITOR, ADMIN, SUPER_ADMIN)
 * - Asset visibility enforcement (private vs shared)
 * - Owner-based restrictions for STANDARD users
 * - Permission validation for all file actions (read, write, delete, share)
 *
 * To run these tests:
 * npm test -- drive-file-permissions.test.ts
 */

import { describe, it, expect } from 'vitest';
import { UserRole } from '@shared/schema';
import {
  checkDriveFilePermission,
  type DriveFileAction,
} from '../server/services/drive-file-permissions';

// Helper to create permission context
function createContext(overrides: {
  uploadedBy?: number;
  visibility?: 'private' | 'shared';
  isGoogleDrive?: boolean;
  driveOwner?: number;
}) {
  return {
    uploadedBy: overrides.uploadedBy ?? 1,
    visibility: overrides.visibility ?? 'shared',
    isGoogleDrive: overrides.isGoogleDrive ?? true,
    driveOwner: overrides.driveOwner ?? 1,
  };
}

describe('Drive File Permissions - checkDriveFilePermission()', () => {
  const actions: DriveFileAction[] = ['read', 'write', 'delete', 'share'];

  describe('GUEST Role Permissions', () => {
    const userId = 5;
    const userRole = UserRole.GUEST;

    it('should allow GUEST to read shared files', () => {
      const context = createContext({ visibility: 'shared', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'read', context);

      expect(result.allowed).toBe(true);
    });

    it('should deny GUEST from reading private files', () => {
      const context = createContext({ visibility: 'private', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'read', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('shared');
    });

    it('should deny GUEST from write operations', () => {
      const context = createContext({ visibility: 'shared', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'write', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Guests can only read');
    });

    it('should deny GUEST from delete operations', () => {
      const context = createContext({ visibility: 'shared', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'delete', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Guests can only read');
    });

    it('should deny GUEST from share operations', () => {
      const context = createContext({ visibility: 'shared', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'share', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Guests can only read');
    });
  });

  describe('STANDARD Role Permissions', () => {
    const userId = 4;
    const userRole = UserRole.STANDARD;

    describe('Read Permissions', () => {
      it('should allow STANDARD to read shared files', () => {
        const context = createContext({ visibility: 'shared', uploadedBy: 1 });
        const result = checkDriveFilePermission(userId, userRole, 'read', context);

        expect(result.allowed).toBe(true);
      });

      it('should allow STANDARD to read their own private files', () => {
        const context = createContext({ visibility: 'private', uploadedBy: userId });
        const result = checkDriveFilePermission(userId, userRole, 'read', context);

        expect(result.allowed).toBe(true);
      });

      it('should deny STANDARD from reading private files owned by others', () => {
        const context = createContext({ visibility: 'private', uploadedBy: 1 });
        const result = checkDriveFilePermission(userId, userRole, 'read', context);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('private files owned by others');
      });
    });

    describe('Write Permissions', () => {
      it('should allow STANDARD to write their own files', () => {
        const context = createContext({ uploadedBy: userId });
        const result = checkDriveFilePermission(userId, userRole, 'write', context);

        expect(result.allowed).toBe(true);
      });

      it('should deny STANDARD from writing files owned by others', () => {
        const context = createContext({ uploadedBy: 1 });
        const result = checkDriveFilePermission(userId, userRole, 'write', context);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('own files');
      });
    });

    describe('Delete Permissions', () => {
      it('should allow STANDARD to delete their own files', () => {
        const context = createContext({ uploadedBy: userId });
        const result = checkDriveFilePermission(userId, userRole, 'delete', context);

        expect(result.allowed).toBe(true);
      });

      it('should deny STANDARD from deleting files owned by others', () => {
        const context = createContext({ uploadedBy: 1 });
        const result = checkDriveFilePermission(userId, userRole, 'delete', context);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('own files');
      });
    });

    describe('Share Permissions', () => {
      it('should allow STANDARD to share their own files', () => {
        const context = createContext({ uploadedBy: userId });
        const result = checkDriveFilePermission(userId, userRole, 'share', context);

        expect(result.allowed).toBe(true);
      });

      it('should deny STANDARD from sharing files owned by others', () => {
        const context = createContext({ uploadedBy: 1 });
        const result = checkDriveFilePermission(userId, userRole, 'share', context);

        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('own files');
      });
    });
  });

  describe('EDITOR Role Permissions', () => {
    const userId = 3;
    const userRole = UserRole.EDITOR;

    it('should allow EDITOR to read all files (shared and private)', () => {
      const sharedContext = createContext({ visibility: 'shared', uploadedBy: 1 });
      const privateContext = createContext({ visibility: 'private', uploadedBy: 1 });

      expect(checkDriveFilePermission(userId, userRole, 'read', sharedContext).allowed).toBe(true);
      expect(checkDriveFilePermission(userId, userRole, 'read', privateContext).allowed).toBe(true);
    });

    it('should allow EDITOR to write their own files', () => {
      const context = createContext({ uploadedBy: userId });
      const result = checkDriveFilePermission(userId, userRole, 'write', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow EDITOR to write files owned by others', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'write', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow EDITOR to delete their own files', () => {
      const context = createContext({ uploadedBy: userId });
      const result = checkDriveFilePermission(userId, userRole, 'delete', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow EDITOR to delete files owned by others', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'delete', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow EDITOR to share all files', () => {
      const ownContext = createContext({ uploadedBy: userId });
      const otherContext = createContext({ uploadedBy: 1 });

      expect(checkDriveFilePermission(userId, userRole, 'share', ownContext).allowed).toBe(true);
      expect(checkDriveFilePermission(userId, userRole, 'share', otherContext).allowed).toBe(true);
    });
  });

  describe('ADMIN Role Permissions', () => {
    const userId = 2;
    const userRole = UserRole.ADMIN;

    it('should allow ADMIN to read all files', () => {
      const context = createContext({ visibility: 'private', uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'read', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow ADMIN to write all files', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'write', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow ADMIN to delete all files', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'delete', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow ADMIN to share all files', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(userId, userRole, 'share', context);

      expect(result.allowed).toBe(true);
    });
  });

  describe('SUPER_ADMIN Role Permissions', () => {
    const userId = 1;
    const userRole = UserRole.SUPER_ADMIN;

    it('should allow SUPER_ADMIN to perform all actions', () => {
      const context = createContext({ uploadedBy: 5, visibility: 'private' });

      for (const action of actions) {
        const result = checkDriveFilePermission(userId, userRole, action, context);
        expect(result.allowed).toBe(true);
      }
    });

    it('should allow SUPER_ADMIN regardless of file ownership', () => {
      const context = createContext({ uploadedBy: 999 });
      const result = checkDriveFilePermission(userId, userRole, 'delete', context);

      expect(result.allowed).toBe(true);
    });

    it('should allow SUPER_ADMIN regardless of visibility', () => {
      const privateContext = createContext({ visibility: 'private', uploadedBy: 5 });
      const result = checkDriveFilePermission(userId, userRole, 'read', privateContext);

      expect(result.allowed).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown user role', () => {
      const context = createContext({ uploadedBy: 1 });
      const result = checkDriveFilePermission(1, 'unknown_role', 'read', context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Unknown user role');
    });

    it('should handle permission check with same user as owner', () => {
      const userId = 10;
      const context = createContext({ uploadedBy: userId });

      // Standard user should be able to modify their own files
      const standardResult = checkDriveFilePermission(userId, UserRole.STANDARD, 'write', context);
      expect(standardResult.allowed).toBe(true);

      // Guest should still be denied write even to their own files
      const guestResult = checkDriveFilePermission(userId, UserRole.GUEST, 'write', context);
      expect(guestResult.allowed).toBe(false);
    });
  });

  describe('Role Hierarchy Validation', () => {
    it('should follow proper permission hierarchy for read action', () => {
      const context = createContext({ visibility: 'private', uploadedBy: 1 });
      const testUserId = 100;

      // GUEST - cannot read private
      expect(checkDriveFilePermission(testUserId, UserRole.GUEST, 'read', context).allowed).toBe(false);

      // STANDARD - cannot read private owned by others
      expect(checkDriveFilePermission(testUserId, UserRole.STANDARD, 'read', context).allowed).toBe(false);

      // EDITOR - can read all
      expect(checkDriveFilePermission(testUserId, UserRole.EDITOR, 'read', context).allowed).toBe(true);

      // ADMIN - can read all
      expect(checkDriveFilePermission(testUserId, UserRole.ADMIN, 'read', context).allowed).toBe(true);

      // SUPER_ADMIN - can read all
      expect(checkDriveFilePermission(testUserId, UserRole.SUPER_ADMIN, 'read', context).allowed).toBe(true);
    });

    it('should follow proper permission hierarchy for delete action', () => {
      const context = createContext({ uploadedBy: 1 });
      const testUserId = 100;

      // GUEST - cannot delete
      expect(checkDriveFilePermission(testUserId, UserRole.GUEST, 'delete', context).allowed).toBe(false);

      // STANDARD - cannot delete others' files
      expect(checkDriveFilePermission(testUserId, UserRole.STANDARD, 'delete', context).allowed).toBe(false);

      // EDITOR - can delete
      expect(checkDriveFilePermission(testUserId, UserRole.EDITOR, 'delete', context).allowed).toBe(true);

      // ADMIN - can delete
      expect(checkDriveFilePermission(testUserId, UserRole.ADMIN, 'delete', context).allowed).toBe(true);

      // SUPER_ADMIN - can delete
      expect(checkDriveFilePermission(testUserId, UserRole.SUPER_ADMIN, 'delete', context).allowed).toBe(true);
    });
  });

  describe('Context Variations', () => {
    it('should check permissions with different visibility states', () => {
      const userId = 4;
      const sharedContext = createContext({ visibility: 'shared', uploadedBy: 1 });
      const privateContext = createContext({ visibility: 'private', uploadedBy: 1 });

      // STANDARD can read shared but not private (owned by others)
      expect(checkDriveFilePermission(userId, UserRole.STANDARD, 'read', sharedContext).allowed).toBe(true);
      expect(checkDriveFilePermission(userId, UserRole.STANDARD, 'read', privateContext).allowed).toBe(false);
    });

    it('should check permissions with different ownership', () => {
      const userId = 4;
      const ownContext = createContext({ uploadedBy: userId });
      const otherContext = createContext({ uploadedBy: 1 });

      // STANDARD can delete own files but not others
      expect(checkDriveFilePermission(userId, UserRole.STANDARD, 'delete', ownContext).allowed).toBe(true);
      expect(checkDriveFilePermission(userId, UserRole.STANDARD, 'delete', otherContext).allowed).toBe(false);
    });
  });
});
