/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { UserRole } from "@shared/schema";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom";
import { AssetManager } from "@/components/brand/asset-manager";
import { RoleSwitchingProvider } from "@/contexts/role-switching-context";
import { createMockQueryClient } from "../../test-utils";

// Mock the modules that would cause import issues
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/queries/clients", () => ({
  useClientsQuery: vi.fn(),
}));

vi.mock("@/lib/queries/google-drive", () => ({
  useGoogleDriveConnectionQuery: vi.fn(),
  useGoogleDriveTokenQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
  useGoogleDriveImportMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })),
  useGoogleDriveConnectMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })),
  useGoogleDriveDisconnectMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })),
  useGoogleDriveOAuthCallback: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { useClientsQuery } from "@/lib/queries/clients";
import { useGoogleDriveConnectionQuery } from "@/lib/queries/google-drive";

const mockUseAuth = useAuth as MockedFunction<typeof useAuth>;
const mockUseClientsQuery = useClientsQuery as MockedFunction<typeof useClientsQuery>;
const mockUseGoogleDriveConnectionQuery = useGoogleDriveConnectionQuery as MockedFunction<typeof useGoogleDriveConnectionQuery>;

describe("AssetManager - Google Drive UI Indicator", () => {
  const mockClientId = 123;
  let queryClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createMockQueryClient();

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        role: UserRole.STANDARD,
      },
    });

    mockUseClientsQuery.mockReturnValue({
      data: [
        { id: mockClientId, name: "Test Client" },
        { id: 456, name: "Another Client" },
      ],
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  const renderAssetManager = (clientId: number) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RoleSwitchingProvider>
          <AssetManager clientId={clientId} />
        </RoleSwitchingProvider>
      </QueryClientProvider>
    );
  };

  it("should not show Google Drive indicator for non-super-admin users", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "admin@example.com",
        name: "Admin User",
        role: UserRole.ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 1,
        userEmail: "admin@example.com",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.queryByText("Google Drive Connected")).not.toBeInTheDocument();
  });

  it("should not show Google Drive indicator for super-admin without connection", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.queryByText("Google Drive Connected")).not.toBeInTheDocument();
  });

  it("should show Google Drive indicator for super-admin with connection", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 1,
        userEmail: "superadmin@example.com",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.getByText("Account: superadmin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Files will import into: Test Client")).toBeInTheDocument();
  });

  it("should show 'You' instead of email when connected account belongs to current user", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 1, // Same as current user
        userEmail: "superadmin@example.com",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.getByText("Account: You")).toBeInTheDocument();
    expect(screen.getByText("Files will import into: Test Client")).toBeInTheDocument();
  });

  it("should show user ID when email is not available", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 2, // Different user
        userEmail: null, // No email available
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.getByText("Account: User 2")).toBeInTheDocument();
    expect(screen.getByText("Files will import into: Test Client")).toBeInTheDocument();
  });

  it("should show correct client name for import target", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseClientsQuery.mockReturnValue({
      data: [
        { id: 999, name: "Different Client" }, // This should be selected
        { id: mockClientId, name: "Test Client" },
      ],
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 1,
        userEmail: "superadmin@example.com",
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(999);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.getByText("Account: superadmin@example.com")).toBeInTheDocument();
    expect(screen.getByText("Files will import into: Different Client")).toBeInTheDocument();
  });

  it("should not show account info when scopes don't include drive.readonly", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "superadmin@example.com",
        name: "Super Admin",
        role: UserRole.SUPER_ADMIN,
      },
    });

    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: {
        id: 1,
        userId: 1,
        userEmail: "superadmin@example.com",
        scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"], // Missing drive.readonly
        connectedAt: new Date(),
        lastUsedAt: null,
      },
      isLoading: false,
      refetch: vi.fn(),
    });

    renderAssetManager(mockClientId);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.queryByText(/Account:/)).not.toBeInTheDocument();
    expect(screen.getByText("Files will import into: Test Client")).toBeInTheDocument();
  });
});