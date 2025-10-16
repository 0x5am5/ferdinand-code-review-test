/**
 * Drive Error Handler
 *
 * Centralized error handling for Drive file operations with clear,
 * actionable error messages and consistent error codes.
 *
 * Supports:
 * - Google Drive API v3 error parsing
 * - Automatic token refresh detection
 * - Exponential backoff retry logic
 * - Rate limit handling with Retry-After headers
 * - RFC 9457 Problem Details for HTTP APIs
 *
 * @module drive-error-handler
 */

import type { Response } from "express";
import type { GaxiosError } from "gaxios";

// ============================================================================
// Error Types and Codes
// ============================================================================

/**
 * Standard error codes for Drive operations
 * Following RFC 9457 Problem Details for HTTP APIs
 */
export const DriveErrorCode = {
  // Permission errors (403)
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DRIVE_PERMISSION_DENIED: "DRIVE_PERMISSION_DENIED",
  TOKEN_FILE_MISMATCH: "TOKEN_FILE_MISMATCH",
  ACTION_NOT_PERMITTED: "ACTION_NOT_PERMITTED",
  PERMISSION_REVOKED: "PERMISSION_REVOKED",
  ROLE_INSUFFICIENT: "ROLE_INSUFFICIENT",
  INSUFFICIENT_SCOPES: "INSUFFICIENT_SCOPES",

  // Authentication errors (401)
  UNAUTHORIZED: "UNAUTHORIZED",
  DRIVE_AUTH_REQUIRED: "DRIVE_AUTH_REQUIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",

  // File errors (404)
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  ASSET_NOT_FOUND: "ASSET_NOT_FOUND",
  DRIVE_FILE_NOT_FOUND: "DRIVE_FILE_NOT_FOUND",
  DRIVE_ACCESS_DENIED: "DRIVE_ACCESS_DENIED",
  NO_THUMBNAIL: "NO_THUMBNAIL",
  FOLDER_NOT_FOUND: "FOLDER_NOT_FOUND",

  // Validation errors (400)
  MISSING_FILE_ID: "MISSING_FILE_ID",
  INVALID_FILE_ID: "INVALID_FILE_ID",
  MISSING_TOKEN: "MISSING_TOKEN",
  INVALID_SIZE: "INVALID_SIZE",
  INVALID_REQUEST: "INVALID_REQUEST",

  // Rate limiting errors (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  USER_RATE_LIMIT_EXCEEDED: "USER_RATE_LIMIT_EXCEEDED",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED",

  // Server errors (5xx)
  DRIVE_CONNECTION_NOT_FOUND: "DRIVE_CONNECTION_NOT_FOUND",
  NO_ACCESS_TOKEN: "NO_ACCESS_TOKEN",
  FILE_ACCESS_ERROR: "FILE_ACCESS_ERROR",
  THUMBNAIL_FETCH_ERROR: "THUMBNAIL_FETCH_ERROR",
  DRIVE_API_ERROR: "DRIVE_API_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  BACKEND_ERROR: "BACKEND_ERROR",

  // Special errors
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  SHARED_DRIVE_ERROR: "SHARED_DRIVE_ERROR",
  EXPORT_FORMAT_ERROR: "EXPORT_FORMAT_ERROR",
} as const;

export type DriveErrorCodeType =
  (typeof DriveErrorCode)[keyof typeof DriveErrorCode];

// ============================================================================
// Parsed Drive Error Interface
// ============================================================================

/**
 * Parsed error from Google Drive API with metadata for retry logic
 */
export interface ParsedDriveError {
  statusCode: number;
  code: DriveErrorCodeType;
  message: string;
  originalError?: unknown;
  retryable: boolean;
  requiresTokenRefresh: boolean;
  retryAfter?: number;
  reason?: string;
  domain?: string;
}

// ============================================================================
// Error Message Templates
// ============================================================================

/**
 * User-friendly error messages with actionable guidance
 */
const ERROR_MESSAGES: Record<DriveErrorCodeType, string> = {
  // Permission errors
  PERMISSION_DENIED:
    "You don't have permission to access this file. Contact your administrator for access.",
  DRIVE_PERMISSION_DENIED:
    "You don't have permission to access this Drive file.",
  TOKEN_FILE_MISMATCH: "This access token is not valid for the requested file.",
  ACTION_NOT_PERMITTED:
    "This token only allows specific actions. The requested action is not permitted.",
  PERMISSION_REVOKED: "You no longer have permission to access this file.",
  ROLE_INSUFFICIENT:
    "Your role does not have sufficient permissions for this action.",
  INSUFFICIENT_SCOPES:
    "Your Google Drive connection does not have the required permissions. Please reconnect.",

  // Authentication errors
  UNAUTHORIZED: "Authentication required. Please sign in to view this file.",
  DRIVE_AUTH_REQUIRED:
    "Google Drive authentication required. Please connect your Google Drive account.",
  INVALID_TOKEN:
    "Your access link has expired or is invalid. Please request a new link.",
  TOKEN_EXPIRED: "Your access link has expired. Please request a new link.",
  TOKEN_REVOKED: "Your access has been revoked. Please request a new link.",
  TOKEN_REFRESH_FAILED:
    "Your Google Drive session has expired. Please reconnect your Drive account.",

  // File errors
  FILE_NOT_FOUND: "File not found. It may have been deleted.",
  ASSET_NOT_FOUND:
    "Asset not found. The file may have been deleted or you don't have access.",
  DRIVE_FILE_NOT_FOUND:
    "File not found in Google Drive. It may have been deleted or moved.",
  DRIVE_ACCESS_DENIED:
    "Access denied by Google Drive. You may no longer have permission to this file.",
  NO_THUMBNAIL: "No thumbnail available for this file type",
  FOLDER_NOT_FOUND:
    "Folder not found in Google Drive. It may have been deleted or moved.",

  // Validation errors
  MISSING_FILE_ID: "File ID is required in the request",
  INVALID_FILE_ID:
    "Invalid Drive file ID format. The file ID contains invalid characters.",
  MISSING_TOKEN: "Access token is required. Please request a new secure URL.",
  INVALID_SIZE: "Invalid thumbnail size. Must be 'small', 'medium', or 'large'",
  INVALID_REQUEST: "Invalid request to Google Drive API",

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED:
    "Too many requests to Google Drive. Please try again later.",
  USER_RATE_LIMIT_EXCEEDED:
    "You have exceeded your Google Drive request limit. Please try again later.",
  QUOTA_EXCEEDED: "Daily API quota exceeded. Please try again tomorrow.",
  STORAGE_QUOTA_EXCEEDED: "Storage quota exceeded in Google Drive.",

  // System errors
  DRIVE_CONNECTION_NOT_FOUND:
    "Google Drive connection not found. Please reconnect your Drive account.",
  NO_ACCESS_TOKEN:
    "Unable to obtain Drive access token. Please reconnect your Drive account.",
  FILE_ACCESS_ERROR:
    "Failed to access Drive file. Please try again later or request a new link.",
  THUMBNAIL_FETCH_ERROR: "Failed to fetch thumbnail. Please try again later.",
  DRIVE_API_ERROR: "Google Drive API error. Please try again later.",
  SERVICE_UNAVAILABLE:
    "Google Drive service is temporarily unavailable. Please try again later.",
  TIMEOUT: "Request to Google Drive timed out. Please try again.",
  BACKEND_ERROR: "An unexpected error occurred. Please try again later.",

  // Special errors
  FILE_TOO_LARGE: "File is too large to process.",
  SHARED_DRIVE_ERROR:
    "Error accessing shared Drive. You may not have permission.",
  EXPORT_FORMAT_ERROR: "Unable to export file in the requested format.",
};

// ============================================================================
// Google API Error Parsing
// ============================================================================

/**
 * Type guard for GaxiosError (from googleapis)
 */
function isGaxiosError(error: unknown): error is GaxiosError {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    "config" in error
  );
}

/**
 * Extract error details from Google API error response
 */
function extractGoogleApiError(error: GaxiosError): {
  reason?: string;
  domain?: string;
  message?: string;
} {
  const errorData = error.response?.data as Record<string, unknown> | undefined;

  if (errorData?.error) {
    const errorObj = errorData.error as Record<string, unknown>;

    // Check for errors array (standard Google API error format)
    if (Array.isArray(errorObj.errors) && errorObj.errors.length > 0) {
      const firstError = errorObj.errors[0] as Record<string, unknown>;
      return {
        reason: firstError.reason as string | undefined,
        domain: firstError.domain as string | undefined,
        message:
          (errorObj.message as string) ||
          (firstError.message as string | undefined),
      };
    }

    // Check for direct error properties
    return {
      message: errorObj.message as string | undefined,
      reason: errorObj.reason as string | undefined,
      domain: errorObj.domain as string | undefined,
    };
  }

  return {
    message: error.message,
  };
}

/**
 * Parse Google Drive API errors into standardized format
 * Handles all HTTP status codes and Google-specific error reasons
 */
export function parseDriveError(error: unknown): ParsedDriveError {
  // Handle GaxiosError (Google API errors)
  if (isGaxiosError(error)) {
    const statusCode = error.response?.status || 500;
    const errorDetails = extractGoogleApiError(error);
    const reason = errorDetails.reason?.toLowerCase() || "";

    // 401 Unauthorized - Token issues
    if (statusCode === 401) {
      if (
        errorDetails.message?.toLowerCase().includes("invalid") ||
        reason.includes("invalid")
      ) {
        return {
          statusCode: 401,
          code: DriveErrorCode.INVALID_TOKEN,
          message: "Invalid authentication credentials",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: true,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      if (reason.includes("revoked")) {
        return {
          statusCode: 401,
          code: DriveErrorCode.TOKEN_REVOKED,
          message: "Authentication token has been revoked",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: true,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      return {
        statusCode: 401,
        code: DriveErrorCode.TOKEN_EXPIRED,
        message: "Authentication token has expired",
        originalError: error,
        retryable: true,
        requiresTokenRefresh: true,
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }

    // 403 Forbidden - Permission and quota issues
    if (statusCode === 403) {
      // Rate limiting
      if (reason.includes("ratelimit") || reason === "usageratelimitexceeded") {
        return {
          statusCode: 403,
          code: DriveErrorCode.USER_RATE_LIMIT_EXCEEDED,
          message: "User rate limit exceeded. Please try again later.",
          originalError: error,
          retryable: true,
          requiresTokenRefresh: false,
          retryAfter: 60, // Default 60 seconds
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      // Daily quota exceeded
      if (
        reason.includes("dailylimitexceeded") ||
        reason.includes("quotaexceeded")
      ) {
        return {
          statusCode: 403,
          code: DriveErrorCode.QUOTA_EXCEEDED,
          message: "Daily API quota exceeded",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: false,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      // Storage quota
      if (reason.includes("storagequota")) {
        return {
          statusCode: 403,
          code: DriveErrorCode.STORAGE_QUOTA_EXCEEDED,
          message: "Storage quota exceeded",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: false,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      // Insufficient permissions
      if (
        reason.includes("insufficientpermissions") ||
        reason.includes("forbidden")
      ) {
        return {
          statusCode: 403,
          code: DriveErrorCode.PERMISSION_DENIED,
          message: "You don't have permission to access this file",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: false,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      // Insufficient scopes
      if (reason.includes("insufficientscopes") || reason.includes("scope")) {
        return {
          statusCode: 403,
          code: DriveErrorCode.INSUFFICIENT_SCOPES,
          message: "Insufficient OAuth scopes for this operation",
          originalError: error,
          retryable: false,
          requiresTokenRefresh: false,
          reason: errorDetails.reason,
          domain: errorDetails.domain,
        };
      }

      return {
        statusCode: 403,
        code: DriveErrorCode.PERMISSION_DENIED,
        message: errorDetails.message || "Access denied",
        originalError: error,
        retryable: false,
        requiresTokenRefresh: false,
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }

    // 404 Not Found
    if (statusCode === 404) {
      return {
        statusCode: 404,
        code: DriveErrorCode.FILE_NOT_FOUND,
        message: "File not found in Google Drive",
        originalError: error,
        retryable: false,
        requiresTokenRefresh: false,
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }

    // 429 Too Many Requests
    if (statusCode === 429) {
      const retryAfter = parseInt(
        (error.response?.headers?.["retry-after"] as string) || "60",
        10
      );

      return {
        statusCode: 429,
        code: DriveErrorCode.RATE_LIMIT_EXCEEDED,
        message: "Rate limit exceeded. Please try again later.",
        originalError: error,
        retryable: true,
        requiresTokenRefresh: false,
        retryAfter,
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }

    // 500+ Server Errors
    if (statusCode >= 500) {
      const retryableServerErrors = [500, 502, 503, 504];

      return {
        statusCode,
        code:
          statusCode === 503
            ? DriveErrorCode.SERVICE_UNAVAILABLE
            : DriveErrorCode.DRIVE_API_ERROR,
        message: "Google Drive service temporarily unavailable",
        originalError: error,
        retryable: retryableServerErrors.includes(statusCode),
        requiresTokenRefresh: false,
        retryAfter: 30, // Default 30 seconds for server errors
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }

    // Other 4xx errors
    if (statusCode >= 400 && statusCode < 500) {
      return {
        statusCode,
        code: DriveErrorCode.INVALID_REQUEST,
        message: errorDetails.message || "Invalid request to Google Drive API",
        originalError: error,
        retryable: false,
        requiresTokenRefresh: false,
        reason: errorDetails.reason,
        domain: errorDetails.domain,
      };
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    if (
      error.message.includes("timeout") ||
      error.message.includes("ETIMEDOUT")
    ) {
      return {
        statusCode: 504,
        code: DriveErrorCode.TIMEOUT,
        message: "Request to Google Drive timed out",
        originalError: error,
        retryable: true,
        requiresTokenRefresh: false,
        retryAfter: 30,
      };
    }

    return {
      statusCode: 500,
      code: DriveErrorCode.BACKEND_ERROR,
      message: error.message || "An unexpected error occurred",
      originalError: error,
      retryable: false,
      requiresTokenRefresh: false,
    };
  }

  // Unknown error type
  return {
    statusCode: 500,
    code: DriveErrorCode.BACKEND_ERROR,
    message: "An unexpected error occurred",
    originalError: error,
    retryable: false,
    requiresTokenRefresh: false,
  };
}

// ============================================================================
// Exponential Backoff and Retry Logic
// ============================================================================

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Current retry attempt (0-based)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000
): number {
  const maxDelay = 60000; // 60 seconds max
  const delay = Math.min(baseDelay * 2 ** attempt, maxDelay);
  // Add jitter (0-1000ms) to prevent thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Wrapper for Drive API calls with automatic retry and error handling
 * Implements exponential backoff, token refresh, and rate limit handling
 *
 * @param operation - Async operation to execute
 * @param options - Configuration options
 * @returns Result of the operation
 */
export async function withDriveErrorHandling<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    shouldRetry?: (error: ParsedDriveError) => boolean;
    onRetry?: (
      attempt: number,
      error: ParsedDriveError
    ) => void | Promise<void>;
    onTokenRefreshNeeded?: () => Promise<void>;
    context?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    shouldRetry = (error) => error.retryable,
    onRetry,
    onTokenRefreshNeeded,
    context,
  } = options;

  let lastError: ParsedDriveError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = parseDriveError(error);

      // Log the error
      console.error(`Drive API Error${context ? ` [${context}]` : ""}:`, {
        code: lastError.code,
        statusCode: lastError.statusCode,
        message: lastError.message,
        attempt: attempt + 1,
        maxRetries,
        retryable: lastError.retryable,
        requiresTokenRefresh: lastError.requiresTokenRefresh,
      });

      // If token refresh is needed and handler is provided
      if (lastError.requiresTokenRefresh && onTokenRefreshNeeded) {
        try {
          console.log("Attempting to refresh token...");
          await onTokenRefreshNeeded();
          console.log("Token refreshed successfully, retrying operation...");
          // Retry immediately after token refresh without counting against maxRetries
          continue;
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          // Return original error wrapped in refresh failed error
          throw new Error(`Token refresh failed: ${lastError.message}`);
        }
      }

      // Check if we should retry
      if (attempt < maxRetries && shouldRetry(lastError)) {
        const backoffDelay = lastError.retryAfter
          ? lastError.retryAfter * 1000
          : calculateBackoff(attempt);

        console.log(
          `Retrying Drive API call in ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})${context ? ` [${context}]` : ""}`
        );

        if (onRetry) {
          await onRetry(attempt + 1, lastError);
        }

        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      // No more retries, throw the error
      throw error;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError?.originalError || new Error("Unknown error");
}

// ============================================================================
// Error Response Builder
// ============================================================================

/**
 * Builds a standardized error response object
 */
export interface DriveErrorResponse {
  message: string;
  code: DriveErrorCodeType;
  details?: string;
  allowedAction?: string;
  requestedAction?: string;
  requiredPermission?: string;
}

/**
 * Creates a standardized error response
 *
 * @param code - Error code
 * @param customMessage - Optional custom message to override default
 * @param details - Optional additional details
 * @param metadata - Optional metadata (allowed action, etc.)
 * @returns Error response object
 */
export function createErrorResponse(
  code: DriveErrorCodeType,
  customMessage?: string,
  details?: string,
  metadata?: {
    allowedAction?: string;
    requestedAction?: string;
    requiredPermission?: string;
  }
): DriveErrorResponse {
  const response: DriveErrorResponse = {
    message: customMessage || ERROR_MESSAGES[code],
    code,
  };

  if (details) {
    response.details = details;
  }

  if (metadata?.allowedAction) {
    response.allowedAction = metadata.allowedAction;
  }

  if (metadata?.requestedAction) {
    response.requestedAction = metadata.requestedAction;
  }

  if (metadata?.requiredPermission) {
    response.requiredPermission = metadata.requiredPermission;
  }

  return response;
}

// ============================================================================
// Error Handlers for Common Scenarios
// ============================================================================

/**
 * Handles permission denied errors
 *
 * @param res - Express response object
 * @param reason - Optional custom reason
 * @param requiredPermission - Optional permission that was required
 */
export function handlePermissionDenied(
  res: Response,
  reason?: string,
  requiredPermission?: string
): Response {
  return res.status(403).json(
    createErrorResponse(DriveErrorCode.PERMISSION_DENIED, reason, undefined, {
      requiredPermission,
    })
  );
}

/**
 * Handles Drive-specific permission errors
 *
 * @param res - Express response object
 * @param reason - Optional custom reason
 */
export function handleDrivePermissionDenied(
  res: Response,
  reason?: string
): Response {
  return res
    .status(403)
    .json(createErrorResponse(DriveErrorCode.DRIVE_PERMISSION_DENIED, reason));
}

/**
 * Handles authentication errors
 *
 * @param res - Express response object
 * @param code - Specific auth error code
 * @param customMessage - Optional custom message
 */
export function handleAuthError(
  res: Response,
  code:
    | typeof DriveErrorCode.UNAUTHORIZED
    | typeof DriveErrorCode.DRIVE_AUTH_REQUIRED
    | typeof DriveErrorCode.INVALID_TOKEN
    | typeof DriveErrorCode.TOKEN_EXPIRED
    | typeof DriveErrorCode.TOKEN_REFRESH_FAILED
    | typeof DriveErrorCode.TOKEN_FILE_MISMATCH
    | typeof DriveErrorCode.ACTION_NOT_PERMITTED,
  customMessage?: string
): Response {
  return res.status(401).json(createErrorResponse(code, customMessage));
}

/**
 * Handles file not found errors
 *
 * @param res - Express response object
 * @param code - Specific file not found code
 * @param customMessage - Optional custom message
 */
export function handleFileNotFound(
  res: Response,
  code:
    | typeof DriveErrorCode.FILE_NOT_FOUND
    | typeof DriveErrorCode.ASSET_NOT_FOUND
    | typeof DriveErrorCode.DRIVE_FILE_NOT_FOUND,
  customMessage?: string
): Response {
  return res.status(404).json(createErrorResponse(code, customMessage));
}

/**
 * Handles validation errors
 *
 * @param res - Express response object
 * @param code - Specific validation error code
 * @param customMessage - Optional custom message
 */
export function handleValidationError(
  res: Response,
  code:
    | typeof DriveErrorCode.MISSING_FILE_ID
    | typeof DriveErrorCode.INVALID_FILE_ID
    | typeof DriveErrorCode.MISSING_TOKEN
    | typeof DriveErrorCode.INVALID_SIZE,
  customMessage?: string
): Response {
  return res.status(400).json(createErrorResponse(code, customMessage));
}

/**
 * Handles Drive API errors
 *
 * @param res - Express response object
 * @param statusCode - HTTP status code from Drive API
 * @param error - Error details
 */
export function handleDriveApiError(
  res: Response,
  statusCode: number,
  error?: Error
): Response {
  let code: DriveErrorCodeType;
  let message: string | undefined;

  switch (statusCode) {
    case 404:
      code = DriveErrorCode.DRIVE_FILE_NOT_FOUND;
      break;
    case 403:
      code = DriveErrorCode.DRIVE_ACCESS_DENIED;
      break;
    case 401:
      code = DriveErrorCode.TOKEN_EXPIRED;
      break;
    default:
      code = DriveErrorCode.FILE_ACCESS_ERROR;
      message = error?.message;
  }

  return res.status(statusCode).json(createErrorResponse(code, message));
}

/**
 * Handles generic system errors
 *
 * @param res - Express response object
 * @param error - Error object
 * @param code - Optional specific error code
 */
export function handleSystemError(
  res: Response,
  error: Error,
  code: DriveErrorCodeType = DriveErrorCode.FILE_ACCESS_ERROR
): Response {
  console.error("Drive system error:", error);
  return res
    .status(500)
    .json(createErrorResponse(code, undefined, error.message));
}

// ============================================================================
// Error Detection Utilities
// ============================================================================

/**
 * Checks if an error is a permission error
 *
 * @param error - Error object or message
 * @returns True if error is permission-related
 */
export function isPermissionError(error: unknown): boolean {
  if (typeof error === "string") {
    return (
      error.toLowerCase().includes("permission") ||
      error.toLowerCase().includes("unauthorized") ||
      error.toLowerCase().includes("forbidden")
    );
  }

  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("permission") ||
      error.message.toLowerCase().includes("unauthorized") ||
      error.message.toLowerCase().includes("forbidden")
    );
  }

  return false;
}

/**
 * Checks if an error is a not found error
 *
 * @param error - Error object or message
 * @returns True if error is not found related
 */
export function isNotFoundError(error: unknown): boolean {
  if (typeof error === "string") {
    return error.toLowerCase().includes("not found");
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes("not found");
  }

  return false;
}

/**
 * Checks if an error is an authentication error
 *
 * @param error - Error object or message
 * @returns True if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  if (typeof error === "string") {
    return (
      error.toLowerCase().includes("expired") ||
      error.toLowerCase().includes("invalid token") ||
      error.toLowerCase().includes("authentication")
    );
  }

  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("expired") ||
      error.message.toLowerCase().includes("invalid token") ||
      error.message.toLowerCase().includes("authentication")
    );
  }

  return false;
}
