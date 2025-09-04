import type { Response } from "express";

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
  timestamp: string;
}

interface SendGridError {
  message?: string;
  field?: string;
}

interface SendGridErrorBody {
  errors?: SendGridError[];
}

interface SendGridResponse {
  body?: SendGridErrorBody;
  statusCode?: number;
}

interface SendGridErrorResponse {
  response?: SendGridResponse;
  code?: string | number;
}

interface NetworkError extends Error {
  code?: string;
}

// Type guard functions for safe property access
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function _hasStringProperty(
  obj: unknown,
  key: string
): obj is Record<string, string> {
  return isObject(obj) && typeof obj[key] === "string";
}

function _hasNumberProperty(
  obj: unknown,
  key: string
): obj is Record<string, number> {
  return isObject(obj) && typeof obj[key] === "number";
}

function _hasArrayProperty(
  obj: unknown,
  key: string
): obj is Record<string, unknown[]> {
  return isObject(obj) && Array.isArray(obj[key]);
}

function isSendGridErrorResponse(
  error: unknown
): error is SendGridErrorResponse {
  if (!isObject(error)) return false;

  if ("response" in error && error.response) {
    const response = error.response;
    return (
      isObject(response) && ("body" in response || "statusCode" in response)
    );
  }

  return "code" in error;
}

function isNetworkError(error: unknown): error is NetworkError {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
  );
}

function isSendGridErrorArray(errors: unknown): errors is SendGridError[] {
  if (!Array.isArray(errors)) return false;
  return errors.every(
    (error) =>
      isObject(error) &&
      (typeof error.message === "string" || error.message === undefined) &&
      (typeof error.field === "string" || error.field === undefined)
  );
}

/**
 * Standardized error response utility for consistent API error handling
 */
export function badRequest(
  res: Response,
  message: string,
  code?: string,
  details?: unknown
): Response {
  return res.status(400).json({
    error: {
      message,
      code,
      details,
    },
    timestamp: new Date().toISOString(),
  });
}

export function unauthorized(
  res: Response,
  message: string = "Unauthorized"
): Response {
  return res.status(401).json({
    error: {
      message,
    },
    timestamp: new Date().toISOString(),
  });
}

export function forbidden(
  res: Response,
  message: string = "Forbidden"
): Response {
  return res.status(403).json({
    error: {
      message,
    },
    timestamp: new Date().toISOString(),
  });
}

export function notFound(
  res: Response,
  message: string = "Not found"
): Response {
  return res.status(404).json({
    error: {
      message,
    },
    timestamp: new Date().toISOString(),
  });
}

export function conflict(
  res: Response,
  message: string,
  code?: string,
  details?: unknown
): Response {
  return res.status(409).json({
    error: {
      message,
      code,
      details,
    },
    timestamp: new Date().toISOString(),
  });
}

export function internalError(
  res: Response,
  message: string = "Internal server error"
): Response {
  return res.status(500).json({
    error: {
      message,
    },
    timestamp: new Date().toISOString(),
  });
}

export function validationError(
  res: Response,
  message: string,
  errors: unknown[]
): Response {
  return res.status(400).json({
    error: {
      message,
      code: "VALIDATION_ERROR",
      details: errors,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * User-friendly error messages for common error codes
 */
export const ERROR_MESSAGES = {
  EMAIL_EXISTS: "A user with this email address is already registered.",
  INVITATION_EXISTS: "This email address has already been invited.",
  INVITATION_NOT_FOUND: "The invitation link is invalid or has expired.",
  INVITATION_EXPIRED:
    "This invitation has expired. Please request a new invitation.",
  INVITATION_USED: "This invitation has already been used.",
  UNAUTHORIZED: "Please log in to access this resource.",
  FORBIDDEN: "You don't have permission to perform this action.",
  VALIDATION_ERROR: "Please check your input and try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again later.",

  // Email service errors
  EMAIL_SERVICE_FAILED:
    "Failed to send invitation email. The invitation was created but email delivery failed.",
  EMAIL_QUOTA_EXCEEDED:
    "Email sending quota exceeded. The invitation was created but the email could not be sent.",
  EMAIL_INVALID_CREDENTIALS:
    "Email service configuration error. The invitation was created but the email could not be sent.",
  EMAIL_INVALID_ADDRESS:
    "Invalid email address. Please check the email address and try again.",
  EMAIL_BLOCKED:
    "Email could not be sent to this address. The invitation was created but email delivery was blocked.",
  EMAIL_SERVICE_UNAVAILABLE:
    "Email service is temporarily unavailable. The invitation was created but the email could not be sent.",
} as const;

/**
 * Custom error class for email service failures
 */
export class EmailServiceError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = "EmailServiceError";
    this.code = code;
    this.details = details;
  }
}

/**
 * Parse SendGrid errors and return appropriate error message and code
 */
export function parseSendGridError(error: unknown): {
  message: string;
  code: string;
  details?: unknown;
} {
  console.error("Parsing SendGrid error:", error);

  // Check if it's a SendGrid API error with response body
  if (isSendGridErrorResponse(error)) {
    const response = error.response;

    if (response?.body) {
      const body = response.body;
      const statusCode = error.code || response.statusCode;

      console.error("SendGrid error body:", body);
      console.error("SendGrid status code:", statusCode);

      // Convert statusCode to number for comparison
      const numericStatusCode =
        typeof statusCode === "string" ? parseInt(statusCode, 10) : statusCode;

      // Handle specific SendGrid error codes
      if (
        numericStatusCode === 402 ||
        (body.errors &&
          isSendGridErrorArray(body.errors) &&
          body.errors.some(
            (e: SendGridError) =>
              e.message?.includes("quota") || e.message?.includes("credits")
          ))
      ) {
        return {
          message: ERROR_MESSAGES.EMAIL_QUOTA_EXCEEDED,
          code: "EMAIL_QUOTA_EXCEEDED",
          details: { sendGridError: body },
        };
      }

      if (numericStatusCode === 401 || numericStatusCode === 403) {
        return {
          message: ERROR_MESSAGES.EMAIL_INVALID_CREDENTIALS,
          code: "EMAIL_INVALID_CREDENTIALS",
          details: { sendGridError: body },
        };
      }

      if (
        numericStatusCode === 400 &&
        body.errors &&
        isSendGridErrorArray(body.errors)
      ) {
        const hasInvalidEmail = body.errors.some(
          (e: SendGridError) =>
            e.field === "to" ||
            e.message?.includes("email") ||
            e.message?.includes("invalid")
        );

        if (hasInvalidEmail) {
          return {
            message: ERROR_MESSAGES.EMAIL_INVALID_ADDRESS,
            code: "EMAIL_INVALID_ADDRESS",
            details: { sendGridError: body },
          };
        }
      }

      if (typeof numericStatusCode === "number" && numericStatusCode >= 500) {
        return {
          message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
          code: "EMAIL_SERVICE_UNAVAILABLE",
          details: { sendGridError: body },
        };
      }

      // Extract first error message if available
      if (
        body.errors &&
        isSendGridErrorArray(body.errors) &&
        body.errors.length > 0
      ) {
        const firstError = body.errors[0];
        return {
          message: `${ERROR_MESSAGES.EMAIL_SERVICE_FAILED} (${firstError.message || "Unknown error"})`,
          code: "EMAIL_SERVICE_FAILED",
          details: { sendGridError: body },
        };
      }
    }
  }

  // Handle network errors or other issues
  if (isNetworkError(error)) {
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      return {
        message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
        code: "EMAIL_SERVICE_UNAVAILABLE",
        details: { originalError: error.message },
      };
    }
  }

  // Generic fallback
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    message: ERROR_MESSAGES.EMAIL_SERVICE_FAILED,
    code: "EMAIL_SERVICE_FAILED",
    details: {
      originalError: errorMessage,
    },
  };
}
