/**
 * Standardized error response utility for consistent API error handling
 */
export function badRequest(res, message, code, details) {
    return res.status(400).json({
        error: {
            message,
            code,
            details,
        },
        timestamp: new Date().toISOString(),
    });
}
export function unauthorized(res, message = "Unauthorized") {
    return res.status(401).json({
        error: {
            message,
        },
        timestamp: new Date().toISOString(),
    });
}
export function forbidden(res, message = "Forbidden") {
    return res.status(403).json({
        error: {
            message,
        },
        timestamp: new Date().toISOString(),
    });
}
export function notFound(res, message = "Not found") {
    return res.status(404).json({
        error: {
            message,
        },
        timestamp: new Date().toISOString(),
    });
}
export function conflict(res, message, code, details) {
    return res.status(409).json({
        error: {
            message,
            code,
            details,
        },
        timestamp: new Date().toISOString(),
    });
}
export function internalError(res, message = "Internal server error") {
    return res.status(500).json({
        error: {
            message,
        },
        timestamp: new Date().toISOString(),
    });
}
export function validationError(res, message, errors) {
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
 * Legacy compatibility - keeping ErrorResponse as an object with function references
 * @deprecated Use individual functions instead
 */
export const ErrorResponse = {
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    internalError,
    validationError,
};
/**
 * User-friendly error messages for common error codes
 */
export const ERROR_MESSAGES = {
    EMAIL_EXISTS: "A user with this email address is already registered.",
    INVITATION_EXISTS: "This email address has already been invited.",
    INVITATION_NOT_FOUND: "The invitation link is invalid or has expired.",
    INVITATION_EXPIRED: "This invitation has expired. Please request a new invitation.",
    INVITATION_USED: "This invitation has already been used.",
    UNAUTHORIZED: "Please log in to access this resource.",
    FORBIDDEN: "You don't have permission to perform this action.",
    VALIDATION_ERROR: "Please check your input and try again.",
    INTERNAL_ERROR: "Something went wrong. Please try again later.",
    // Email service errors
    EMAIL_SERVICE_FAILED: "Failed to send invitation email. The invitation was created but email delivery failed.",
    EMAIL_QUOTA_EXCEEDED: "Email sending quota exceeded. The invitation was created but the email could not be sent.",
    EMAIL_INVALID_CREDENTIALS: "Email service configuration error. The invitation was created but the email could not be sent.",
    EMAIL_INVALID_ADDRESS: "Invalid email address. Please check the email address and try again.",
    EMAIL_BLOCKED: "Email could not be sent to this address. The invitation was created but email delivery was blocked.",
    EMAIL_SERVICE_UNAVAILABLE: "Email service is temporarily unavailable. The invitation was created but the email could not be sent.",
};
/**
 * Custom error class for email service failures
 */
export class EmailServiceError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.name = "EmailServiceError";
        this.code = code;
        this.details = details;
    }
}
/**
 * Parse Postmark errors and return appropriate error message and code
 */
export function parsePostmarkError(error) {
    console.error("Parsing Postmark error:", error);
    // Handle network errors first (before checking for numeric status codes)
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
        return {
            message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
            code: "EMAIL_SERVICE_UNAVAILABLE",
            details: { originalError: error.message },
        };
    }
    // Check if it's a Postmark API error with numeric status code
    const statusCode = error.statusCode || (typeof error.code === "number" ? error.code : null);
    if (statusCode) {
        const errorMessage = error.message || error.body?.Message;
        console.error("Postmark error code:", statusCode);
        console.error("Postmark error message:", errorMessage);
        // Handle specific Postmark error codes
        if (statusCode === 422) {
            if (errorMessage?.includes("email") ||
                errorMessage?.includes("invalid")) {
                return {
                    message: ERROR_MESSAGES.EMAIL_INVALID_ADDRESS,
                    code: "EMAIL_INVALID_ADDRESS",
                    details: { statusCode, message: errorMessage },
                };
            }
        }
        if (statusCode === 401 || statusCode === 403) {
            return {
                message: ERROR_MESSAGES.EMAIL_INVALID_CREDENTIALS,
                code: "EMAIL_INVALID_CREDENTIALS",
                details: { statusCode, message: errorMessage },
            };
        }
        if (statusCode === 429) {
            return {
                message: ERROR_MESSAGES.EMAIL_QUOTA_EXCEEDED,
                code: "EMAIL_QUOTA_EXCEEDED",
                details: { statusCode, message: errorMessage },
            };
        }
        if (statusCode >= 500) {
            return {
                message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
                code: "EMAIL_SERVICE_UNAVAILABLE",
                details: { statusCode, message: errorMessage },
            };
        }
        // Generic error with message
        if (errorMessage) {
            return {
                message: `${ERROR_MESSAGES.EMAIL_SERVICE_FAILED} (${errorMessage})`,
                code: "EMAIL_SERVICE_FAILED",
                details: { statusCode, message: errorMessage },
            };
        }
    }
    // Generic fallback
    return {
        message: ERROR_MESSAGES.EMAIL_SERVICE_FAILED,
        code: "EMAIL_SERVICE_FAILED",
        details: { originalError: error.message || error.toString() },
    };
}
/**
 * Parse SendGrid errors and return appropriate error message and code
 */
export function parseSendGridError(error) {
    console.error("Parsing SendGrid error:", error);
    // Check if it's a SendGrid API error with response body
    if (error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "body" in error.response) {
        const body = error.response.body;
        const statusCode = ("code" in error ? error.code : null) ||
            (error.response &&
                typeof error.response === "object" &&
                "statusCode" in error.response
                ? error.response.statusCode
                : null);
        console.error("SendGrid error body:", body);
        console.error("SendGrid status code:", statusCode);
        // Handle specific SendGrid error codes
        if ((typeof statusCode === "number" && statusCode === 402) ||
            (body &&
                typeof body === "object" &&
                "errors" in body &&
                Array.isArray(body.errors) &&
                body.errors.some((e) => e &&
                    typeof e === "object" &&
                    "message" in e &&
                    typeof e.message === "string" &&
                    (e.message.includes("quota") || e.message.includes("credits"))))) {
            return {
                message: ERROR_MESSAGES.EMAIL_QUOTA_EXCEEDED,
                code: "EMAIL_QUOTA_EXCEEDED",
                details: { sendGridError: body },
            };
        }
        if (typeof statusCode === "number" &&
            (statusCode === 401 || statusCode === 403)) {
            return {
                message: ERROR_MESSAGES.EMAIL_INVALID_CREDENTIALS,
                code: "EMAIL_INVALID_CREDENTIALS",
                details: { sendGridError: body },
            };
        }
        if (typeof statusCode === "number" &&
            statusCode === 400 &&
            body &&
            typeof body === "object" &&
            "errors" in body &&
            Array.isArray(body.errors)) {
            const hasInvalidEmail = body.errors.some((e) => e &&
                typeof e === "object" &&
                (("field" in e && e.field === "to") ||
                    ("message" in e &&
                        typeof e.message === "string" &&
                        (e.message.includes("email") || e.message.includes("invalid")))));
            if (hasInvalidEmail) {
                return {
                    message: ERROR_MESSAGES.EMAIL_INVALID_ADDRESS,
                    code: "EMAIL_INVALID_ADDRESS",
                    details: { sendGridError: body },
                };
            }
        }
        if (typeof statusCode === "number" && statusCode >= 500) {
            return {
                message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
                code: "EMAIL_SERVICE_UNAVAILABLE",
                details: { sendGridError: body },
            };
        }
        // Extract first error message if available
        if (body &&
            typeof body === "object" &&
            "errors" in body &&
            Array.isArray(body.errors) &&
            body.errors.length > 0) {
            const firstError = body.errors[0] instanceof Error ? body.errors[0] : body.errors[0];
            return {
                message: `${ERROR_MESSAGES.EMAIL_SERVICE_FAILED} (${firstError.message})`,
                code: "EMAIL_SERVICE_FAILED",
                details: { sendGridError: body },
            };
        }
    }
    // Handle network errors or other issues
    if (error &&
        typeof error === "object" &&
        "code" in error &&
        (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED")) {
        return {
            message: ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE,
            code: "EMAIL_SERVICE_UNAVAILABLE",
            details: {
                originalError: error && typeof error === "object" && "message" in error
                    ? error.message
                    : "Network error",
            },
        };
    }
    // Generic fallback
    return {
        message: ERROR_MESSAGES.EMAIL_SERVICE_FAILED,
        code: "EMAIL_SERVICE_FAILED",
        details: {
            originalError: error && typeof error === "object" && "message" in error
                ? error.message
                : typeof error === "string"
                    ? error
                    : "Unknown error",
        },
    };
}
