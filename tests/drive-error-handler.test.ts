/**
import type { MockedFunction } from 'vitest';
 * Drive Error Handler Tests
 *
 * These tests verify the standardized error handling for Drive file operations.
 * The error handler provides consistent error responses with user-friendly messages
 * and proper HTTP status codes.
 *
 * Test Coverage:
 * - Error response creation with all error codes
 * - Permission denied handlers
 * - Authentication error handlers
 * - File not found handlers
 * - Validation error handlers
 * - Drive API error handlers
 * - System error handlers
 * - Error detection utilities
 * - HTTP status codes
 * - User-friendly error messages
 *
 * To run these tests:
 * npm test -- drive-error-handler.test.ts
 */

import { describe, it, expect, vi, MockedFunction } from 'vitest';
import type { Response } from 'express';

// Import the error handler module
import {
  DriveErrorCode,
  createErrorResponse,
  handlePermissionDenied,
  handleDrivePermissionDenied,
  handleAuthError,
  handleFileNotFound,
  handleValidationError,
  handleDriveApiError,
  handleSystemError,
  isPermissionError,
  isNotFoundError,
  isAuthError,
} from '../server/services/drive-error-handler';

// Mock response helper
const createMockResponse = (): Partial<Response> & {
  statusCode: number;
  jsonData: any;
  status: MockedFunction<(code: number) => any>;
  json: MockedFunction<(data: any) => any>;
} => {
  const res: any = {
    statusCode: 200,
    jsonData: null,
  };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((data: any) => {
    res.jsonData = data;
    return res;
  });

  return res;
};

describe('Drive Error Handler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DriveErrorCode Constants', () => {
    it('should define all permission error codes', () => {
      expect(DriveErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(DriveErrorCode.DRIVE_PERMISSION_DENIED).toBe('DRIVE_PERMISSION_DENIED');
      expect(DriveErrorCode.TOKEN_FILE_MISMATCH).toBe('TOKEN_FILE_MISMATCH');
      expect(DriveErrorCode.ACTION_NOT_PERMITTED).toBe('ACTION_NOT_PERMITTED');
      expect(DriveErrorCode.PERMISSION_REVOKED).toBe('PERMISSION_REVOKED');
      expect(DriveErrorCode.ROLE_INSUFFICIENT).toBe('ROLE_INSUFFICIENT');
    });

    it('should define all authentication error codes', () => {
      expect(DriveErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(DriveErrorCode.DRIVE_AUTH_REQUIRED).toBe('DRIVE_AUTH_REQUIRED');
      expect(DriveErrorCode.INVALID_TOKEN).toBe('INVALID_TOKEN');
      expect(DriveErrorCode.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED');
      expect(DriveErrorCode.TOKEN_REFRESH_FAILED).toBe('TOKEN_REFRESH_FAILED');
    });

    it('should define all file error codes', () => {
      expect(DriveErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(DriveErrorCode.ASSET_NOT_FOUND).toBe('ASSET_NOT_FOUND');
      expect(DriveErrorCode.DRIVE_FILE_NOT_FOUND).toBe('DRIVE_FILE_NOT_FOUND');
      expect(DriveErrorCode.DRIVE_ACCESS_DENIED).toBe('DRIVE_ACCESS_DENIED');
      expect(DriveErrorCode.NO_THUMBNAIL).toBe('NO_THUMBNAIL');
    });

    it('should define all validation error codes', () => {
      expect(DriveErrorCode.MISSING_FILE_ID).toBe('MISSING_FILE_ID');
      expect(DriveErrorCode.INVALID_FILE_ID).toBe('INVALID_FILE_ID');
      expect(DriveErrorCode.MISSING_TOKEN).toBe('MISSING_TOKEN');
      expect(DriveErrorCode.INVALID_SIZE).toBe('INVALID_SIZE');
    });

    it('should define all system error codes', () => {
      expect(DriveErrorCode.DRIVE_CONNECTION_NOT_FOUND).toBe('DRIVE_CONNECTION_NOT_FOUND');
      expect(DriveErrorCode.NO_ACCESS_TOKEN).toBe('NO_ACCESS_TOKEN');
      expect(DriveErrorCode.FILE_ACCESS_ERROR).toBe('FILE_ACCESS_ERROR');
      expect(DriveErrorCode.THUMBNAIL_FETCH_ERROR).toBe('THUMBNAIL_FETCH_ERROR');
    });
  });

  describe('createErrorResponse() - Error Response Builder', () => {
    it('should create basic error response with code and message', () => {
      const response = createErrorResponse(DriveErrorCode.PERMISSION_DENIED);

      expect(response).toEqual({
        message: "You don't have permission to access this file. Contact your administrator for access.",
        code: 'PERMISSION_DENIED',
      });
    });

    it('should use custom message when provided', () => {
      const response = createErrorResponse(
        DriveErrorCode.PERMISSION_DENIED,
        'Custom permission message'
      );

      expect(response.message).toBe('Custom permission message');
      expect(response.code).toBe('PERMISSION_DENIED');
    });

    it('should include details when provided', () => {
      const response = createErrorResponse(
        DriveErrorCode.FILE_ACCESS_ERROR,
        undefined,
        'Network timeout after 30 seconds'
      );

      expect(response.details).toBe('Network timeout after 30 seconds');
    });

    it('should include metadata fields when provided', () => {
      const response = createErrorResponse(
        DriveErrorCode.ACTION_NOT_PERMITTED,
        undefined,
        undefined,
        {
          allowedAction: 'read',
          requestedAction: 'write',
          requiredPermission: 'editor',
        }
      );

      expect(response.allowedAction).toBe('read');
      expect(response.requestedAction).toBe('write');
      expect(response.requiredPermission).toBe('editor');
    });

    it('should create responses for all error codes', () => {
      const codes = Object.values(DriveErrorCode);

      codes.forEach((code) => {
        const response = createErrorResponse(code);
        expect(response.code).toBe(code);
        expect(response.message).toBeTruthy();
        expect(typeof response.message).toBe('string');
      });
    });

    it('should not include undefined metadata fields', () => {
      const response = createErrorResponse(
        DriveErrorCode.PERMISSION_DENIED,
        undefined,
        undefined,
        {
          requiredPermission: 'admin',
        }
      );

      expect(response.requiredPermission).toBe('admin');
      expect(response.allowedAction).toBeUndefined();
      expect(response.requestedAction).toBeUndefined();
    });
  });

  describe('handlePermissionDenied() - Permission Denied Handler', () => {
    it('should return 403 status code', () => {
      const res = createMockResponse() as Response;

      handlePermissionDenied(res);

      expect(res.statusCode).toBe(403);
    });

    it('should use default permission denied message', () => {
      const res = createMockResponse() as Response;

      handlePermissionDenied(res);

      expect(res.jsonData.code).toBe('PERMISSION_DENIED');
      expect(res.jsonData.message).toContain("don't have permission");
    });

    it('should use custom reason when provided', () => {
      const res = createMockResponse() as Response;

      handlePermissionDenied(res, 'Custom permission reason');

      expect(res.jsonData.message).toBe('Custom permission reason');
    });

    it('should include required permission when provided', () => {
      const res = createMockResponse() as Response;

      handlePermissionDenied(res, undefined, 'editor');

      expect(res.jsonData.requiredPermission).toBe('editor');
    });
  });

  describe('handleDrivePermissionDenied() - Drive Permission Handler', () => {
    it('should return 403 status code', () => {
      const res = createMockResponse() as Response;

      handleDrivePermissionDenied(res);

      expect(res.statusCode).toBe(403);
    });

    it('should use Drive-specific permission message', () => {
      const res = createMockResponse() as Response;

      handleDrivePermissionDenied(res);

      expect(res.jsonData.code).toBe('DRIVE_PERMISSION_DENIED');
      expect(res.jsonData.message).toContain('Drive file');
    });

    it('should use custom reason when provided', () => {
      const res = createMockResponse() as Response;

      handleDrivePermissionDenied(res, 'Drive access revoked by owner');

      expect(res.jsonData.message).toBe('Drive access revoked by owner');
    });
  });

  describe('handleAuthError() - Authentication Error Handler', () => {
    it('should return 401 status code', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.UNAUTHORIZED);

      expect(res.statusCode).toBe(401);
    });

    it('should handle UNAUTHORIZED error', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.UNAUTHORIZED);

      expect(res.jsonData.code).toBe('UNAUTHORIZED');
      expect(res.jsonData.message).toContain('Authentication required');
    });

    it('should handle DRIVE_AUTH_REQUIRED error', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.DRIVE_AUTH_REQUIRED);

      expect(res.jsonData.code).toBe('DRIVE_AUTH_REQUIRED');
      expect(res.jsonData.message).toContain('Google Drive authentication');
    });

    it('should handle INVALID_TOKEN error', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.INVALID_TOKEN);

      expect(res.jsonData.code).toBe('INVALID_TOKEN');
      expect(res.jsonData.message).toContain('expired or is invalid');
    });

    it('should handle TOKEN_EXPIRED error', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.TOKEN_EXPIRED);

      expect(res.jsonData.code).toBe('TOKEN_EXPIRED');
      expect(res.jsonData.message).toContain('expired');
    });

    it('should handle TOKEN_REFRESH_FAILED error', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.TOKEN_REFRESH_FAILED);

      expect(res.jsonData.code).toBe('TOKEN_REFRESH_FAILED');
      expect(res.jsonData.message).toContain('session has expired');
    });

    it('should use custom message when provided', () => {
      const res = createMockResponse() as Response;

      handleAuthError(res, DriveErrorCode.UNAUTHORIZED, 'Custom auth message');

      expect(res.jsonData.message).toBe('Custom auth message');
    });
  });

  describe('handleFileNotFound() - File Not Found Handler', () => {
    it('should return 404 status code', () => {
      const res = createMockResponse() as Response;

      handleFileNotFound(res, DriveErrorCode.FILE_NOT_FOUND);

      expect(res.statusCode).toBe(404);
    });

    it('should handle FILE_NOT_FOUND error', () => {
      const res = createMockResponse() as Response;

      handleFileNotFound(res, DriveErrorCode.FILE_NOT_FOUND);

      expect(res.jsonData.code).toBe('FILE_NOT_FOUND');
      expect(res.jsonData.message).toContain('File not found');
    });

    it('should handle ASSET_NOT_FOUND error', () => {
      const res = createMockResponse() as Response;

      handleFileNotFound(res, DriveErrorCode.ASSET_NOT_FOUND);

      expect(res.jsonData.code).toBe('ASSET_NOT_FOUND');
      expect(res.jsonData.message).toContain('Asset not found');
    });

    it('should handle DRIVE_FILE_NOT_FOUND error', () => {
      const res = createMockResponse() as Response;

      handleFileNotFound(res, DriveErrorCode.DRIVE_FILE_NOT_FOUND);

      expect(res.jsonData.code).toBe('DRIVE_FILE_NOT_FOUND');
      expect(res.jsonData.message).toContain('Google Drive');
    });

    it('should use custom message when provided', () => {
      const res = createMockResponse() as Response;

      handleFileNotFound(res, DriveErrorCode.FILE_NOT_FOUND, 'Custom not found message');

      expect(res.jsonData.message).toBe('Custom not found message');
    });
  });

  describe('handleValidationError() - Validation Error Handler', () => {
    it('should return 400 status code', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.MISSING_FILE_ID);

      expect(res.statusCode).toBe(400);
    });

    it('should handle MISSING_FILE_ID error', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.MISSING_FILE_ID);

      expect(res.jsonData.code).toBe('MISSING_FILE_ID');
      expect(res.jsonData.message).toContain('File ID is required');
    });

    it('should handle INVALID_FILE_ID error', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.INVALID_FILE_ID);

      expect(res.jsonData.code).toBe('INVALID_FILE_ID');
      expect(res.jsonData.message).toContain('Invalid Drive file ID');
    });

    it('should handle MISSING_TOKEN error', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.MISSING_TOKEN);

      expect(res.jsonData.code).toBe('MISSING_TOKEN');
      expect(res.jsonData.message).toContain('Access token is required');
    });

    it('should handle INVALID_SIZE error', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.INVALID_SIZE);

      expect(res.jsonData.code).toBe('INVALID_SIZE');
      expect(res.jsonData.message).toContain('Invalid thumbnail size');
    });

    it('should use custom message when provided', () => {
      const res = createMockResponse() as Response;

      handleValidationError(res, DriveErrorCode.MISSING_FILE_ID, 'Custom validation message');

      expect(res.jsonData.message).toBe('Custom validation message');
    });
  });

  describe('handleDriveApiError() - Drive API Error Handler', () => {
    it('should handle 404 status from Drive API', () => {
      const res = createMockResponse() as Response;

      handleDriveApiError(res, 404);

      expect(res.statusCode).toBe(404);
      expect(res.jsonData.code).toBe('DRIVE_FILE_NOT_FOUND');
      expect(res.jsonData.message).toContain('not found in Google Drive');
    });

    it('should handle 403 status from Drive API', () => {
      const res = createMockResponse() as Response;

      handleDriveApiError(res, 403);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData.code).toBe('DRIVE_ACCESS_DENIED');
      expect(res.jsonData.message).toContain('Access denied by Google Drive');
    });

    it('should handle 401 status from Drive API', () => {
      const res = createMockResponse() as Response;

      handleDriveApiError(res, 401);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.code).toBe('TOKEN_EXPIRED');
    });

    it('should handle generic errors for other status codes', () => {
      const res = createMockResponse() as Response;

      handleDriveApiError(res, 500);

      expect(res.statusCode).toBe(500);
      expect(res.jsonData.code).toBe('FILE_ACCESS_ERROR');
    });

    it('should include error message when provided', () => {
      const res = createMockResponse() as Response;
      const error = new Error('Drive API quota exceeded');

      handleDriveApiError(res, 429, error);

      expect(res.jsonData.message).toBe('Drive API quota exceeded');
    });

    it('should map various HTTP status codes correctly', () => {
      const testCases = [
        { status: 404, expectedCode: 'DRIVE_FILE_NOT_FOUND' },
        { status: 403, expectedCode: 'DRIVE_ACCESS_DENIED' },
        { status: 401, expectedCode: 'TOKEN_EXPIRED' },
        { status: 429, expectedCode: 'FILE_ACCESS_ERROR' },
        { status: 500, expectedCode: 'FILE_ACCESS_ERROR' },
        { status: 503, expectedCode: 'FILE_ACCESS_ERROR' },
      ];

      testCases.forEach(({ status, expectedCode }) => {
        const res = createMockResponse() as Response;
        handleDriveApiError(res, status);
        expect(res.jsonData.code).toBe(expectedCode);
      });
    });
  });

  describe('handleSystemError() - System Error Handler', () => {
    it('should return 500 status code', () => {
      const res = createMockResponse() as Response;
      const error = new Error('System failure');

      handleSystemError(res, error);

      expect(res.statusCode).toBe(500);
    });

    it('should use default FILE_ACCESS_ERROR code', () => {
      const res = createMockResponse() as Response;
      const error = new Error('System failure');

      handleSystemError(res, error);

      expect(res.jsonData.code).toBe('FILE_ACCESS_ERROR');
    });

    it('should use custom error code when provided', () => {
      const res = createMockResponse() as Response;
      const error = new Error('Thumbnail generation failed');

      handleSystemError(res, error, DriveErrorCode.THUMBNAIL_FETCH_ERROR);

      expect(res.jsonData.code).toBe('THUMBNAIL_FETCH_ERROR');
    });

    it('should include error message in details', () => {
      const res = createMockResponse() as Response;
      const error = new Error('Database connection timeout');

      handleSystemError(res, error);

      expect(res.jsonData.details).toBe('Database connection timeout');
    });

    it('should log error to console', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const res = createMockResponse() as Response;
      const error = new Error('Critical error');

      handleSystemError(res, error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Drive system error:', error);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error Detection Utilities', () => {
    describe('isPermissionError()', () => {
      it('should detect permission errors in strings', () => {
        expect(isPermissionError('permission denied')).toBe(true);
        expect(isPermissionError('You are not authorized')).toBe(true);
        expect(isPermissionError('Access forbidden')).toBe(true);
        expect(isPermissionError('PERMISSION_DENIED')).toBe(true);
      });

      it('should detect permission errors in Error objects', () => {
        expect(isPermissionError(new Error('Permission denied'))).toBe(true);
        expect(isPermissionError(new Error('Unauthorized access'))).toBe(true);
        expect(isPermissionError(new Error('Forbidden resource'))).toBe(true);
      });

      it('should return false for non-permission errors', () => {
        expect(isPermissionError('File not found')).toBe(false);
        expect(isPermissionError('Invalid token')).toBe(false);
        expect(isPermissionError(new Error('Network error'))).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isPermissionError(null)).toBe(false);
        expect(isPermissionError(undefined)).toBe(false);
        expect(isPermissionError(123)).toBe(false);
        expect(isPermissionError({})).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(isPermissionError('PERMISSION DENIED')).toBe(true);
        expect(isPermissionError('Permission Denied')).toBe(true);
        expect(isPermissionError('permission denied')).toBe(true);
      });
    });

    describe('isNotFoundError()', () => {
      it('should detect not found errors in strings', () => {
        expect(isNotFoundError('File not found')).toBe(true);
        expect(isNotFoundError('Resource not found')).toBe(true);
        expect(isNotFoundError('NOT_FOUND')).toBe(true);
      });

      it('should detect not found errors in Error objects', () => {
        expect(isNotFoundError(new Error('File not found'))).toBe(true);
        expect(isNotFoundError(new Error('Asset not found'))).toBe(true);
      });

      it('should return false for non-not-found errors', () => {
        expect(isNotFoundError('Permission denied')).toBe(false);
        expect(isNotFoundError('Invalid token')).toBe(false);
        expect(isNotFoundError(new Error('Network error'))).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isNotFoundError(null)).toBe(false);
        expect(isNotFoundError(undefined)).toBe(false);
        expect(isNotFoundError(123)).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(isNotFoundError('NOT FOUND')).toBe(true);
        expect(isNotFoundError('Not Found')).toBe(true);
        expect(isNotFoundError('not found')).toBe(true);
      });
    });

    describe('isAuthError()', () => {
      it('should detect auth errors in strings', () => {
        expect(isAuthError('Token expired')).toBe(true);
        expect(isAuthError('Invalid token provided')).toBe(true);
        expect(isAuthError('Authentication failed')).toBe(true);
      });

      it('should detect auth errors in Error objects', () => {
        expect(isAuthError(new Error('Token has expired'))).toBe(true);
        expect(isAuthError(new Error('Invalid token'))).toBe(true);
        expect(isAuthError(new Error('Authentication required'))).toBe(true);
      });

      it('should return false for non-auth errors', () => {
        expect(isAuthError('File not found')).toBe(false);
        expect(isAuthError('Permission denied')).toBe(false);
        expect(isAuthError(new Error('Network error'))).toBe(false);
      });

      it('should return false for non-error values', () => {
        expect(isAuthError(null)).toBe(false);
        expect(isAuthError(undefined)).toBe(false);
        expect(isAuthError(123)).toBe(false);
      });

      it('should be case-insensitive', () => {
        expect(isAuthError('TOKEN EXPIRED')).toBe(true);
        expect(isAuthError('Token Expired')).toBe(true);
        expect(isAuthError('token expired')).toBe(true);
      });
    });
  });

  describe('Error Message User-Friendliness', () => {
    it('should provide actionable guidance in permission errors', () => {
      const response = createErrorResponse(DriveErrorCode.PERMISSION_DENIED);
      expect(response.message).toContain('Contact your administrator');
    });

    it('should guide users to reconnect Drive on auth errors', () => {
      const response = createErrorResponse(DriveErrorCode.DRIVE_AUTH_REQUIRED);
      expect(response.message).toContain('connect your Google Drive account');
    });

    it('should guide users to request new link on token errors', () => {
      const response = createErrorResponse(DriveErrorCode.TOKEN_EXPIRED);
      expect(response.message).toContain('request a new link');
    });

    it('should explain file absence in not found errors', () => {
      const response = createErrorResponse(DriveErrorCode.FILE_NOT_FOUND);
      expect(response.message).toContain('may have been deleted');
    });

    it('should specify valid values in validation errors', () => {
      const response = createErrorResponse(DriveErrorCode.INVALID_SIZE);
      expect(response.message).toContain('small');
      expect(response.message).toContain('medium');
      expect(response.message).toContain('large');
    });
  });

  describe('HTTP Status Code Correctness', () => {
    it('should use 403 for all permission errors', () => {
      const res1 = createMockResponse() as Response;
      const res2 = createMockResponse() as Response;

      handlePermissionDenied(res1);
      handleDrivePermissionDenied(res2);

      expect(res1.statusCode).toBe(403);
      expect(res2.statusCode).toBe(403);
    });

    it('should use 401 for all auth errors', () => {
      const authCodes = [
        DriveErrorCode.UNAUTHORIZED,
        DriveErrorCode.DRIVE_AUTH_REQUIRED,
        DriveErrorCode.INVALID_TOKEN,
        DriveErrorCode.TOKEN_EXPIRED,
        DriveErrorCode.TOKEN_REFRESH_FAILED,
      ];

      authCodes.forEach((code) => {
        const res = createMockResponse() as Response;
        handleAuthError(res, code);
        expect(res.statusCode).toBe(401);
      });
    });

    it('should use 404 for all not found errors', () => {
      const notFoundCodes = [
        DriveErrorCode.FILE_NOT_FOUND,
        DriveErrorCode.ASSET_NOT_FOUND,
        DriveErrorCode.DRIVE_FILE_NOT_FOUND,
      ];

      notFoundCodes.forEach((code) => {
        const res = createMockResponse() as Response;
        handleFileNotFound(res, code);
        expect(res.statusCode).toBe(404);
      });
    });

    it('should use 400 for all validation errors', () => {
      const validationCodes = [
        DriveErrorCode.MISSING_FILE_ID,
        DriveErrorCode.INVALID_FILE_ID,
        DriveErrorCode.MISSING_TOKEN,
        DriveErrorCode.INVALID_SIZE,
      ];

      validationCodes.forEach((code) => {
        const res = createMockResponse() as Response;
        handleValidationError(res, code);
        expect(res.statusCode).toBe(400);
      });
    });

    it('should use 500 for system errors', () => {
      const res = createMockResponse() as Response;
      handleSystemError(res, new Error('System failure'));
      expect(res.statusCode).toBe(500);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle very long custom messages', () => {
      const longMessage = 'Error: '.repeat(1000);
      const response = createErrorResponse(DriveErrorCode.FILE_ACCESS_ERROR, longMessage);

      expect(response.message).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const message = 'Error: <script>alert("xss")</script>';
      const response = createErrorResponse(DriveErrorCode.FILE_ACCESS_ERROR, message);

      expect(response.message).toBe(message);
      // Note: Actual XSS prevention happens at the frontend/browser level
    });

    it('should handle unicode characters in error messages', () => {
      const message = 'エラー: ファイルが見つかりません 🚫';
      const response = createErrorResponse(DriveErrorCode.FILE_NOT_FOUND, message);

      expect(response.message).toBe(message);
    });

    it('should not leak sensitive information in error messages', () => {
      const allMessages = Object.values(DriveErrorCode).map((code) =>
        createErrorResponse(code).message.toLowerCase()
      );

      allMessages.forEach((message) => {
        expect(message).not.toContain('password');
        expect(message).not.toContain('secret');
        expect(message).not.toContain('key');
        expect(message).not.toContain('token:');
        expect(message).not.toContain('internal server error');
      });
    });

    it('should provide consistent error structure', () => {
      const codes = Object.values(DriveErrorCode);

      codes.forEach((code) => {
        const response = createErrorResponse(code);

        expect(response).toHaveProperty('message');
        expect(response).toHaveProperty('code');
        expect(typeof response.message).toBe('string');
        expect(typeof response.code).toBe('string');
        expect(response.message.length).toBeGreaterThan(0);
      });
    });
  });
});
