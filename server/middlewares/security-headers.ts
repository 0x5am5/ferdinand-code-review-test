import type { NextFunction, Request, Response } from "express";

/**
 * Security headers middleware
 * Adds security-related HTTP headers to all responses
 */
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");

  // Enable XSS protection (legacy browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer policy - only send referrer to same origin
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  // Note: Adjust based on your app's needs
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Vite in dev mode needs unsafe-eval
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net https://p.typekit.net",
    "font-src 'self' https://fonts.gstatic.com https://use.typekit.net https://r2cdn.perplexity.ai data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://use.typekit.net https://www.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com",
    "frame-ancestors 'none'",
  ].join("; ");

  res.setHeader("Content-Security-Policy", csp);

  // Permissions Policy (formerly Feature Policy)
  const permissionsPolicy = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
  ].join(", ");

  res.setHeader("Permissions-Policy", permissionsPolicy);

  next();
}

/**
 * CSRF protection middleware for file upload endpoints
 * Validates that requests come from the same origin
 */
export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Skip CSRF protection in test mode (when x-test-user-id header is present)
  if (req.get("x-test-user-id")) {
    return next();
  }

  // Get origin from request
  const origin = req.get("origin");
  const referer = req.get("referer");

  // If no origin or referer, reject
  if (!origin && !referer) {
    console.warn("CSRF: No origin or referer in request");
    return res.status(403).json({
      message: "CSRF validation failed: Missing origin header",
    });
  }

  // Check if origin matches host
  const host = req.get("host");
  const protocol = req.protocol;
  const expectedOrigin = `${protocol}://${host}`;

  const requestOrigin = origin || (referer ? new URL(referer).origin : null);

  if (requestOrigin !== expectedOrigin) {
    console.warn(
      `CSRF: Origin mismatch. Expected: ${expectedOrigin}, Got: ${requestOrigin}`
    );
    return res.status(403).json({
      message: "CSRF validation failed: Origin mismatch",
    });
  }

  next();
}
