/**
 * Drive File Access Audit Logging Tests
 *
 * These tests verify the audit logging functionality for Drive file operations.
 * Audit logs are critical for security monitoring, compliance, and debugging.
 *
 * Test Coverage:
 * - Successful access logging
 * - Failed access logging with error details
 * - Permission denied logging
 * - Drive API error logging
 * - File import logging
 * - Request context extraction (IP address, user agent)
 * - Error handling (logging failures shouldn't break main flow)
 * - Database record validation
 *
 * To run these tests:
 * npm test -- drive-audit-logging.test.ts
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { UserRole } from '@shared/schema';
// Mock database
const mockDb = {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockResolvedValue([{ id: 1 }]),
};
// Mock schema
const mockDriveFileAccessLogs = {
    userId: 'userId',
    assetId: 'assetId',
    driveFileId: 'driveFileId',
};
// Setup mocks
jest.mock('../server/db', () => ({
    db: mockDb,
}));
jest.mock('@shared/schema', () => ({
    driveFileAccessLogs: mockDriveFileAccessLogs,
    insertDriveFileAccessLogSchema: {
        parse: jest.fn((data) => data),
    },
    UserRole: {
        GUEST: 'guest',
        STANDARD: 'standard',
        EDITOR: 'editor',
        ADMIN: 'admin',
        SUPER_ADMIN: 'super_admin',
    },
}));
// Import after mocks
import { logDriveFileAccess, logSuccessfulAccess, logFailedAccess, logPermissionDenied, logDriveApiError, logFileImport, getErrorCode, getErrorMessage, } from '../server/services/drive-audit-logger';
import { insertDriveFileAccessLogSchema } from '@shared/schema';
// Type-safe mock cast
const asMock = (fn) => fn;
// Test data factories
const createMockRequest = (overrides) => ({
    headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'x-forwarded-for': '192.168.1.1',
    },
    socket: {
        remoteAddress: '192.168.1.100',
    },
    ...overrides,
});
describe('Drive Audit Logging Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock implementations
        asMock(mockDb.insert).mockReturnValue(mockDb);
        asMock(mockDb.values).mockResolvedValue([{ id: 1 }]);
        asMock(insertDriveFileAccessLogSchema.parse).mockImplementation((data) => data);
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe('logDriveFileAccess() - Main Logging Function', () => {
        it('should log a successful file access', async () => {
            const context = {
                userId: 123,
                assetId: 456,
                driveFileId: 'drive-file-123',
                action: 'read',
                success: true,
                userRole: UserRole.STANDARD,
                clientId: 100,
            };
            const req = createMockRequest();
            await logDriveFileAccess(context, req);
            expect(mockDb.insert).toHaveBeenCalledWith(mockDriveFileAccessLogs);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                assetId: 456,
                driveFileId: 'drive-file-123',
                action: 'read',
                success: true,
                userRole: UserRole.STANDARD,
                clientId: 100,
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            }));
        });
        it('should log a failed file access with error details', async () => {
            const context = {
                userId: 123,
                assetId: 456,
                driveFileId: 'drive-file-123',
                action: 'write',
                success: false,
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'User does not have write permission',
                userRole: UserRole.GUEST,
                clientId: 100,
            };
            await logDriveFileAccess(context);
            expect(mockDb.insert).toHaveBeenCalled();
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                success: false,
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'User does not have write permission',
            }));
        });
        it('should extract IP address from x-forwarded-for header', async () => {
            const req = createMockRequest({
                headers: {
                    'x-forwarded-for': '203.0.113.1, 192.168.1.1',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '203.0.113.1',
            }));
        });
        it('should extract IP address from x-real-ip header', async () => {
            const req = createMockRequest({
                headers: {
                    'x-real-ip': '203.0.113.2',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '203.0.113.2',
            }));
        });
        it('should fall back to socket.remoteAddress for IP', async () => {
            const req = createMockRequest({
                headers: {},
                socket: {
                    remoteAddress: '192.168.1.100',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '192.168.1.100',
            }));
        });
        it('should extract user agent from headers', async () => {
            const req = createMockRequest({
                headers: {
                    'user-agent': 'CustomBot/1.0',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userAgent: 'CustomBot/1.0',
            }));
        });
        it('should handle missing request context gracefully', async () => {
            await logDriveFileAccess({
                action: 'read',
                success: true,
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: undefined,
                userAgent: undefined,
            }));
        });
        it('should include metadata if provided', async () => {
            const context = {
                action: 'download',
                success: true,
                metadata: {
                    fileSize: 1024000,
                    mimeType: 'application/pdf',
                },
            };
            await logDriveFileAccess(context);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                metadata: {
                    fileSize: 1024000,
                    mimeType: 'application/pdf',
                },
            }));
        });
        it('should not throw errors if logging fails', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            asMock(mockDb.insert).mockImplementation(() => {
                throw new Error('Database connection failed');
            });
            // Should not throw
            await expect(logDriveFileAccess({
                action: 'read',
                success: true,
            })).resolves.not.toThrow();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to log Drive file access:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
        it('should validate data with schema before inserting', async () => {
            const context = {
                userId: 123,
                action: 'read',
                success: true,
            };
            await logDriveFileAccess(context);
            expect(insertDriveFileAccessLogSchema.parse).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                action: 'read',
                success: true,
            }));
        });
    });
    describe('logSuccessfulAccess() - Success Helper', () => {
        it('should log successful access with success=true', async () => {
            await logSuccessfulAccess({
                userId: 123,
                assetId: 456,
                driveFileId: 'drive-file-123',
                action: 'read',
                userRole: UserRole.EDITOR,
                clientId: 100,
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                userId: 123,
                assetId: 456,
            }));
        });
        it('should accept request context', async () => {
            const req = createMockRequest();
            await logSuccessfulAccess({
                userId: 123,
                action: 'thumbnail',
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                ipAddress: '192.168.1.1',
            }));
        });
    });
    describe('logFailedAccess() - Failure Helper', () => {
        it('should log failed access with success=false', async () => {
            await logFailedAccess({
                userId: 123,
                assetId: 456,
                driveFileId: 'drive-file-123',
                action: 'write',
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'User lacks write permission',
                userRole: UserRole.STANDARD,
                clientId: 100,
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'User lacks write permission',
            }));
        });
        it('should require errorCode and errorMessage', async () => {
            await logFailedAccess({
                userId: 123,
                action: 'read',
                errorCode: 'FILE_NOT_FOUND',
                errorMessage: 'File does not exist',
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                errorCode: 'FILE_NOT_FOUND',
                errorMessage: 'File does not exist',
            }));
        });
        it('should accept request context', async () => {
            const req = createMockRequest();
            await logFailedAccess({
                action: 'download',
                errorCode: 'TOKEN_EXPIRED',
                errorMessage: 'Access token has expired',
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                ipAddress: '192.168.1.1',
                userAgent: expect.any(String),
            }));
        });
    });
    describe('logPermissionDenied() - Permission Denial Helper', () => {
        it('should log permission denial with PERMISSION_DENIED code', async () => {
            await logPermissionDenied(123, // userId
            456, // assetId
            'write', // action
            'User role does not allow write access', // reason
            UserRole.GUEST, // userRole
            100 // clientId
            );
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                assetId: 456,
                action: 'write',
                success: false,
                errorCode: 'PERMISSION_DENIED',
                errorMessage: 'User role does not allow write access',
                userRole: UserRole.GUEST,
                clientId: 100,
            }));
        });
        it('should work with undefined assetId', async () => {
            await logPermissionDenied(123, undefined, 'delete', 'Delete permission denied', UserRole.STANDARD, 100);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                assetId: undefined,
                errorCode: 'PERMISSION_DENIED',
            }));
        });
        it('should work with undefined clientId', async () => {
            await logPermissionDenied(123, 456, 'share', 'Share permission denied', UserRole.EDITOR, undefined);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                clientId: undefined,
            }));
        });
        it('should accept request context', async () => {
            const req = createMockRequest();
            await logPermissionDenied(123, 456, 'write', 'Permission denied', UserRole.STANDARD, 100, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '192.168.1.1',
            }));
        });
    });
    describe('logDriveApiError() - Drive API Error Helper', () => {
        it('should log Drive API errors', async () => {
            await logDriveApiError(123, // userId
            'drive-file-123', // driveFileId
            'read', // action
            'DRIVE_FILE_NOT_FOUND', // errorCode
            'File not found in Google Drive' // errorMessage
            );
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                driveFileId: 'drive-file-123',
                action: 'read',
                success: false,
                errorCode: 'DRIVE_FILE_NOT_FOUND',
                errorMessage: 'File not found in Google Drive',
            }));
        });
        it('should work with undefined userId', async () => {
            await logDriveApiError(undefined, 'drive-file-123', 'thumbnail', 'DRIVE_ACCESS_DENIED', 'Access denied by Drive');
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: undefined,
                errorCode: 'DRIVE_ACCESS_DENIED',
            }));
        });
        it('should accept request context', async () => {
            const req = createMockRequest();
            await logDriveApiError(123, 'drive-file-123', 'download', 'DRIVE_QUOTA_EXCEEDED', 'Drive API quota exceeded', req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '192.168.1.1',
                userAgent: expect.any(String),
            }));
        });
    });
    describe('logFileImport() - File Import Logging', () => {
        it('should log successful file import', async () => {
            await logFileImport(123, // userId
            'drive-file-123', // driveFileId
            true, // success
            789, // assetId
            UserRole.EDITOR, // userRole
            100 // clientId
            );
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                userId: 123,
                assetId: 789,
                driveFileId: 'drive-file-123',
                action: 'import',
                success: true,
                userRole: UserRole.EDITOR,
                clientId: 100,
                metadata: expect.objectContaining({
                    importedAt: expect.any(String),
                }),
            }));
        });
        it('should log failed file import with error details', async () => {
            await logFileImport(123, 'drive-file-123', false, // success = false
            undefined, // no assetId created
            UserRole.STANDARD, 100, {
                errorCode: 'IMPORT_FAILED',
                errorMessage: 'Failed to download file from Drive',
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                errorCode: 'IMPORT_FAILED',
                errorMessage: 'Failed to download file from Drive',
                assetId: undefined,
            }));
        });
        it('should include import timestamp in metadata', async () => {
            const beforeImport = new Date().toISOString();
            await logFileImport(123, 'drive-file-123', true, 789, UserRole.ADMIN, 100);
            const afterImport = new Date().toISOString();
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({
                    importedAt: expect.any(String),
                }),
            }));
            // Verify timestamp is in valid range
            const call = asMock(mockDb.values).mock.calls[0][0];
            const importedAt = call.metadata.importedAt;
            expect(importedAt).toBeGreaterThanOrEqual(beforeImport);
            expect(importedAt).toBeLessThanOrEqual(afterImport);
        });
        it('should accept request context', async () => {
            const req = createMockRequest();
            await logFileImport(123, 'drive-file-123', true, 789, UserRole.ADMIN, 100, undefined, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '192.168.1.1',
            }));
        });
    });
    describe('Request Context Extraction', () => {
        it('should handle multiple IPs in x-forwarded-for', async () => {
            const req = createMockRequest({
                headers: {
                    'x-forwarded-for': '203.0.113.1, 198.51.100.1, 192.168.1.1',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            // Should use the first IP (client IP)
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '203.0.113.1',
            }));
        });
        it('should trim whitespace from IP addresses', async () => {
            const req = createMockRequest({
                headers: {
                    'x-forwarded-for': '  203.0.113.1  , 192.168.1.1',
                },
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: '203.0.113.1',
            }));
        });
        it('should handle missing headers gracefully', async () => {
            const req = createMockRequest({
                headers: {},
                socket: undefined,
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            }, req);
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                ipAddress: undefined,
                userAgent: undefined,
            }));
        });
    });
    describe('Error Code and Message Helpers', () => {
        describe('getErrorCode()', () => {
            it('should convert string to uppercase error code', () => {
                expect(getErrorCode('permission denied')).toBe('PERMISSION_DENIED');
                expect(getErrorCode('file not found')).toBe('FILE_NOT_FOUND');
            });
            it('should detect permission errors', () => {
                const error = new Error('You do not have permission to access this file');
                expect(getErrorCode(error)).toBe('PERMISSION_DENIED');
            });
            it('should detect not found errors', () => {
                const error = new Error('File not found in Drive');
                expect(getErrorCode(error)).toBe('FILE_NOT_FOUND');
            });
            it('should detect expired token errors', () => {
                const error = new Error('Token has expired');
                expect(getErrorCode(error)).toBe('TOKEN_EXPIRED');
            });
            it('should detect invalid request errors', () => {
                const error = new Error('Invalid file ID provided');
                expect(getErrorCode(error)).toBe('INVALID_REQUEST');
            });
            it('should return generic code for other errors', () => {
                const error = new Error('Something went wrong');
                expect(getErrorCode(error)).toBe('ACCESS_ERROR');
            });
            it('should handle unknown error types', () => {
                expect(getErrorCode(null)).toBe('UNKNOWN_ERROR');
                expect(getErrorCode(undefined)).toBe('UNKNOWN_ERROR');
                expect(getErrorCode(123)).toBe('UNKNOWN_ERROR');
            });
        });
        describe('getErrorMessage()', () => {
            it('should return string error as-is', () => {
                expect(getErrorMessage('Custom error message')).toBe('Custom error message');
            });
            it('should extract message from Error objects', () => {
                const error = new Error('Something went wrong');
                expect(getErrorMessage(error)).toBe('Something went wrong');
            });
            it('should return default message for unknown errors', () => {
                expect(getErrorMessage(null)).toBe('An unknown error occurred');
                expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
                expect(getErrorMessage(123)).toBe('An unknown error occurred');
            });
        });
    });
    describe('Logging with All Action Types', () => {
        const actions = [
            'read',
            'download',
            'thumbnail',
            'import',
            'list',
        ];
        actions.forEach((action) => {
            it(`should log ${action} action correctly`, async () => {
                await logDriveFileAccess({
                    action,
                    success: true,
                    userId: 123,
                    driveFileId: 'drive-file-123',
                });
                expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                    action,
                    success: true,
                }));
            });
        });
    });
    describe('Logging with All User Roles', () => {
        const roles = [
            UserRole.GUEST,
            UserRole.STANDARD,
            UserRole.EDITOR,
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        ];
        roles.forEach((role) => {
            it(`should log with ${role} role correctly`, async () => {
                await logDriveFileAccess({
                    action: 'read',
                    success: true,
                    userId: 123,
                    userRole: role,
                });
                expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                    userRole: role,
                }));
            });
        });
    });
    describe('Edge Cases and Error Resilience', () => {
        it('should handle validation errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            asMock(insertDriveFileAccessLogSchema.parse).mockImplementation(() => {
                throw new Error('Validation failed');
            });
            await logDriveFileAccess({
                action: 'read',
                success: true,
            });
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
        it('should handle database insertion errors gracefully', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            asMock(mockDb.values).mockRejectedValue(new Error('Database error'));
            await logDriveFileAccess({
                action: 'read',
                success: true,
            });
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to log Drive file access:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
        it('should handle very long error messages', async () => {
            const longMessage = 'Error: '.repeat(1000);
            await logFailedAccess({
                action: 'read',
                errorCode: 'ERROR',
                errorMessage: longMessage,
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                errorMessage: longMessage,
            }));
        });
        it('should handle special characters in metadata', async () => {
            await logDriveFileAccess({
                action: 'read',
                success: true,
                metadata: {
                    fileName: 'test<script>alert("xss")</script>.pdf',
                    specialChars: '特殊字符 🎉',
                },
            });
            expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
                metadata: expect.objectContaining({
                    fileName: 'test<script>alert("xss")</script>.pdf',
                    specialChars: '特殊字符 🎉',
                }),
            }));
        });
        it('should handle concurrent logging requests', async () => {
            const promises = Array.from({ length: 10 }, (_, i) => logDriveFileAccess({
                action: 'read',
                success: true,
                userId: i,
            }));
            await Promise.all(promises);
            expect(mockDb.insert).toHaveBeenCalledTimes(10);
        });
    });
});
