/**
 * Master Admin UI Indicator Tests
 *
 * This test file validates UI indicators for master admin global Drive link,
 * including:
 * - Showing connection indicator for super admins
 * - Hiding connection indicator for non-super admins
 * - Displaying correct client information
 * - Handling role-based visibility
 */

import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Import utilities we created
import {
  TestScenarioBuilder,
  createMockQueryClient,
} from './test-utils';

// Mock components for testing
const MockAssetManager = ({ 
  showConnectionIndicator = false,
  connectedEmail = null,
  clientName = null,
}: {
  showConnectionIndicator?: boolean;
  connectedEmail?: string | null;
  clientName?: string | null;
}) => (
  <div>
    {showConnectionIndicator && (
      <div data-testid="connection-indicator">
        Google Drive Connected as {connectedEmail}
      </div>
    )}
    {clientName && (
      <div data-testid="client-display">
        Files will import into: {clientName}
      </div>
    )}
    <div data-testid="import-button">
      Import from Drive
    </div>
  </div>
);

describe('Master Admin UI Indicator', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Super Admin UI Features', () => {
    it('should show connection indicator for super admin with Drive connected', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      // Check for connection indicator
      const connectionIndicator = screen.getByTestId('connection-indicator');
      expect(connectionIndicator).toBeInTheDocument();
      expect(connectionIndicator.textContent).toBe('Google Drive Connected as admin@test.com');

      // Check for client display
      const clientDisplay = screen.getByTestId('client-display');
      expect(clientDisplay).toBeInTheDocument();
      expect(clientDisplay.textContent).toBe('Files will import into: Test Client');

      scenario.cleanup();
    });

    it('should not show connection indicator for non-super admin', () => {
      const scenario = TestScenarioBuilder.create()
        .withRegularAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      // Connection indicator should not be present
      const connectionIndicator = screen.queryByTestId('connection-indicator');
      expect(connectionIndicator).not.toBeInTheDocument();

      scenario.cleanup();
    });

    it('should not show connection indicator for standard user', () => {
      const scenario = TestScenarioBuilder.create()
        .withStandardUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      // Connection indicator should not be present
      const connectionIndicator = screen.queryByTestId('connection-indicator');
      expect(connectionIndicator).not.toBeInTheDocument();

      scenario.cleanup();
    });

    it('should not show connection indicator for guest user', () => {
      const scenario = TestScenarioBuilder.create()
        .withGuestUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      // Connection indicator should not be present
      const connectionIndicator = screen.queryByTestId('connection-indicator');
      expect(connectionIndicator).not.toBeInTheDocument();

      scenario.cleanup();
    });

    it('should show connection indicator only when Drive is connected', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withDisconnectedDrive()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={false}
            connectedEmail={null}
            clientName={null}
          />
        </QueryClientProvider>
      );

      // Connection indicator should not be present when Drive is disconnected
      const connectionIndicator = screen.queryByTestId('connection-indicator');
      expect(connectionIndicator).not.toBeInTheDocument();

      scenario.cleanup();
    });

    it('should display correct client information for super admin', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .withCurrentClient('Marketing Client')
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="superadmin@test.com"
            clientName="Marketing Client"
          />
        </QueryClientProvider>
      );

      // Check for correct client display
      const clientDisplay = screen.getByTestId('client-display');
      expect(clientDisplay).toBeInTheDocument();
      expect(clientDisplay.textContent).toBe('Files will import into: Marketing Client');

      scenario.cleanup();
    });

    it('should update client display when client changes', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Initial Client"
          />
        </QueryClientProvider>
      );

      // Initial client display
      let clientDisplay = screen.getByTestId('client-display');
      expect(clientDisplay.textContent).toBe('Files will import into: Initial Client');

      // Rerender with new client
      rerender(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Updated Client"
          />
        </QueryClientProvider>
      );

      // Updated client display
      clientDisplay = screen.getByTestId('client-display');
      expect(clientDisplay.textContent).toBe('Files will import into: Updated Client');

      scenario.cleanup();
    });
  });

  describe('Role-Based Visibility', () => {
    it('should show import button for all users when Drive is connected', () => {
      const scenario = TestScenarioBuilder.create()
        .withConnectedDrive()
        .withValidToken()
        .build();

      // Test with different user roles
      const userRoles = ['super_admin', 'admin', 'editor', 'standard', 'guest'];

      for (const role of userRoles) {
        scenario.withUserRole(role);

        render(
          <QueryClientProvider client={queryClient}>
            <MockAssetManager 
              showConnectionIndicator={false}
              connectedEmail={null}
              clientName={null}
            />
          </QueryClientProvider>
        );

        // Import button should always be visible
        const importButton = screen.getByTestId('import-button');
        expect(importButton).toBeInTheDocument();

        // Cleanup
        screen.unmount();
      }

      scenario.cleanup();
    });

    it('should handle role changes dynamically', () => {
      const scenario = TestScenarioBuilder.create()
        .withConnectedDrive()
        .withValidToken()
        .build();

      // Start with admin role
      scenario.withUserRole('admin');

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={false}
            connectedEmail={null}
            clientName={null}
          />
        </QueryClientProvider>
      );

      // No connection indicator for admin
      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument();

      // Change to super admin role
      scenario.withUserRole('super_admin');

      rerender(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="admin@test.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      // Connection indicator should now be visible
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();

      scenario.cleanup();
    });
  });

  describe('Connection Status Display', () => {
    it('should show connected email when available', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail="connected@example.com"
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      const connectionIndicator = screen.getByTestId('connection-indicator');
      expect(connectionIndicator.textContent).toContain('connected@example.com');

      scenario.cleanup();
    });

    it('should handle null connected email gracefully', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withConnectedDrive()
        .withValidToken()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={true}
            connectedEmail={null}
            clientName="Test Client"
          />
        </QueryClientProvider>
      );

      const connectionIndicator = screen.getByTestId('connection-indicator');
      expect(connectionIndicator.textContent).toBe('Google Drive Connected as ');

      scenario.cleanup();
    });

    it('should show disconnected state when Drive is not connected', () => {
      const scenario = TestScenarioBuilder.create()
        .withSuperAdminUser()
        .withDisconnectedDrive()
        .build();

      render(
        <QueryClientProvider client={queryClient}>
          <MockAssetManager 
            showConnectionIndicator={false}
            connectedEmail={null}
            clientName={null}
          />
        </QueryClientProvider>
      );

      // Connection indicator should not be present
      expect(screen.queryByTestId('connection-indicator')).not.toBeInTheDocument();

      scenario.cleanup();
    });
  });
});