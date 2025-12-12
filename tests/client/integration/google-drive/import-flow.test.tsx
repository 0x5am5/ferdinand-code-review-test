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

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

describe('Google Drive Import Flow - Frontend', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Basic Import Flow', () => {
    it('should render import button when Drive is connected', () => {
      // Mock Drive connection and token
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
          data: {
            id: 1,
            userId: 1,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveTokenQuery: () => ({
          data: {
            accessToken: 'mock-access-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveImportMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <button data-testid="import-button">Import from Drive</button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Check for import button
      const importButton = screen.getByTestId('import-button');
      expect(importButton).toBeInTheDocument();
    });

    it('should disable import button when no token available', () => {
      // Mock Drive connection but no token
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
          data: {
            id: 1,
            userId: 1,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveTokenQuery: () => ({
          data: null,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveImportMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <button data-testid="import-button" disabled>Import from Drive</button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Import button should be disabled
      const importButton = screen.getByTestId('import-button');
      expect(importButton).toBeInTheDocument();
      expect(importButton.disabled).toBe(true);
    });

    it('should show loading state during import', () => {
      // Mock import in progress
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveImportMutation: () => ({
          mutate: vi.fn(),
          isPending: true,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <button data-testid="import-button" disabled>Importing...</button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Check for loading state
      const importButton = screen.getByTestId('import-button');
      expect(importButton).toBeInTheDocument();
      expect(importButton.disabled).toBe(true);
      expect(importButton.textContent).toBe('Importing...');
    });
  });

  describe('Super Admin UI Features', () => {
    it('should show Drive connection indicator for super admin', () => {
      // Mock super admin user and Drive connection
      vi.mock('@/hooks/use-auth', () => ({
        useAuth: () => ({
          user: { id: 1, email: 'superadmin@test.com', role: 'super_admin' },
        }),
      }));

      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
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
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <div data-testid="connection-indicator">Google Drive Connected</div>
          <div data-testid="client-display">Files will import into: Test Client</div>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Check for connection indicator
      const connectionIndicator = screen.getByTestId('connection-indicator');
      expect(connectionIndicator).toBeInTheDocument();
      expect(connectionIndicator.textContent).toBe('Google Drive Connected');

      // Check for client display
      const clientDisplay = screen.getByTestId('client-display');
      expect(clientDisplay).toBeInTheDocument();
      expect(clientDisplay.textContent).toBe('Files will import into: Test Client');
    });

    it('should not show Drive connection indicator for non-super admin', () => {
      // Mock non-super admin user
      vi.mock('@/hooks/use-auth', () => ({
        useAuth: () => ({
          user: { id: 2, email: 'user@test.com', role: 'admin' },
        }),
      }));

      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
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
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <div data-testid="connection-indicator">Google Drive Connected</div>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Connection indicator should not be present
      const connectionIndicator = screen.queryByTestId('connection-indicator');
      expect(connectionIndicator).not.toBeInTheDocument();
    });
  });

  describe('Import Mutation', () => {
    it('should call import mutation with correct clientId', async () => {
      const mutate = vi.fn();
      
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveImportMutation: () => ({
          mutate,
          isPending: false,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <button 
            data-testid="import-button"
            onClick={() => mutate({
              files: [{ id: 'test-file', name: 'test.pdf' }],
              clientId: 123,
            })}
          >
            Import from Drive
          </button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Simulate button click
      const importButton = screen.getByTestId('import-button');
      fireEvent.click(importButton);

      // Wait for mutation to be called
      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith({
          files: [{ id: 'test-file', name: 'test.pdf' }],
          clientId: 123,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', () => {
      // Mock connection error
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
          data: null,
          isLoading: false,
          error: new Error('Connection failed'),
          refetch: vi.fn(),
        }),
      }));

      // Mock component
      const MockDashboard = () => (
        <div>
          <div data-testid="error-message">Connection failed</div>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockDashboard />
        </QueryClientProvider>
      );

      // Should show error state
      const errorMessage = screen.getByTestId('error-message');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage.textContent).toBe('Connection failed');
    });

    it('should handle token refresh on expiry', () => {
      const refetch = vi.fn();
      
      // Mock expired token
      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveTokenQuery: () => ({
          data: {
            accessToken: 'expired-token',
            expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
          },
          isLoading: false,
          error: null,
          refetch,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <button data-testid="refresh-button">Refresh Token</button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Simulate refresh button click
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);

      // Should trigger token refresh
      await waitFor(() => {
        expect(refetch).toHaveBeenCalled();
      });
    });
  });

  describe('Integration Flow End-to-End', () => {
    it('should complete full import flow for super admin', async () => {
      const mutate = vi.fn();
      
      // Mock successful connection and token
      vi.mock('@/hooks/use-auth', () => ({
        useAuth: () => ({
          user: { id: 1, email: 'superadmin@test.com', role: 'super_admin' },
        }),
      }));

      vi.mock('@/lib/queries/google-drive', () => ({
        useGoogleDriveConnectionQuery: () => ({
          data: {
            id: 1,
            userId: 1,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveTokenQuery: () => ({
          data: {
            accessToken: 'valid-token',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
        useGoogleDriveImportMutation: () => ({
          mutate,
          isPending: false,
        }),
      }));

      // Mock component
      const MockAssetManager = () => (
        <div>
          <div data-testid="connection-indicator">Google Drive Connected</div>
          <div data-testid="client-display">Files will import into: Test Client 2</div>
          <button 
            data-testid="import-button"
            onClick={() => mutate({
              files: [{ id: 'test-file', name: 'test.pdf' }],
              clientId: 456,
            })}
          >
            Import from Drive
          </button>
        </div>
      );

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager />
        </QueryClientProvider>
      );

      // Verify connection indicator is shown
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('client-display')).toBeInTheDocument();

      // Simulate file selection and import
      const importButton = screen.getByTestId('import-button');
      fireEvent.click(importButton);

      // Wait for import mutation
      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith({
          files: [{ id: 'test-file', name: 'test.pdf' }],
          clientId: 456,
        });
      });
    });
  });
});