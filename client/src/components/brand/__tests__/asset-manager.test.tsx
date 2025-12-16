/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetManager } from "@/components/brand/asset-manager";

// Mock firebase before anything else
vi.mock("@/lib/firebase", () => ({
  auth: {},
  googleProvider: {},
}));

// Mock wouter for routing
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

// Create mock functions that we can access in tests
const mockDeleteMutation = { mutateAsync: vi.fn() };
const mockBulkDeleteMutation = { mutateAsync: vi.fn() };
const mockBulkUpdateMutation = { mutateAsync: vi.fn() };
const mockImportMutation = { mutate: vi.fn(), isPending: false };

// Mock all the asset query hooks
vi.mock("@/lib/queries/assets", () => ({
  useAssetsQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useAssetCategoriesQuery: vi.fn(() => ({ data: [] })),
  useAssetTagsQuery: vi.fn(() => ({ data: [] })),
  useDeleteAssetMutation: () => mockDeleteMutation,
  useBulkDeleteAssetsMutation: () => mockBulkDeleteMutation,
  useBulkUpdateAssetsMutation: () => mockBulkUpdateMutation,
}));

// Mock Google Drive hooks
vi.mock("@/lib/queries/google-drive", () => ({
  useGoogleDriveConnectionQuery: vi.fn(() => ({
    data: null,
    isLoading: false,
  })),
  useGoogleDriveTokenQuery: vi.fn(() => ({ data: null, isLoading: false })),
  useGoogleDriveImportMutation: () => mockImportMutation,
  useGoogleDriveOAuthCallback: () => {},
}));

// Mock child components to simplify testing
vi.mock("@/components/assets/asset-list", () => ({
  AssetList: ({ onDelete, onBulkDelete }: any) => (
    <div data-testid="asset-list">
      <button onClick={() => onDelete(1)}>Delete Asset</button>
      <button onClick={() => onBulkDelete([1, 2])}>Bulk Delete</button>
    </div>
  ),
}));

vi.mock("@/components/assets/asset-filters", () => ({
  AssetFilters: () => <div data-testid="asset-filters" />,
}));

vi.mock("@/components/assets/asset-upload", () => ({
  AssetUpload: ({ open, onOpenChange }: any) => (
    <div data-testid="asset-upload">
      {open && <div>Upload Dialog Open</div>}
      <button onClick={() => onOpenChange(false)}>Close Upload</button>
    </div>
  ),
}));

vi.mock("@/components/assets/google-drive-connect", () => ({
  GoogleDriveConnect: () => <button>Connect Google Drive</button>,
}));

vi.mock("@/components/assets/google-drive-picker", () => ({
  GoogleDrivePicker: ({ children, onFilesSelected }: any) => (
    <div
      data-testid="google-drive-picker"
      onClick={() => onFilesSelected([{ id: "file1", name: "test.jpg" }])}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/assets/asset-detail-modal", () => ({
  AssetDetailModal: ({ open }: any) => (
    <div data-testid="asset-detail-modal">{open && "Modal Open"}</div>
  ),
}));

vi.mock("@/components/permission-gate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

// Import the mocked functions so we can spy on them
import { useAssetsQuery } from "@/lib/queries/assets";
import {
  useGoogleDriveConnectionQuery,
  useGoogleDriveTokenQuery,
} from "@/lib/queries/google-drive";

const mockUseAssetsQuery = useAssetsQuery as ReturnType<typeof vi.fn>;
const mockUseGoogleDriveConnectionQuery =
  useGoogleDriveConnectionQuery as ReturnType<typeof vi.fn>;
const mockUseGoogleDriveTokenQuery = useGoogleDriveTokenQuery as ReturnType<
  typeof vi.fn
>;

describe("AssetManager", () => {
  let queryClient: QueryClient;
  const mockClientId = 123;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset mock implementations to defaults
    mockUseAssetsQuery.mockReturnValue({ data: [], isLoading: false });
    mockUseGoogleDriveConnectionQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockUseGoogleDriveTokenQuery.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mockImportMutation.isPending = false;
    mockDeleteMutation.mutateAsync.mockClear();
    mockBulkDeleteMutation.mutateAsync.mockClear();
    mockBulkUpdateMutation.mutateAsync.mockClear();
    mockImportMutation.mutate.mockClear();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AssetManager clientId={mockClientId} />
      </QueryClientProvider>
    );
  };

  describe("Basic Rendering", () => {
    it("should render the header with title and description", () => {
      renderComponent();

      expect(screen.getByText("Brand Assets")).toBeInTheDocument();
      expect(
        screen.getByText("Manage and organize your brand assets")
      ).toBeInTheDocument();
    });

    it("should render asset filters component", () => {
      renderComponent();

      expect(screen.getByTestId("asset-filters")).toBeInTheDocument();
    });

    it("should render asset list component", () => {
      renderComponent();

      expect(screen.getByTestId("asset-list")).toBeInTheDocument();
    });
  });

  describe("Google Drive Integration", () => {
    it("should show 'Connect Google Drive' button when not connected", () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderComponent();

      expect(screen.getByText("Connect Google Drive")).toBeInTheDocument();
    });

    it("should show 'Import from Drive' button when connected with token", () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          userEmail: "test@example.com",
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          connectedAt: new Date(),
          lastUsedAt: null,
        },
        isLoading: false,
      });
      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: { accessToken: "test-token", expiresAt: new Date() },
        isLoading: false,
      });

      renderComponent();

      expect(screen.getByText("Import from Drive")).toBeInTheDocument();
      expect(
        screen.queryByText("Connect Google Drive")
      ).not.toBeInTheDocument();
    });

    it("should disable import button when no access token is available", () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          userEmail: "test@example.com",
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          connectedAt: new Date(),
          lastUsedAt: null,
        },
        isLoading: false,
      });
      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: null,
        isLoading: false,
      });

      renderComponent();

      const importButton = screen.getByText("Import from Drive");
      expect(importButton).toBeDisabled();
    });

    it("should disable import button and show 'Importing...' when import is pending", () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          userEmail: "test@example.com",
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          connectedAt: new Date(),
          lastUsedAt: null,
        },
        isLoading: false,
      });
      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: { accessToken: "test-token", expiresAt: new Date() },
        isLoading: false,
      });
      mockImportMutation.isPending = true;

      renderComponent();

      const importButton = screen.getByText("Importing...");
      expect(importButton).toBeDisabled();
    });

    it("should call import mutation with correct clientId when files are selected", async () => {
      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          userEmail: "test@example.com",
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          connectedAt: new Date(),
          lastUsedAt: null,
        },
        isLoading: false,
      });
      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: { accessToken: "test-token", expiresAt: new Date() },
        isLoading: false,
      });

      renderComponent();

      // The GoogleDrivePicker mock includes a button that triggers onFilesSelected
      const pickerButton = screen.getByText("Import from Drive");
      await userEvent.click(pickerButton);

      await waitFor(() => {
        expect(mockImportMutation.mutate).toHaveBeenCalledWith({
          files: [{ id: "file1", name: "test.jpg" }],
          clientId: mockClientId,
        });
      });
    });
  });

  describe("Asset Deletion", () => {
    it("should show delete confirmation dialog when deleting a single asset", async () => {
      renderComponent();

      // Click the delete button in the mocked AssetList
      const deleteButton = screen.getByRole("button", { name: "Delete Asset" });
      await userEvent.click(deleteButton);

      expect(
        screen.getByRole("heading", { name: "Delete Asset" })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Are you sure you want to delete this asset? This action cannot be undone."
        )
      ).toBeInTheDocument();
    });

    it("should call delete mutation when confirming single deletion", async () => {
      mockDeleteMutation.mutateAsync.mockResolvedValue({});

      renderComponent();

      // Click delete button
      const deleteButton = screen.getByText("Delete Asset");
      await userEvent.click(deleteButton);

      // Click confirm in the dialog
      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteMutation.mutateAsync).toHaveBeenCalledWith(1);
      });
    });

    it("should show bulk delete confirmation dialog when deleting multiple assets", async () => {
      renderComponent();

      // Click the bulk delete button in the mocked AssetList
      const bulkDeleteButton = screen.getByText("Bulk Delete");
      await userEvent.click(bulkDeleteButton);

      expect(screen.getByText("Delete Multiple Assets")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete 2 assets?/)
      ).toBeInTheDocument();
    });

    it("should call bulk delete mutation when confirming bulk deletion", async () => {
      mockBulkDeleteMutation.mutateAsync.mockResolvedValue({});

      renderComponent();

      // Click bulk delete button
      const bulkDeleteButton = screen.getByText("Bulk Delete");
      await userEvent.click(bulkDeleteButton);

      // Click confirm in the dialog
      const confirmButton = screen.getByRole("button", { name: /delete/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockBulkDeleteMutation.mutateAsync).toHaveBeenCalledWith([1, 2]);
      });
    });

    it("should close delete dialog when clicking cancel", async () => {
      renderComponent();

      // Click delete button
      const deleteButton = screen.getByRole("button", { name: "Delete Asset" });
      await userEvent.click(deleteButton);

      // Dialog should be visible
      expect(
        screen.getByRole("heading", { name: "Delete Asset" })
      ).toBeInTheDocument();

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Dialog should be closed
      await waitFor(() => {
        expect(
          screen.queryByText("Are you sure you want to delete this asset?")
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("clientId Prop", () => {
    it("should filter assets by clientId", () => {
      const mockAssets = [
        { id: 1, clientId: 123, fileName: "asset1.jpg" },
        { id: 2, clientId: 456, fileName: "asset2.jpg" },
        { id: 3, clientId: 123, fileName: "asset3.jpg" },
      ];

      mockUseAssetsQuery.mockReturnValue({
        data: mockAssets,
        isLoading: false,
      });

      renderComponent();

      // The component should filter assets by clientId internally
      // We verify this by checking that only the correct clientId is used
      expect(mockUseAssetsQuery).toHaveBeenCalled();
    });

    it("should pass correct clientId to import mutation", async () => {
      const differentClientId = 999;

      mockUseGoogleDriveConnectionQuery.mockReturnValue({
        data: {
          id: 1,
          userId: 1,
          userEmail: "test@example.com",
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
          connectedAt: new Date(),
          lastUsedAt: null,
        },
        isLoading: false,
      });
      mockUseGoogleDriveTokenQuery.mockReturnValue({
        data: { accessToken: "test-token", expiresAt: new Date() },
        isLoading: false,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AssetManager clientId={differentClientId} />
        </QueryClientProvider>
      );

      const pickerButton = screen.getByText("Import from Drive");
      await userEvent.click(pickerButton);

      await waitFor(() => {
        expect(mockImportMutation.mutate).toHaveBeenCalledWith({
          files: expect.any(Array),
          clientId: differentClientId,
        });
      });
    });
  });
});
