/**
 * Drive File Access Audit Logger
 *
 * This service handles logging of all Drive file access attempts for:
 * - Security monitoring
 * - Compliance requirements
 * - Access pattern analysis
 * - Permission violation detection
 *
 * @module drive-audit-logger
 */

import type { Request } from "express";
import { db } from "../db";
import {
  driveFileAccessLogs,
  type InsertDriveFileAccessLog,
  insertDriveFileAccessLogSchema,
  type UserRoleType,
} from "@shared/schema";

// ============================================================================
// Types
// ============================================================================

interface AuditLogContext {
  /** User ID performing the action */
  userId?: number;
  /** Asset ID being accessed */
  assetId?: number;
  /** Drive file ID */
  driveFileId?: string;
  /** Action being performed */
  action: "read" | "download" | "thumbnail" | "import" | "list";
  /** Whether the action succeeded */
  success: boolean;
  /** Error code if action failed */
  errorCode?: string;
  /** Error message if action failed */
  errorMessage?: string;
  /** User's role */
  userRole?: UserRoleType;
  /** Client ID */
  clientId?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

interface RequestContext {
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Logs a Drive file access attempt
 *
 * @param context - Audit log context with user, asset, and action information
 * @param request - Optional Express request object for IP and user agent
 * @returns The created audit log entry
 *
 * @example
 * ```typescript
 * await logDriveFileAccess({
 *   userId: 123,
 *   assetId: 456,
 *   driveFileId: "1a2b3c4d",
 *   action: "read",
 *   success: true,
 *   userRole: UserRole.STANDARD,
 *   clientId: 1
 * }, req);
 * ```
 */
export async function logDriveFileAccess(
  context: AuditLogContext,
  request?: Request
): Promise<void> {
  try {
    const requestContext = extractRequestContext(request);

    const logData: InsertDriveFileAccessLog = {
      userId: context.userId,
      assetId: context.assetId,
      driveFileId: context.driveFileId,
      action: context.action,
      success: context.success,
      errorCode: context.errorCode,
      errorMessage: context.errorMessage,
      userRole: context.userRole,
      clientId: context.clientId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      metadata: context.metadata,
    };

    // Validate and insert
    const validated = insertDriveFileAccessLogSchema.parse(logData);
    await db.insert(driveFileAccessLogs).values(validated);
  } catch (error) {
    // Don't throw errors from audit logging to avoid breaking the main flow
    console.error("Failed to log Drive file access:", error);
  }
}

/**
 * Logs a successful Drive file access
 *
 * @param context - Context with user, asset, and action details
 * @param request - Optional request object
 *
 * @example
 * ```typescript
 * await logSuccessfulAccess({
 *   userId: 123,
 *   assetId: 456,
 *   driveFileId: "1a2b3c4d",
 *   action: "download",
 *   userRole: UserRole.EDITOR,
 *   clientId: 1
 * }, req);
 * ```
 */
export async function logSuccessfulAccess(
  context: Omit<AuditLogContext, "success">,
  request?: Request
): Promise<void> {
  await logDriveFileAccess({ ...context, success: true }, request);
}

/**
 * Logs a failed Drive file access with error details
 *
 * @param context - Context with error information
 * @param request - Optional request object
 *
 * @example
 * ```typescript
 * await logFailedAccess({
 *   userId: 123,
 *   assetId: 456,
 *   driveFileId: "1a2b3c4d",
 *   action: "read",
 *   errorCode: "PERMISSION_DENIED",
 *   errorMessage: "Role standard can only read their own files",
 *   userRole: UserRole.STANDARD,
 *   clientId: 1
 * }, req);
 * ```
 */
export async function logFailedAccess(
  context: Omit<AuditLogContext, "success"> & {
    errorCode: string;
    errorMessage: string;
  },
  request?: Request
): Promise<void> {
  await logDriveFileAccess(
    {
      ...context,
      success: false,
      errorCode: context.errorCode,
      errorMessage: context.errorMessage,
    },
    request
  );
}

/**
 * Logs a permission denial for Drive file access
 *
 * @param userId - User ID attempting access
 * @param assetId - Asset ID being accessed
 * @param action - Action attempted
 * @param reason - Reason for denial
 * @param userRole - User's role
 * @param clientId - Client ID
 * @param request - Optional request object
 *
 * @example
 * ```typescript
 * await logPermissionDenied(
 *   123,
 *   456,
 *   "write",
 *   "Role standard can only edit their own files",
 *   UserRole.STANDARD,
 *   1,
 *   req
 * );
 * ```
 */
export async function logPermissionDenied(
  userId: number,
  assetId: number | undefined,
  action: AuditLogContext["action"],
  reason: string,
  userRole: UserRoleType,
  clientId: number | undefined,
  request?: Request
): Promise<void> {
  await logFailedAccess(
    {
      userId,
      assetId,
      action,
      errorCode: "PERMISSION_DENIED",
      errorMessage: reason,
      userRole,
      clientId,
    },
    request
  );
}

/**
 * Logs a Drive API error (file not found, access denied, etc.)
 *
 * @param userId - User ID attempting access
 * @param driveFileId - Drive file ID
 * @param action - Action attempted
 * @param errorCode - Error code from Drive API
 * @param errorMessage - Error message
 * @param request - Optional request object
 *
 * @example
 * ```typescript
 * await logDriveApiError(
 *   123,
 *   "1a2b3c4d",
 *   "read",
 *   "DRIVE_FILE_NOT_FOUND",
 *   "File not found in Google Drive",
 *   req
 * );
 * ```
 */
export async function logDriveApiError(
  userId: number | undefined,
  driveFileId: string,
  action: AuditLogContext["action"],
  errorCode: string,
  errorMessage: string,
  request?: Request
): Promise<void> {
  await logFailedAccess(
    {
      userId,
      driveFileId,
      action,
      errorCode,
      errorMessage,
    },
    request
  );
}

/**
 * Logs a Drive file import operation
 *
 * @param userId - User ID performing import
 * @param driveFileId - Drive file ID being imported
 * @param success - Whether import succeeded
 * @param assetId - Created asset ID (if successful)
 * @param userRole - User's role
 * @param clientId - Client ID
 * @param errorDetails - Error details if failed
 * @param request - Optional request object
 *
 * @example
 * ```typescript
 * await logFileImport(
 *   123,
 *   "1a2b3c4d",
 *   true,
 *   789,
 *   UserRole.EDITOR,
 *   1,
 *   undefined,
 *   req
 * );
 * ```
 */
export async function logFileImport(
  userId: number,
  driveFileId: string,
  success: boolean,
  assetId: number | undefined,
  userRole: UserRoleType,
  clientId: number,
  errorDetails?: { errorCode: string; errorMessage: string },
  request?: Request
): Promise<void> {
  await logDriveFileAccess(
    {
      userId,
      assetId,
      driveFileId,
      action: "import",
      success,
      errorCode: errorDetails?.errorCode,
      errorMessage: errorDetails?.errorMessage,
      userRole,
      clientId,
      metadata: {
        importedAt: new Date().toISOString(),
      },
    },
    request
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts request context (IP, user agent) from Express request
 *
 * @param request - Express request object
 * @returns Request context with IP and user agent
 */
function extractRequestContext(request?: Request): RequestContext {
  if (!request) {
    return {};
  }

  // Extract IP address (handle proxies)
  const ipAddress =
    (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (request.headers["x-real-ip"] as string) ||
    request.socket.remoteAddress ||
    undefined;

  // Extract user agent
  const userAgent = request.headers["user-agent"];

  return {
    ipAddress,
    userAgent,
  };
}

/**
 * Creates a standardized error code from an error message or type
 *
 * @param error - Error object or message
 * @returns Standardized error code
 */
export function getErrorCode(error: unknown): string {
  if (typeof error === "string") {
    return error.toUpperCase().replace(/\s+/g, "_");
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes("permission")) {
      return "PERMISSION_DENIED";
    }
    if (error.message.includes("not found")) {
      return "FILE_NOT_FOUND";
    }
    if (error.message.includes("expired")) {
      return "TOKEN_EXPIRED";
    }
    if (error.message.includes("invalid")) {
      return "INVALID_REQUEST";
    }

    // Generic error code
    return "ACCESS_ERROR";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Gets a user-friendly error message from an error
 *
 * @param error - Error object
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred";
}
