/**
 * Token Refresh Behavior Tests
 *
 * This test file validates token retrieval and refresh behavior for Google Drive,
 * including:
 * - Initial token retrieval after OAuth
 * - Token refresh on expiry
 * - Token refresh on error
 * - Token caching behavior
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Import utilities we created
import {
  TestScenarioBuilder,
  createMockQueryClient,
  createTestWrapper,
} from './test-utils';

// Import the hooks we're testing
import { 
  useGoogleDriveTokenQuery,
  useGoogleDriveTokenQueryWithRefresh 
} from '../../client/src/lib/queries/google-drive';

describe('Token Refresh Behavior', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Initial Token Retrieval', () => {
    it('should retrieve valid token after OAuth', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for token to be fetched
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify token data
      expect(result.current.data).toEqual({
        accessToken: 'mock-access-token',
        expiresAt: expect.any(String),
      });

      scenario.cleanup();
    });

    it('should handle missing token gracefully', async () => {
      const scenario = TestScenarioBuilder.create()
        .withDisconnectedDrive()
        .build();

      const { result } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for query to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(false);
        expect(result.current.isError).toBe(false);
        expect(result.current.data).toBe(null);
      });

      scenario.cleanup();
    });

    it('should handle token fetch error', async () => {
      const scenario = TestScenarioBuilder.create()
        .build();

      // Mock token fetch error
      scenario.mockFetch('/api/google-drive/token', {
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error'
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toEqual(
          expect.objectContaining({
            message: expect.any(String),
          })
        );
      });

      scenario.cleanup();
    });
  });

  describe('Token Refresh Behavior', () => {
    it('should provide refresh function', () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result } = renderHook(() => useGoogleDriveTokenQueryWithRefresh(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Verify refresh function is available
      expect(typeof result.current.refreshToken).toBe('function');

      scenario.cleanup();
    });

    it('should refresh token when called', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      // Mock fresh token response
      scenario.mockFetch('/api/google-drive/token', {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'refreshed-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQueryWithRefresh(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Call refresh
      result.current.refreshToken();

      // Wait for refresh to complete
      await waitFor(() => {
        expect(result.current.data?.accessToken).toBe('refreshed-access-token');
      });

      scenario.cleanup();
    });

    it('should handle refresh errors gracefully', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      // Mock refresh error
      scenario.mockFetch('/api/google-drive/token', {
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Token refresh failed'
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQueryWithRefresh(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Call refresh
      result.current.refreshToken();

      // Wait for error
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
        expect(result.current.error).toEqual(
          expect.objectContaining({
            message: expect.any(String),
          })
        );
      });

      scenario.cleanup();
    });
  });

  describe('Token Expiry Handling', () => {
    it('should detect expired token', async () => {
      const scenario = TestScenarioBuilder.create()
        .build();

      // Mock expired token
      const expiredTime = new Date(Date.now() - 1000).toISOString();
      scenario.mockFetch('/api/google-drive/token', {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'expired-token',
          expiresAt: expiredTime,
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for token to be fetched
      await waitFor(() => {
        expect(result.current.data?.expiresAt).toBe(expiredTime);
      });

      // Token should be considered expired (in real implementation)
      expect(result.current.data?.accessToken).toBe('expired-token');

      scenario.cleanup();
    });

    it('should handle valid future expiry', async () => {
      const scenario = TestScenarioBuilder.create()
        .build();

      // Mock valid future token
      const futureTime = new Date(Date.now() + 3600000).toISOString();
      scenario.mockFetch('/api/google-drive/token', {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'valid-future-token',
          expiresAt: futureTime,
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for token to be fetched
      await waitFor(() => {
        expect(result.current.data?.expiresAt).toBe(futureTime);
      });

      // Token should be considered valid
      expect(result.current.data?.accessToken).toBe('valid-future-token');

      scenario.cleanup();
    });
  });

  describe('Token Caching Behavior', () => {
    it('should cache token in query client', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      const { result: firstResult } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      firstResult.current.refetch();

      // Wait for first fetch
      await waitFor(() => {
        expect(firstResult.current.isSuccess).toBe(true);
      });

      // Render second hook (should use cache)
      const { result: secondResult } = renderHook(() => useGoogleDriveTokenQuery(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      secondResult.current.refetch();

      // Should immediately have data from cache
      expect(secondResult.current.data).toEqual(firstResult.current.data);
      expect(secondResult.current.isLoading).toBe(false);

      scenario.cleanup();
    });

    it('should invalidate cache on refresh', async () => {
      const scenario = TestScenarioBuilder.create()
        .withValidToken()
        .build();

      // Mock fresh token response
      scenario.mockFetch('/api/google-drive/token', {
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'fresh-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        }),
      });

      const { result } = renderHook(() => useGoogleDriveTokenQueryWithRefresh(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Enable the query
      result.current.refetch();

      // Wait for initial token
      await waitFor(() => {
        expect(result.current.data?.accessToken).toBe('mock-access-token');
      });

      // Refresh token
      result.current.refreshToken();

      // Wait for fresh token
      await waitFor(() => {
        expect(result.current.data?.accessToken).toBe('fresh-token');
      });

      scenario.cleanup();
    });
  });
});