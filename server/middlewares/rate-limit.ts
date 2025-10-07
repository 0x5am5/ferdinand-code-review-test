import type { NextFunction, Request, Response } from "express";

// Simple in-memory rate limiter
// For production, consider using Redis-backed rate limiting (e.g., express-rate-limit with Redis store)

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    const entries = Array.from(rateLimitStore.entries());
    for (const [key, record] of entries) {
      if (record.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  },
  10 * 60 * 1000
);

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string;
  keyGenerator?: (req: Request) => string;
}

/**
 * Rate limiting middleware
 * Limits the number of requests from a single IP or user within a time window
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = "Too many requests, please try again later",
    keyGenerator = defaultKeyGenerator,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // If no record or reset time has passed, create a new record
    if (!record || record.resetTime < now) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, record);
      return next();
    }

    // Increment the count
    record.count++;

    // Check if limit exceeded
    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(record.resetTime).toISOString()
      );

      return res.status(429).json({
        message,
        retryAfter,
      });
    }

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", max - record.count);
    res.setHeader(
      "X-RateLimit-Reset",
      new Date(record.resetTime).toISOString()
    );

    next();
  };
}

/**
 * Default key generator - uses user ID if authenticated, otherwise IP address
 */
function defaultKeyGenerator(req: Request): string {
  if (req.session?.userId) {
    return `user:${req.session.userId}`;
  }

  // Use IP address as fallback
  const ip =
    req.ip ||
    req.socket.remoteAddress ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    "unknown";

  return `ip:${ip}`;
}

/**
 * Predefined rate limiters for common use cases
 */

// Upload rate limit: 50 uploads per hour per user
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  message: "Too many file uploads. Please try again later.",
});

// Strict upload rate limit for unauthenticated requests: 10 uploads per hour per IP
export const strictUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Upload limit exceeded. Please sign in for higher limits.",
  keyGenerator: (req) => {
    // Always use IP for strict rate limiting
    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      "unknown";
    return `strict-ip:${ip}`;
  },
});

// General API rate limit: 100 requests per 15 minutes per user
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests. Please try again later.",
});

// Auth rate limit: 10 login attempts per 15 minutes per IP (prevent brute force)
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many authentication attempts. Please try again later.",
  keyGenerator: (req) => {
    // Use IP for auth rate limiting to prevent brute force across accounts
    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      "unknown";
    return `auth-ip:${ip}`;
  },
});

// Invitation rate limit: 20 invitations per hour per user
export const invitationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: "Too many invitations sent. Please try again later.",
});

// API token creation rate limit: 10 tokens per hour per user
export const tokenCreationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many API tokens created. Please try again later.",
});

// Mutation rate limit: 200 mutations per 15 minutes per user (for POST/PUT/PATCH/DELETE)
export const mutationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: "Too many requests. Please slow down.",
});
