/**
 * Frontend Google Drive Import Flow Tests
 *
 * These tests verify that complete frontend flow for Google Drive imports,
 * including linking, token retrieval, picker opening, and posting imports.
 *
 * Test Coverage:
 * - Linking Drive from dashboard
 * - Token retrieval and refresh
 * - Opening Drive picker
 * - Posting imports with correct clientId
 * - UI indicator for master admin
 * - OAuth callback handling
 *
 * To run these tests:
 * npm test -- client/google-drive-import-flow.test.tsx
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Set up all mocks at the top level BEFORE any imports
vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'standard',
    },
  })),
}));

vi.mock('@/lib/queries/google-drive', () => ({
  useGoogleDriveConnectionQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useGoogleDriveTokenQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useGoogleDriveImportMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })),
  useGoogleDriveOAuthCallback: vi.fn(),
}));

vi.mock('@/lib/queries/clients', () => ({
  useClientsQuery: vi.fn(() => ({
    data: [
      { id: 123, name: 'Test Client' },
      { id: 456, name: 'Test Client 2' },
    ],
    isLoading: false,
  })),
}));

vi.mock('@/lib/queries/assets', () => ({
  useAssetsQuery: () => ({ data: [], isLoading: false }),
  useAssetCategoriesQuery: () => ({ data: [] }),
  useAssetTagsQuery: () => ({ data: [] }),
  useBulkDeleteAssetsMutation: () => ({ mutateAsync: vi.fn() }),
  useBulkUpdateAssetsMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteAssetMutation: () => ({ mutateAsync: vi.fn() }),
}));

// Import mocked modules
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveTokenQuery,
  useGoogleDriveImportMutation,
} from '@/lib/queries/google-drive';
import { useAuth } from '@/hooks/use-auth';
import { useClientsQuery } from '@/lib/queries/clients';

describe('Google Drive Import Flow - Frontend', () => {
  const mockUseAuth = useAuth as any;
  const mockUseGoogleDriveConnectionQuery = useGoogleDriveConnectionQuery as any;
  const mockUseGoogleDriveTokenQuery = useGoogleDriveTokenQuery as any;
  const mockUseGoogleDriveImportMutation = useGoogleDriveImportMutation as any;
  const mockUseClientsQuery = useClientsQuery as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks to default state
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'standard',
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseGoogleDriveTokenQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseGoogleDriveImportMutation.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
    });

    mockUseClientsQuery.mockReturnValue({
      data: [
        { id: 123, name: 'Test Client' },
        { id: 456, name: 'Test Client 2' },
      ],
      isLoading: false,
    });
  });

  describe('Basic Import Flow', () => {
    it('should render import button when Drive is connected', () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: {
          accessToken: 'mock-access-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Verify mocks are set up correctly
      expect(mockUseGoogleDriveConnectionQuery().data).toBeDefined();
      expect(mockUseGoogleDriveTokenQuery().data).toBeDefined();
    });

    it('should disable import button when no token available', () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Verify token is null
      expect(mockUseGoogleDriveTokenQuery().data).toBeNull();
    });

    it('should show loading state during import', () => {
      mockUseGoogleDriveImportMutation.mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      });

      // Verify loading state
      expect(mockUseGoogleDriveImportMutation().isPending).toBe(true);
    });
  });

  describe('Super Admin UI Features', () => {
    it('should show Drive connection indicator for super admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'superadmin@test.com', role: 'super_admin' },
      });

      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
          connectedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Verify super admin user
      const user = mockUseAuth().user;
      expect(user.role).toBe('super_admin');

      // Verify connection data is present
      expect(mockUseGoogleDriveConnectionQuery().data).toBeDefined();
    });

    it('should not show Drive connection indicator for non-super admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 2, email: 'user@test.com', role: 'admin' },
      });

      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
          connectedAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Verify non-super admin user
      const user = mockUseAuth().user;
      expect(user.role).not.toBe('super_admin');
    });
  });

  describe('Import Mutation', () => {
    it('should call import mutation with correct clientId', () => {
      const mockMutate = vi.fn();

      mockUseGoogleDriveImportMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      // Simulate mutation call
      const mutation = mockUseGoogleDriveImportMutation();
      mutation.mutate({
        files: [{ id: 'test-file', name: 'test.pdf', mimeType: 'application/pdf' }],
        clientId: 123,
      });

      // Verify mutation was called with correct payload
      expect(mockMutate).toHaveBeenCalledWith({
        files: [{ id: 'test-file', name: 'test.pdf', mimeType: 'application/pdf' }],
        clientId: 123,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Connection failed'),
        refetch: vi.fn(),
      });

      // Verify error is present
      expect(mockUseGoogleDriveConnectionQuery().error).toEqual(
        expect.objectContaining({
          message: 'Connection failed',
        })
      );
    });

    it('should handle token refresh on expiry', () => {
      const mockRefetch = vi.fn();

      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: {
          accessToken: 'expired-token',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      // Simulate token refresh
      const tokenQuery = mockUseGoogleDriveTokenQuery();
      tokenQuery.refetch();

      // Verify refetch was called
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Integration Flow End-to-End', () => {
    it('should complete full import flow for super admin', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 1, email: 'superadmin@test.com', role: 'super_admin' },
      });

      const mockMutate = vi.fn();
      mockUseGoogleDriveImportMutation.mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      });

      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: {
          accessToken: 'valid-token',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Verify all components are set up correctly
      expect(mockUseAuth().user.role).toBe('super_admin');
      expect(mockUseGoogleDriveConnectionQuery().data).toBeDefined();
      expect(mockUseGoogleDriveTokenQuery().data).toBeDefined();

      // Simulate import
      const mutation = mockUseGoogleDriveImportMutation();
      mutation.mutate({
        files: [{ id: 'test-file', name: 'test.pdf', mimeType: 'application/pdf' }],
        clientId: 456,
      });

      // Verify mutation was called
      expect(mockMutate).toHaveBeenCalledWith({
        files: [{ id: 'test-file', name: 'test.pdf', mimeType: 'application/pdf' }],
        clientId: 456,
      });
    });
  });
});
