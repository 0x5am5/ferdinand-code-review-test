import { apiTokens } from "@shared/schema";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { verifyToken } from "../utils/crypto";
/**
 * Middleware to authenticate API requests using bearer tokens
 */
export async function authenticateApiToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Bearer token required",
            });
            return;
        }
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        if (!token) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Token is required",
            });
            return;
        }
        // Find all active tokens to check against
        const activeTokens = await db
            .select()
            .from(apiTokens)
            .where(and(eq(apiTokens.isActive, true), 
        // Only include non-expired tokens (null means no expiration, or future dates)
        or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, new Date()))));
        // Check if the provided token matches any stored hash
        let matchedToken = null;
        for (const storedToken of activeTokens) {
            // Extract salt from the stored hash (format: "hash.salt")
            const [storedHash, salt] = storedToken.tokenHash.split(".");
            if (salt && verifyToken(token, storedHash, salt)) {
                matchedToken = storedToken;
                break;
            }
        }
        if (!matchedToken) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Invalid token",
            });
            return;
        }
        // Update last used timestamp
        await db
            .update(apiTokens)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiTokens.id, matchedToken.id));
        // Add token data to request
        req.tokenData = {
            id: matchedToken.id,
            clientId: matchedToken.clientId,
            tokenName: matchedToken.tokenName,
            scopes: matchedToken.scopes || ["read:assets"],
            createdBy: matchedToken.createdBy || undefined,
        };
        next();
    }
    catch (error) {
        console.error("API token authentication error:", error);
        res.status(500).json({
            error: "Internal Server Error",
            message: "Authentication failed",
        });
    }
}
/**
 * Middleware to check if the API token has required scopes
 */
export function requireScopes(requiredScopes) {
    return (req, res, next) => {
        if (!req.tokenData) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
            return;
        }
        const tokenScopes = req.tokenData.scopes || [];
        const hasAllScopes = requiredScopes.every((scope) => tokenScopes.includes(scope));
        if (!hasAllScopes) {
            res.status(403).json({
                error: "Forbidden",
                message: `Insufficient permissions. Required scopes: ${requiredScopes.join(", ")}`,
            });
            return;
        }
        next();
    };
}
/**
 * Middleware specifically for Slack-related API endpoints
 * Checks for Slack-specific scopes
 */
export function requireSlackAccess() {
    return requireScopes(["read:assets", "slack:read"]);
}
/**
 * Rate limiting middleware for API tokens
 * Different limits based on token type/scopes
 */
export function rateLimit(options = { maxRequests: 1000, windowMs: 60000 }) {
    const requests = new Map();
    // Clean up expired entries periodically
    setInterval(() => {
        const now = Date.now();
        Array.from(requests.entries()).forEach(([key, data]) => {
            if (now > data.resetTime) {
                requests.delete(key);
            }
        });
    }, options.windowMs);
    return (req, res, next) => {
        const key = options.keyGenerator
            ? options.keyGenerator(req)
            : `token:${req.tokenData?.id || "unknown"}`;
        const now = Date.now();
        let requestData = requests.get(key);
        if (!requestData || now > requestData.resetTime) {
            requestData = {
                count: 0,
                resetTime: now + options.windowMs,
            };
            requests.set(key, requestData);
        }
        requestData.count++;
        // Add rate limit headers
        res.set({
            "X-RateLimit-Limit": options.maxRequests.toString(),
            "X-RateLimit-Remaining": Math.max(0, options.maxRequests - requestData.count).toString(),
            "X-RateLimit-Reset": new Date(requestData.resetTime).toISOString(),
        });
        if (requestData.count > options.maxRequests) {
            res.status(429).json({
                error: "Too Many Requests",
                message: "Rate limit exceeded",
                retryAfter: Math.ceil((requestData.resetTime - now) / 1000),
            });
            return;
        }
        next();
    };
}
