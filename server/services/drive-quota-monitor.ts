/**
 * Drive API Quota Monitor
 *
 * Tracks and monitors Google Drive API quota usage to prevent exhaustion.
 * Provides alerting when approaching limits.
 *
 * Google Drive API Quotas (as of 2025):
 * - 20,000 queries per 100 seconds per user
 * - 12,000 queries per 100 seconds per project
 * - Daily quota varies by Google Workspace plan
 *
 * @module drive-quota-monitor
 */

import { type ParsedDriveError, parseDriveError } from "./drive-error-handler";

// ============================================================================
// Types
// ============================================================================

interface QuotaUsage {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

interface QuotaStats {
  total: number;
  successful: number;
  failed: number;
  quotaErrors: number;
  rateLimit: number;
  lastResetTime: Date;
  currentWindowStart: Date;
}

// ============================================================================
// In-Memory Quota Tracking
// ============================================================================

// Track per-user quota (20,000 per 100 seconds)
const userQuotaMap = new Map<string, QuotaUsage>();

// Track global/project quota (12,000 per 100 seconds)
let globalQuotaUsage: QuotaUsage = {
  count: 0,
  resetTime: Date.now() + 100 * 1000,
  firstRequestTime: Date.now(),
};

// Track quota errors for monitoring
const quotaErrorLog: Array<{
  timestamp: Date;
  userId?: string;
  errorCode: string;
  errorMessage: string;
}> = [];

// Keep last 100 quota errors
const MAX_ERROR_LOG_SIZE = 100;

// ============================================================================
// Configuration
// ============================================================================

const QUOTA_CONFIG = {
  // Per-user quota
  USER_QUOTA_PER_100_SECONDS: 20000,
  USER_QUOTA_WINDOW_MS: 100 * 1000, // 100 seconds

  // Project/global quota
  PROJECT_QUOTA_PER_100_SECONDS: 12000,
  PROJECT_QUOTA_WINDOW_MS: 100 * 1000, // 100 seconds

  // Warning thresholds (percentage of quota)
  WARNING_THRESHOLD: 0.8, // 80%
  CRITICAL_THRESHOLD: 0.95, // 95%
};

// ============================================================================
// Quota Tracking Functions
// ============================================================================

/**
 * Track a Drive API request for quota monitoring
 *
 * @param userId - User ID making the request (for per-user tracking)
 * @param method - API method being called (e.g., "files.list", "files.get")
 * @returns Quota status
 */
export function trackQuotaUsage(
  userId: string,
  method: string
): {
  allowed: boolean;
  userQuotaRemaining: number;
  globalQuotaRemaining: number;
  warning?: string;
} {
  const now = Date.now();

  // Track user quota
  let userQuota = userQuotaMap.get(userId);

  if (!userQuota || userQuota.resetTime < now) {
    // Create new quota window
    userQuota = {
      count: 1,
      resetTime: now + QUOTA_CONFIG.USER_QUOTA_WINDOW_MS,
      firstRequestTime: now,
    };
    userQuotaMap.set(userId, userQuota);
  } else {
    userQuota.count++;
  }

  // Track global quota
  if (globalQuotaUsage.resetTime < now) {
    // Create new quota window
    globalQuotaUsage = {
      count: 1,
      resetTime: now + QUOTA_CONFIG.PROJECT_QUOTA_WINDOW_MS,
      firstRequestTime: now,
    };
  } else {
    globalQuotaUsage.count++;
  }

  // Calculate remaining quota
  const userQuotaRemaining =
    QUOTA_CONFIG.USER_QUOTA_PER_100_SECONDS - userQuota.count;
  const globalQuotaRemaining =
    QUOTA_CONFIG.PROJECT_QUOTA_PER_100_SECONDS - globalQuotaUsage.count;

  // Check if quota exceeded
  const userQuotaExceeded =
    userQuota.count > QUOTA_CONFIG.USER_QUOTA_PER_100_SECONDS;
  const globalQuotaExceeded =
    globalQuotaUsage.count > QUOTA_CONFIG.PROJECT_QUOTA_PER_100_SECONDS;

  // Generate warnings
  let warning: string | undefined;

  if (userQuotaExceeded || globalQuotaExceeded) {
    warning = userQuotaExceeded
      ? "User quota exceeded"
      : "Project quota exceeded";
  } else {
    const userUsagePercent =
      userQuota.count / QUOTA_CONFIG.USER_QUOTA_PER_100_SECONDS;
    const globalUsagePercent =
      globalQuotaUsage.count / QUOTA_CONFIG.PROJECT_QUOTA_PER_100_SECONDS;

    if (
      userUsagePercent >= QUOTA_CONFIG.CRITICAL_THRESHOLD ||
      globalUsagePercent >= QUOTA_CONFIG.CRITICAL_THRESHOLD
    ) {
      warning = "Critical: Approaching quota limit";
    } else if (
      userUsagePercent >= QUOTA_CONFIG.WARNING_THRESHOLD ||
      globalUsagePercent >= QUOTA_CONFIG.WARNING_THRESHOLD
    ) {
      warning = "Warning: High quota usage";
    }
  }

  // Log if exceeded
  if (userQuotaExceeded || globalQuotaExceeded) {
    console.warn("Drive API quota exceeded:", {
      userId,
      method,
      userQuota: userQuota.count,
      globalQuota: globalQuotaUsage.count,
      userQuotaExceeded,
      globalQuotaExceeded,
    });
  }

  return {
    allowed: !userQuotaExceeded && !globalQuotaExceeded,
    userQuotaRemaining,
    globalQuotaRemaining,
    warning,
  };
}

/**
 * Track a Drive API error for monitoring
 *
 * @param error - Parsed Drive error
 * @param userId - Optional user ID
 */
export function trackQuotaError(
  error: ParsedDriveError,
  userId?: string
): void {
  // Only track quota-related errors
  const quotaErrorCodes = [
    "RATE_LIMIT_EXCEEDED",
    "USER_RATE_LIMIT_EXCEEDED",
    "QUOTA_EXCEEDED",
    "STORAGE_QUOTA_EXCEEDED",
  ];

  if (!quotaErrorCodes.includes(error.code)) {
    return;
  }

  // Add to error log
  quotaErrorLog.push({
    timestamp: new Date(),
    userId,
    errorCode: error.code,
    errorMessage: error.message,
  });

  // Keep log size manageable
  if (quotaErrorLog.length > MAX_ERROR_LOG_SIZE) {
    quotaErrorLog.shift();
  }

  console.error("Drive API quota error:", {
    userId,
    errorCode: error.code,
    message: error.message,
    retryAfter: error.retryAfter,
  });
}

/**
 * Get quota usage statistics
 *
 * @param userId - Optional user ID for per-user stats
 * @returns Quota statistics
 */
export function getQuotaStats(userId?: string): QuotaStats {
  const now = Date.now();

  if (userId) {
    const userQuota = userQuotaMap.get(userId);

    if (!userQuota || userQuota.resetTime < now) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        quotaErrors: 0,
        rateLimit: QUOTA_CONFIG.USER_QUOTA_PER_100_SECONDS,
        lastResetTime: new Date(now),
        currentWindowStart: new Date(now),
      };
    }

    // Count quota errors for this user
    const userQuotaErrors = quotaErrorLog.filter(
      (log) => log.userId === userId
    ).length;

    return {
      total: userQuota.count,
      successful: Math.max(0, userQuota.count - userQuotaErrors),
      failed: userQuotaErrors,
      quotaErrors: userQuotaErrors,
      rateLimit: QUOTA_CONFIG.USER_QUOTA_PER_100_SECONDS,
      lastResetTime: new Date(userQuota.resetTime),
      currentWindowStart: new Date(userQuota.firstRequestTime),
    };
  }

  // Global stats
  const globalQuotaErrors = quotaErrorLog.length;

  return {
    total: globalQuotaUsage.count,
    successful: Math.max(0, globalQuotaUsage.count - globalQuotaErrors),
    failed: globalQuotaErrors,
    quotaErrors: globalQuotaErrors,
    rateLimit: QUOTA_CONFIG.PROJECT_QUOTA_PER_100_SECONDS,
    lastResetTime: new Date(globalQuotaUsage.resetTime),
    currentWindowStart: new Date(globalQuotaUsage.firstRequestTime),
  };
}

/**
 * Get recent quota errors for monitoring
 *
 * @param limit - Maximum number of errors to return
 * @returns Recent quota errors
 */
export function getRecentQuotaErrors(limit: number = 20): Array<{
  timestamp: Date;
  userId?: string;
  errorCode: string;
  errorMessage: string;
}> {
  return quotaErrorLog.slice(-limit);
}

/**
 * Reset quota tracking (useful for testing or manual reset)
 *
 * @param userId - Optional user ID to reset specific user quota
 */
export function resetQuotaTracking(userId?: string): void {
  if (userId) {
    userQuotaMap.delete(userId);
    console.log(`Reset quota tracking for user ${userId}`);
  } else {
    userQuotaMap.clear();
    globalQuotaUsage = {
      count: 0,
      resetTime: Date.now() + QUOTA_CONFIG.PROJECT_QUOTA_WINDOW_MS,
      firstRequestTime: Date.now(),
    };
    quotaErrorLog.length = 0;
    console.log("Reset all quota tracking");
  }
}

/**
 * Cleanup expired quota windows (runs periodically)
 */
export function cleanupExpiredQuotas(): void {
  const now = Date.now();
  let cleaned = 0;

  // Convert to array to avoid downlevelIteration requirement
  for (const [userId, quota] of Array.from(userQuotaMap.entries())) {
    if (quota.resetTime < now) {
      userQuotaMap.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired quota windows`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredQuotas, 5 * 60 * 1000);

// ============================================================================
// Alerting and Monitoring
// ============================================================================

/**
 * Check if quota usage is approaching limits and should trigger an alert
 *
 * @param userId - Optional user ID to check
 * @returns Alert information if approaching limits
 */
export function checkQuotaAlerts(userId?: string): {
  alert: boolean;
  level: "warning" | "critical" | "exceeded" | null;
  message: string;
  stats: QuotaStats;
} | null {
  const stats = getQuotaStats(userId);

  const usagePercent = stats.total / stats.rateLimit;

  if (usagePercent >= 1.0) {
    return {
      alert: true,
      level: "exceeded",
      message: `Quota exceeded: ${stats.total}/${stats.rateLimit} requests used`,
      stats,
    };
  }

  if (usagePercent >= QUOTA_CONFIG.CRITICAL_THRESHOLD) {
    return {
      alert: true,
      level: "critical",
      message: `Critical quota usage: ${Math.round(usagePercent * 100)}% (${stats.total}/${stats.rateLimit})`,
      stats,
    };
  }

  if (usagePercent >= QUOTA_CONFIG.WARNING_THRESHOLD) {
    return {
      alert: true,
      level: "warning",
      message: `High quota usage: ${Math.round(usagePercent * 100)}% (${stats.total}/${stats.rateLimit})`,
      stats,
    };
  }

  return null;
}

/**
 * Wrapper for Drive API calls that includes quota tracking
 *
 * @param userId - User ID making the request
 * @param method - API method being called
 * @param operation - Async operation to execute
 * @returns Result of the operation
 */
export async function withQuotaTracking<T>(
  userId: string,
  method: string,
  operation: () => Promise<T>
): Promise<T> {
  // Track quota before making the request
  const quotaStatus = trackQuotaUsage(userId, method);

  if (!quotaStatus.allowed) {
    throw new Error(
      `Drive API quota exceeded for user ${userId}. Please try again later.`
    );
  }

  // Log warning if approaching limits
  if (quotaStatus.warning) {
    console.warn(`Drive API quota warning for user ${userId}:`, {
      warning: quotaStatus.warning,
      userQuotaRemaining: quotaStatus.userQuotaRemaining,
      globalQuotaRemaining: quotaStatus.globalQuotaRemaining,
      method,
    });
  }

  try {
    const result = await operation();
    return result;
  } catch (error) {
    // Track quota-related errors
    const parsedError = parseDriveError(error);
    trackQuotaError(parsedError, userId);
    throw error;
  }
}
