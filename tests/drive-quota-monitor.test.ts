/**
 * Drive Quota Monitor Tests
 *
 * Comprehensive test suite for Google Drive API quota monitoring and tracking.
 * Tests quota limits, window resets, warning thresholds, and error tracking.
 *
 * Test Coverage:
 * - trackQuotaUsage() per-user and global quotas
 * - Quota window resets after 100 seconds
 * - Quota exceeded detection
 * - Warning thresholds (80%, 95%)
 * - trackQuotaError() for quota-related errors
 * - getQuotaStats() for user and global stats
 * - resetQuotaTracking()
 * - withQuotaTracking() wrapper
 * - checkQuotaAlerts() for monitoring
 * - getRecentQuotaErrors() for error logs
 * - cleanupExpiredQuotas() for maintenance
 *
 * To run these tests:
 * npm test -- drive-quota-monitor.test.ts
 */

// @ts-nocheck - Disabling type checks for test file to avoid Jest mock type issues
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  trackQuotaUsage,
  trackQuotaError,
  getQuotaStats,
  resetQuotaTracking,
  withQuotaTracking,
  checkQuotaAlerts,
  getRecentQuotaErrors,
  cleanupExpiredQuotas,
} from '../server/services/drive-quota-monitor';
import { parseDriveError } from '../server/services/drive-error-handler';
import type { GaxiosError } from 'gaxios';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock GaxiosError for testing
 */
function createGaxiosError(
  statusCode: number,
  reason?: string,
  message?: string
): GaxiosError {
  const error: Partial<GaxiosError> = {
    response: {
      status: statusCode,
      statusText: `HTTP ${statusCode}`,
      headers: {},
      data: {
        error: {
          code: statusCode,
          message: message || `Error ${statusCode}`,
          errors: reason
            ? [
                {
                  reason,
                  message: message || `Error with reason: ${reason}`,
                  domain: 'global',
                },
              ]
            : [],
        },
      },
      config: {},
    } as any,
    config: {} as any,
    code: `${statusCode}`,
    message: message || `Request failed with status ${statusCode}`,
    name: 'GaxiosError',
  };

  return error as GaxiosError;
}

/**
 * Wait for a specified time
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Test Suite: trackQuotaUsage()
// ============================================================================

describe('Drive Quota Monitor - trackQuotaUsage()', () => {
  beforeEach(() => {
    // Reset quota tracking before each test
    resetQuotaTracking();
    vi.clearAllMocks();
  });

  describe('Basic Quota Tracking', () => {
    it('should track first request for user', () => {
      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.userQuotaRemaining).toBe(19999); // 20,000 - 1
      expect(result.globalQuotaRemaining).toBe(11999); // 12,000 - 1
      expect(result.warning).toBeUndefined();
    });

    it('should track multiple requests for same user', () => {
      trackQuotaUsage('user123', 'files.list');
      trackQuotaUsage('user123', 'files.get');
      const result = trackQuotaUsage('user123', 'files.get');

      expect(result.allowed).toBe(true);
      expect(result.userQuotaRemaining).toBe(19997); // 20,000 - 3
      expect(result.globalQuotaRemaining).toBe(11997); // 12,000 - 3
    });

    it('should track requests for different users independently', () => {
      trackQuotaUsage('user1', 'files.list');
      trackQuotaUsage('user1', 'files.get');

      const result2 = trackQuotaUsage('user2', 'files.list');

      expect(result2.userQuotaRemaining).toBe(19999); // User2's first request
      expect(result2.globalQuotaRemaining).toBe(11997); // Global quota includes both users
    });

    it('should track global quota across all users', () => {
      trackQuotaUsage('user1', 'files.list');
      trackQuotaUsage('user2', 'files.list');
      const result = trackQuotaUsage('user3', 'files.list');

      expect(result.globalQuotaRemaining).toBe(11997); // 12,000 - 3
    });
  });

  describe('User Quota Limits (20,000 per 100 seconds)', () => {
    it('should allow requests below user quota limit', () => {
      for (let i = 0; i < 100; i++) {
        const result = trackQuotaUsage('user123', 'files.list');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests when user quota exceeded', () => {
      // Exceed user quota (20,000 requests)
      for (let i = 0; i < 20000; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(false);
      expect(result.userQuotaRemaining).toBe(-1);
      expect(result.warning).toBe('User quota exceeded');
    });

    it('should track user quota remaining correctly', () => {
      // Use 10,000 requests
      for (let i = 0; i < 10000; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.userQuotaRemaining).toBe(9999); // 20,000 - 10,001
    });
  });

  describe('Global Quota Limits (12,000 per 100 seconds)', () => {
    it('should allow requests below global quota limit', () => {
      for (let i = 0; i < 100; i++) {
        const result = trackQuotaUsage(`user${i}`, 'files.list');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests when global quota exceeded', () => {
      // Exceed global quota (12,000 requests) across multiple users
      for (let i = 0; i < 12000; i++) {
        trackQuotaUsage(`user${i % 100}`, 'files.list');
      }

      const result = trackQuotaUsage('user999', 'files.list');

      expect(result.allowed).toBe(false);
      expect(result.globalQuotaRemaining).toBe(-1);
      expect(result.warning).toBe('Project quota exceeded');
    });

    it('should track global quota remaining correctly', () => {
      // Use 6,000 requests
      for (let i = 0; i < 6000; i++) {
        trackQuotaUsage(`user${i % 10}`, 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.globalQuotaRemaining).toBe(5999); // 12,000 - 6,001
    });
  });

  describe('Warning Thresholds', () => {
    it('should warn at 80% user quota usage', () => {
      // Use 16,000 requests (80% of 20,000)
      for (let i = 0; i < 16000; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe('Warning: High quota usage');
    });

    it('should warn at 95% user quota usage', () => {
      // Use 19,000 requests (95% of 20,000)
      for (let i = 0; i < 19000; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe('Critical: Approaching quota limit');
    });

    it('should warn at 80% global quota usage', () => {
      // Use 9,600 requests (80% of 12,000)
      for (let i = 0; i < 9600; i++) {
        trackQuotaUsage(`user${i % 100}`, 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe('Warning: High quota usage');
    });

    it('should warn at 95% global quota usage', () => {
      // Use 11,400 requests (95% of 12,000)
      for (let i = 0; i < 11400; i++) {
        trackQuotaUsage(`user${i % 100}`, 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBe('Critical: Approaching quota limit');
    });

    it('should not warn below 80% usage', () => {
      // Use 10,000 requests (50% of 20,000)
      for (let i = 0; i < 10000; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('Quota Window Reset', () => {
    it('should reset user quota after window expires', async () => {
      // Track a request
      trackQuotaUsage('user123', 'files.list');

      // Wait for quota window to expire (100ms in test)
      await wait(150);

      // New request should start fresh window
      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.userQuotaRemaining).toBe(19999); // Fresh window
    });

    it('should reset global quota after window expires', async () => {
      // Track requests
      for (let i = 0; i < 100; i++) {
        trackQuotaUsage(`user${i}`, 'files.list');
      }

      // Wait for quota window to expire
      await wait(150);

      // New request should start fresh window
      const result = trackQuotaUsage('user999', 'files.list');

      expect(result.globalQuotaRemaining).toBe(11999); // Fresh window
    });

    it('should maintain quota within window period', async () => {
      trackQuotaUsage('user123', 'files.list');
      await wait(50); // Wait less than window period
      const result = trackQuotaUsage('user123', 'files.list');

      expect(result.userQuotaRemaining).toBe(19998); // Still in same window
    });
  });
});

// ============================================================================
// Test Suite: trackQuotaError()
// ============================================================================

describe('Drive Quota Monitor - trackQuotaError()', () => {
  beforeEach(() => {
    resetQuotaTracking();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should track rate limit exceeded error', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user123');

    const errors = getRecentQuotaErrors(10);
    expect(errors).toHaveLength(1);
    expect(errors[0].errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(errors[0].userId).toBe('user123');
  });

  it('should track user rate limit exceeded error', () => {
    const error = createGaxiosError(403, 'usageratelimitexceeded');
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user456');

    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].errorCode).toBe('USER_RATE_LIMIT_EXCEEDED');
  });

  it('should track quota exceeded error', () => {
    const error = createGaxiosError(403, 'dailylimitexceeded');
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user789');

    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].errorCode).toBe('QUOTA_EXCEEDED');
  });

  it('should track storage quota exceeded error', () => {
    const error = createGaxiosError(403, 'storagequotaexceeded');
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user321');

    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].errorCode).toBe('STORAGE_QUOTA_EXCEEDED');
  });

  it('should not track non-quota errors', () => {
    const error = createGaxiosError(404);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user123');

    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(0);
  });

  it('should track error without user ID', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError);

    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].userId).toBeUndefined();
  });

  it('should limit error log to max size (100)', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    // Add 150 errors
    for (let i = 0; i < 150; i++) {
      trackQuotaError(parsedError, `user${i}`);
    }

    const errors = getRecentQuotaErrors(200);
    expect(errors.length).toBeLessThanOrEqual(100);
  });

  it('should log error to console', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user123');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Drive API quota error:',
      expect.objectContaining({
        userId: 'user123',
        errorCode: 'RATE_LIMIT_EXCEEDED',
      })
    );
  });
});

// ============================================================================
// Test Suite: getQuotaStats()
// ============================================================================

describe('Drive Quota Monitor - getQuotaStats()', () => {
  beforeEach(() => {
    resetQuotaTracking();
  });

  describe('User Stats', () => {
    it('should return stats for user with no requests', () => {
      const stats = getQuotaStats('user123');

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.quotaErrors).toBe(0);
      expect(stats.rateLimit).toBe(20000);
    });

    it('should return stats for user with requests', () => {
      for (let i = 0; i < 100; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      const stats = getQuotaStats('user123');

      expect(stats.total).toBe(100);
      expect(stats.successful).toBe(100);
      expect(stats.rateLimit).toBe(20000);
    });

    it('should include quota errors in stats', () => {
      // Make requests
      for (let i = 0; i < 50; i++) {
        trackQuotaUsage('user123', 'files.list');
      }

      // Track some quota errors
      const error = createGaxiosError(429);
      const parsedError = parseDriveError(error);
      trackQuotaError(parsedError, 'user123');
      trackQuotaError(parsedError, 'user123');

      const stats = getQuotaStats('user123');

      expect(stats.total).toBe(50);
      expect(stats.quotaErrors).toBe(2);
      expect(stats.successful).toBe(48); // total - quotaErrors
    });

    it('should return fresh stats after quota window reset', async () => {
      // Make requests
      trackQuotaUsage('user123', 'files.list');

      // Wait for window to expire
      await wait(150);

      const stats = getQuotaStats('user123');

      expect(stats.total).toBe(0); // Window reset
    });
  });

  describe('Global Stats', () => {
    it('should return global stats when no userId provided', () => {
      const stats = getQuotaStats();

      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.rateLimit).toBe(12000);
    });

    it('should return global stats with requests from multiple users', () => {
      for (let i = 0; i < 100; i++) {
        trackQuotaUsage(`user${i % 10}`, 'files.list');
      }

      const stats = getQuotaStats();

      expect(stats.total).toBe(100);
      expect(stats.rateLimit).toBe(12000);
    });

    it('should include all quota errors in global stats', () => {
      // Make requests from multiple users
      for (let i = 0; i < 50; i++) {
        trackQuotaUsage(`user${i}`, 'files.list');
      }

      // Track errors from different users
      const error = createGaxiosError(429);
      const parsedError = parseDriveError(error);
      trackQuotaError(parsedError, 'user1');
      trackQuotaError(parsedError, 'user2');
      trackQuotaError(parsedError, 'user3');

      const stats = getQuotaStats();

      expect(stats.quotaErrors).toBe(3);
    });
  });
});

// ============================================================================
// Test Suite: resetQuotaTracking()
// ============================================================================

describe('Drive Quota Monitor - resetQuotaTracking()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should reset specific user quota', () => {
    // Track requests for multiple users
    for (let i = 0; i < 100; i++) {
      trackQuotaUsage('user1', 'files.list');
      trackQuotaUsage('user2', 'files.list');
    }

    // Reset user1
    resetQuotaTracking('user1');

    // Check stats
    const user1Stats = getQuotaStats('user1');
    const user2Stats = getQuotaStats('user2');

    expect(user1Stats.total).toBe(0); // Reset
    expect(user2Stats.total).toBe(100); // Not reset
  });

  it('should reset all quota tracking when no userId provided', () => {
    // Track requests
    trackQuotaUsage('user1', 'files.list');
    trackQuotaUsage('user2', 'files.list');

    // Track errors
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);
    trackQuotaError(parsedError, 'user1');

    // Reset all
    resetQuotaTracking();

    // Check stats
    const user1Stats = getQuotaStats('user1');
    const globalStats = getQuotaStats();
    const errors = getRecentQuotaErrors();

    expect(user1Stats.total).toBe(0);
    expect(globalStats.total).toBe(0);
    expect(errors).toHaveLength(0);
  });

  it('should log reset message', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    resetQuotaTracking('user123');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Reset quota tracking for user user123')
    );
  });
});

// ============================================================================
// Test Suite: withQuotaTracking()
// ============================================================================

describe('Drive Quota Monitor - withQuotaTracking()', () => {
  beforeEach(() => {
    resetQuotaTracking();
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should track quota and execute operation successfully', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await withQuotaTracking('user123', 'files.list', operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);

    // Check quota was tracked
    const stats = getQuotaStats('user123');
    expect(stats.total).toBe(1);
  });

  it('should throw error when user quota exceeded', async () => {
    // Exceed user quota
    for (let i = 0; i < 20000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const operation = vi.fn().mockResolvedValue('success');

    await expect(
      withQuotaTracking('user123', 'files.list', operation)
    ).rejects.toThrow('Drive API quota exceeded for user user123');

    expect(operation).not.toHaveBeenCalled();
  });

  it('should throw error when global quota exceeded', async () => {
    // Exceed global quota
    for (let i = 0; i < 12000; i++) {
      trackQuotaUsage(`user${i % 100}`, 'files.list');
    }

    const operation = vi.fn().mockResolvedValue('success');

    await expect(
      withQuotaTracking('user999', 'files.list', operation)
    ).rejects.toThrow('Drive API quota exceeded');

    expect(operation).not.toHaveBeenCalled();
  });

  it('should warn at high quota usage', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    // Use 16,000 requests (80% of 20,000)
    for (let i = 0; i < 16000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const operation = vi.fn().mockResolvedValue('success');
    await withQuotaTracking('user123', 'files.list', operation);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Drive API quota warning'),
      expect.objectContaining({
        warning: 'Warning: High quota usage',
      })
    );
  });

  it('should track quota errors on operation failure', async () => {
    const error = createGaxiosError(429);
    const operation = vi.fn().mockRejectedValue(error);

    await expect(
      withQuotaTracking('user123', 'files.list', operation)
    ).rejects.toThrow();

    // Check error was tracked
    const errors = getRecentQuotaErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].errorCode).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should return operation result data', async () => {
    const mockData = { id: '123', name: 'Test File' };
    const operation = vi.fn().mockResolvedValue(mockData);

    const result = await withQuotaTracking('user123', 'files.get', operation);

    expect(result).toEqual(mockData);
  });
});

// ============================================================================
// Test Suite: checkQuotaAlerts()
// ============================================================================

describe('Drive Quota Monitor - checkQuotaAlerts()', () => {
  beforeEach(() => {
    resetQuotaTracking();
  });

  it('should return null when usage is below warning threshold', () => {
    // Use 10,000 requests (50% of 20,000)
    for (let i = 0; i < 10000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const alert = checkQuotaAlerts('user123');

    expect(alert).toBeNull();
  });

  it('should alert at warning level (80%)', () => {
    // Use 16,000 requests (80% of 20,000)
    for (let i = 0; i < 16000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const alert = checkQuotaAlerts('user123');

    expect(alert).not.toBeNull();
    expect(alert?.level).toBe('warning');
    expect(alert?.message).toContain('High quota usage');
    expect(alert?.message).toContain('80%');
  });

  it('should alert at critical level (95%)', () => {
    // Use 19,000 requests (95% of 20,000)
    for (let i = 0; i < 19000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const alert = checkQuotaAlerts('user123');

    expect(alert).not.toBeNull();
    expect(alert?.level).toBe('critical');
    expect(alert?.message).toContain('Critical quota usage');
    expect(alert?.message).toContain('95%');
  });

  it('should alert when quota exceeded', () => {
    // Exceed quota (20,000+ requests)
    for (let i = 0; i < 20001; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const alert = checkQuotaAlerts('user123');

    expect(alert).not.toBeNull();
    expect(alert?.level).toBe('exceeded');
    expect(alert?.message).toContain('Quota exceeded');
  });

  it('should include stats in alert', () => {
    // Use 16,000 requests
    for (let i = 0; i < 16000; i++) {
      trackQuotaUsage('user123', 'files.list');
    }

    const alert = checkQuotaAlerts('user123');

    expect(alert).not.toBeNull();
    expect(alert?.stats).toBeDefined();
    expect(alert?.stats.total).toBe(16000);
    expect(alert?.stats.rateLimit).toBe(20000);
  });

  it('should check global quota when no userId provided', () => {
    // Use 9,600 requests (80% of 12,000)
    for (let i = 0; i < 9600; i++) {
      trackQuotaUsage(`user${i % 100}`, 'files.list');
    }

    const alert = checkQuotaAlerts();

    expect(alert).not.toBeNull();
    expect(alert?.level).toBe('warning');
    expect(alert?.stats.rateLimit).toBe(12000);
  });
});

// ============================================================================
// Test Suite: getRecentQuotaErrors()
// ============================================================================

describe('Drive Quota Monitor - getRecentQuotaErrors()', () => {
  beforeEach(() => {
    resetQuotaTracking();
  });

  it('should return empty array when no errors tracked', () => {
    const errors = getRecentQuotaErrors();

    expect(errors).toEqual([]);
  });

  it('should return recent errors', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user1');
    trackQuotaError(parsedError, 'user2');

    const errors = getRecentQuotaErrors();

    expect(errors).toHaveLength(2);
  });

  it('should limit returned errors to specified limit', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    for (let i = 0; i < 50; i++) {
      trackQuotaError(parsedError, `user${i}`);
    }

    const errors = getRecentQuotaErrors(10);

    expect(errors).toHaveLength(10);
  });

  it('should return most recent errors first', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    trackQuotaError(parsedError, 'user1');
    trackQuotaError(parsedError, 'user2');
    trackQuotaError(parsedError, 'user3');

    const errors = getRecentQuotaErrors(2);

    expect(errors).toHaveLength(2);
    expect(errors[0].userId).toBe('user2'); // Second to last
    expect(errors[1].userId).toBe('user3'); // Last
  });

  it('should use default limit of 20', () => {
    const error = createGaxiosError(429);
    const parsedError = parseDriveError(error);

    for (let i = 0; i < 30; i++) {
      trackQuotaError(parsedError, `user${i}`);
    }

    const errors = getRecentQuotaErrors();

    expect(errors).toHaveLength(20);
  });
});

// ============================================================================
// Test Suite: cleanupExpiredQuotas()
// ============================================================================

describe('Drive Quota Monitor - cleanupExpiredQuotas()', () => {
  beforeEach(() => {
    resetQuotaTracking();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should clean up expired user quotas', async () => {
    // Track requests for multiple users
    trackQuotaUsage('user1', 'files.list');
    trackQuotaUsage('user2', 'files.list');

    // Wait for quotas to expire
    await wait(150);

    // Make a new request for user1 to keep it active
    trackQuotaUsage('user1', 'files.list');

    // Run cleanup
    cleanupExpiredQuotas();

    // User1 should have fresh quota, user2 should be cleaned
    const user1Stats = getQuotaStats('user1');
    expect(user1Stats.total).toBe(1); // Fresh window
  });

  it('should not clean up active quotas', async () => {
    // Track request
    trackQuotaUsage('user123', 'files.list');

    // Run cleanup immediately (quota still active)
    cleanupExpiredQuotas();

    const stats = getQuotaStats('user123');
    expect(stats.total).toBe(1); // Still active
  });

  it('should log cleanup message when quotas cleaned', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');

    // Track requests
    trackQuotaUsage('user1', 'files.list');

    // Wait for expiration
    await wait(150);

    // Run cleanup
    cleanupExpiredQuotas();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cleaned up 1 expired quota windows')
    );
  });
});
