import { render, screen } from "@testing-library/react";
import { UserRole } from "../../shared/schema";
import { AssetManager } from "../../client/src/components/brand/asset-manager";

// Mock the modules that would cause import issues
jest.mock("../../client/src/hooks/use-auth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../../client/src/lib/queries/clients", () => ({
  useClientsQuery: jest.fn(),
}));

jest.mock("../../client/src/lib/queries/google-drive", () => ({
  useGoogleDriveConnectionQuery: jest.fn(),
}));

jest.mock("../../client/src/lib/queries/assets", () => ({
  useAssetCategoriesQuery: () => ({ data: [] }),
  useAssetTagsQuery: () => ({ data: [] }),
  useBulkDeleteAssetsMutation: () => ({ mutateAsync: jest.fn() }),
  useBulkUpdateAssetsMutation: () => ({ mutateAsync: jest.fn() }),
  useDeleteAssetMutation: () => ({ mutateAsync: jest.fn() }),
}));

import { useAuth } from "../../client/src/hooks/use-auth";
import { useClientsQuery } from "../../client/src/lib/queries/clients";
import { useGoogleDriveConnectionQuery } from "../../client/src/lib/queries/google-drive";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseClientsQuery = useClientsQuery as jest.MockedFunction<typeof useClientsQuery>;
const mockUseGoogleDriveConnectionQuery = useGoogleDriveConnectionQuery as jest.MockedFunction<typeof useGoogleDriveConnectionQuery>;

describe("AssetManager - Google Drive UI Indicator", () => {
  const mockClientId = 123;

  beforeEach(() => {
    jest.clearAllMocks();
    
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
      refetch: jest.fn(),
    });
  });

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={999} />);

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
      refetch: jest.fn(),
    });

    render(<AssetManager clientId={mockClientId} />);

    expect(screen.getByText("Google Drive Connected")).toBeInTheDocument();
    expect(screen.queryByText(/Account:/)).not.toBeInTheDocument();
    expect(screen.getByText("Files will import into: Test Client")).toBeInTheDocument();
  });
});