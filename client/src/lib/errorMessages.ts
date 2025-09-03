/**
 * User-friendly error messages for common error codes
 */
export const ERROR_MESSAGES = {
  EMAIL_EXISTS: "This email address is already registered. Please try a different email address.",
  INVITATION_EXISTS: "This person has already been invited. You can resend the invitation if needed.",
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
  EMAIL_SERVICE_UNAVAILABLE: "Email service is temporarily unavailable. The invitation was created but the email could not be sent."
} as const;

/**
 * Extracts user-friendly error message from error response
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  const message = error.message;
  
  // Check if the error message matches one of our known error messages
  // (these would come from the backend ERROR_MESSAGES)
  if (Object.values(ERROR_MESSAGES).includes(message as typeof ERROR_MESSAGES[keyof typeof ERROR_MESSAGES])) {
    return message;
  }
  
  // Check if it contains known error codes and return friendly messages
  if (message.includes('EMAIL_EXISTS') || message.includes('email already exists')) {
    return ERROR_MESSAGES.EMAIL_EXISTS;
  }
  
  if (message.includes('INVITATION_EXISTS') || message.includes('invitation with this email already exists')) {
    return ERROR_MESSAGES.INVITATION_EXISTS;
  }
  
  if (message.includes('INVITATION_NOT_FOUND') || message.includes('invitation not found')) {
    return ERROR_MESSAGES.INVITATION_NOT_FOUND;
  }
  
  if (message.includes('INVITATION_EXPIRED') || message.includes('invitation has expired')) {
    return ERROR_MESSAGES.INVITATION_EXPIRED;
  }
  
  if (message.includes('INVITATION_USED') || message.includes('already been used')) {
    return ERROR_MESSAGES.INVITATION_USED;
  }
  
  if (message.includes('UNAUTHORIZED') || message.includes('unauthorized')) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  
  if (message.includes('FORBIDDEN') || message.includes('forbidden') || message.includes('insufficient permissions')) {
    return ERROR_MESSAGES.FORBIDDEN;
  }
  
  if (message.includes('VALIDATION_ERROR') || message.includes('validation')) {
    return ERROR_MESSAGES.VALIDATION_ERROR;
  }
  
  // Email service error codes
  if (message.includes('EMAIL_QUOTA_EXCEEDED') || message.includes('quota') || message.includes('credits')) {
    return ERROR_MESSAGES.EMAIL_QUOTA_EXCEEDED;
  }
  
  if (message.includes('EMAIL_INVALID_CREDENTIALS') || message.includes('credentials') || message.includes('configuration')) {
    return ERROR_MESSAGES.EMAIL_INVALID_CREDENTIALS;
  }
  
  if (message.includes('EMAIL_INVALID_ADDRESS') || message.includes('Invalid email address')) {
    return ERROR_MESSAGES.EMAIL_INVALID_ADDRESS;
  }
  
  if (message.includes('EMAIL_BLOCKED') || message.includes('blocked')) {
    return ERROR_MESSAGES.EMAIL_BLOCKED;
  }
  
  if (message.includes('EMAIL_SERVICE_UNAVAILABLE') || message.includes('unavailable')) {
    return ERROR_MESSAGES.EMAIL_SERVICE_UNAVAILABLE;
  }
  
  if (message.includes('EMAIL_SERVICE_FAILED') || message.includes('email delivery failed')) {
    return ERROR_MESSAGES.EMAIL_SERVICE_FAILED;
  }
  
  // For any other errors, return a generic friendly message
  return ERROR_MESSAGES.INTERNAL_ERROR;
}