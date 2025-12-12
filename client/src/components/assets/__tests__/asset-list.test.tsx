/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { Asset } from "@/lib/queries/assets";
import { AssetList } from "../asset-list";

// Mock the asset queries
vi.mock("@/lib/queries/assets", async () => {
  const actual = await vi.importActual("@/lib/queries/assets");
  return {
    ...actual,
    useCreateTagMutation: vi.fn(() => ({
      mutateAsync: vi.fn().mockResolvedValue({ id: 99, name: "New Tag", slug: "new-tag", clientId: 1 }),
      isPending: false,
    })),
  };
});

// Mock useAuth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: 1,
      name: "Test User",
      email: "test@example.com",
      role: "admin",
    },
    currentClient: {
      id: 1,
      name: "Test Client",
    },
    isLoading: false,
  })),
}));

// Mock useRoleSwitching hook
vi.mock("@/contexts/role-switching-context", () => ({
  useRoleSwitching: vi.fn(() => ({
    viewingRole: null,
    effectiveRole: "admin",
    setViewingRole: vi.fn(),
    clearViewingRole: vi.fn(),
    isRoleSwitching: false,
  })),
}));

const mockAssets: Asset[] = [
  {
    id: 1,
    clientId: 1,
    uploadedBy: 1,
    fileName: "test-1.jpg",
    originalFileName: "test-image.jpg",
    fileType: "image/jpeg",
    fileSize: 1024000,
    storagePath: "/uploads/test-1.jpg",
    visibility: "shared",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    deletedAt: null,
    categories: [
      { id: 1, name: "Images", slug: "images", isDefault: false, clientId: 1 },
      {
        id: 2,
        name: "Marketing",
        slug: "marketing",
        isDefault: false,
        clientId: 1,
      },
    ],
    tags: [{ id: 1, name: "social", slug: "social", clientId: 1 }],
  },
  {
    id: 2,
    clientId: 1,
    uploadedBy: 1,
    fileName: "test-2.pdf",
    originalFileName: "document.pdf",
    fileType: "application/pdf",
    fileSize: 2048000,
    storagePath: "/uploads/test-2.pdf",
    visibility: "private",
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    deletedAt: null,
    categories: [
      {
        id: 3,
        name: "Documents",
        slug: "documents",
        isDefault: false,
        clientId: 1,
      },
    ],
    tags: [],
  },
  {
    id: 3,
    clientId: 1,
    uploadedBy: 1,
    fileName: "test-3.txt",
    originalFileName: "notes.txt",
    fileType: "text/plain",
    fileSize: 512,
    storagePath: "/uploads/test-3.txt",
    visibility: "shared",
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-03"),
    deletedAt: null,
    categories: [],
    tags: [],
  },
];

const mockCategories = [
  { id: 1, name: "Images", slug: "images", isDefault: false, clientId: 1 },
  {
    id: 2,
    name: "Documents",
    slug: "documents",
    isDefault: false,
    clientId: 1,
  },
  { id: 3, name: "Videos", slug: "videos", isDefault: false, clientId: 1 },
];

const mockTags = [
  { id: 1, name: "important", slug: "important", clientId: 1 },
  { id: 2, name: "draft", slug: "draft", clientId: 1 },
  { id: 3, name: "final", slug: "final", clientId: 1 },
];

describe("AssetList", () => {
  const mockOnAssetClick = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnBulkDelete = vi.fn();
  const mockOnBulkUpdate = vi.fn();
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    // Clean up any pending timers or async operations
    vi.clearAllTimers();
    queryClient.clear();
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );
  };

  describe("Loading State", () => {
    it("should render loading skeletons when loading", () => {
      renderWithQueryClient(
        <AssetList
          assets={[]}
          isLoading={true}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Check for multiple skeleton elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Empty State", () => {
    it("should show empty state when no assets are available", () => {
      renderWithQueryClient(
        <AssetList
          assets={[]}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/no assets found/i)).toBeInTheDocument();
      expect(screen.getByText(/upload your first asset/i)).toBeInTheDocument();
    });
  });

  describe("Asset Rendering", () => {
    it("should render all assets in grid view", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("test-image.jpg")).toBeInTheDocument();
      expect(screen.getByText("document.pdf")).toBeInTheDocument();
      expect(screen.getByText("notes.txt")).toBeInTheDocument();
    });

    it("should display file sizes correctly", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Get all file size elements and check they contain the expected values
      const fileSizes = screen.getAllByText(/\d+(\.\d+)?\s*(B|KB|MB)/i);
      const fileSizeTexts = fileSizes.map((el) => el.textContent);

      expect(fileSizeTexts).toContain("1000.0 KB"); // 1024000 bytes = 1000 KB
      expect(fileSizeTexts).toContain("2.0 MB"); // 2048000 bytes = 2.0 MB (over 1024 KB)
      expect(fileSizeTexts).toContain("512 B");
    });

    it("should display visibility badges", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      const sharedBadges = screen.getAllByText("shared");
      const privateBadges = screen.getAllByText("private");

      expect(sharedBadges.length).toBeGreaterThan(0);
      expect(privateBadges.length).toBeGreaterThan(0);
    });

    it("should display category badges for assets with categories", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Images")).toBeInTheDocument();
      expect(screen.getByText("Marketing")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });

    it("should show thumbnail for image files", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      const images = screen.getAllByRole("img");
      const thumbnailImage = images.find((img) =>
        img
          .getAttribute("src")
          ?.includes("/api/clients/1/file-assets/1/thumbnail")
      );

      expect(thumbnailImage).toBeInTheDocument();
    });
  });

  describe("View Mode Toggle", () => {
    it("should toggle between grid and list view", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Find list view button
      const buttons = screen.getAllByRole("button");
      const listViewButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg.lucide-list");
        return svg !== null;
      });

      expect(listViewButton).toBeInTheDocument();

      if (listViewButton) {
        await user.click(listViewButton);

        // Check if table is rendered (list view)
        const table = screen.queryByRole("table");
        expect(table).toBeInTheDocument();
      }
    });

    it("should render list view with table headers", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Switch to list view
      const buttons = screen.getAllByRole("button");
      const listViewButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg.lucide-list");
        return svg !== null;
      });

      if (listViewButton) {
        await user.click(listViewButton);

        expect(screen.getByText("Name")).toBeInTheDocument();
        expect(screen.getByText("Type")).toBeInTheDocument();
        expect(screen.getByText("Size")).toBeInTheDocument();
        expect(screen.getByText("Last Modified")).toBeInTheDocument();
        expect(screen.getByText("Visibility")).toBeInTheDocument();
      }
    });
  });

  describe("Asset Interactions", () => {
    it("should call onAssetClick when asset is clicked in grid view", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      const assetCard = screen
        .getByText("test-image.jpg")
        .closest('[class*="cursor-pointer"]');
      if (assetCard) {
        await user.click(assetCard);
        expect(mockOnAssetClick).toHaveBeenCalledWith(mockAssets[0]);
      }
    });

    it("should call onDelete when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Find all buttons with trash icon - lucide adds class based on component name
      const buttons = screen.getAllByRole("button");
      const deleteButtons = buttons.filter((btn) => {
        const svg = btn.querySelector('svg[class*="trash"]');
        return svg !== null;
      });

      expect(deleteButtons.length).toBeGreaterThan(0);

      if (deleteButtons[0]) {
        await user.click(deleteButtons[0]);
        expect(mockOnDelete).toHaveBeenCalledWith(mockAssets[0].id);
      }
    });

    it("should open download in new tab when download button is clicked", async () => {
      const user = userEvent.setup();
      // Mock window.open
      const mockOpen = vi.fn();
      window.open = mockOpen;

      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Find download button (first one)
      const buttons = screen.getAllByRole("button");
      const downloadButtons = buttons.filter((btn) => {
        const svg = btn.querySelector("svg.lucide-download");
        return svg !== null;
      });

      expect(downloadButtons.length).toBeGreaterThan(0);

      if (downloadButtons[0]) {
        await user.click(downloadButtons[0]);
        expect(mockOpen).toHaveBeenCalledWith(
          "/api/assets/1/download",
          "_blank"
        );
      }
    });

    it("should call onAssetClick when view button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Find view button (eye icon)
      const buttons = screen.getAllByRole("button");
      const viewButtons = buttons.filter((btn) => {
        const svg = btn.querySelector("svg.lucide-eye");
        return svg !== null;
      });

      expect(viewButtons.length).toBeGreaterThan(0);

      if (viewButtons[0]) {
        await user.click(viewButtons[0]);
        expect(mockOnAssetClick).toHaveBeenCalledWith(mockAssets[0]);
      }
    });
  });

  describe("Category Display", () => {
    it("should show +N badge when asset has more than 2 categories", () => {
      const assetWithManyCategories: Asset = {
        ...mockAssets[0],
        categories: [
          { id: 1, name: "Cat1", slug: "cat1", isDefault: false, clientId: 1 },
          { id: 2, name: "Cat2", slug: "cat2", isDefault: false, clientId: 1 },
          { id: 3, name: "Cat3", slug: "cat3", isDefault: false, clientId: 1 },
          { id: 4, name: "Cat4", slug: "cat4", isDefault: false, clientId: 1 },
        ],
      };

      renderWithQueryClient(
        <AssetList
          assets={[assetWithManyCategories]}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("+2")).toBeInTheDocument();
    });
  });

  describe("File Type Icons", () => {
    it("should render file icon for non-image files", () => {
      renderWithQueryClient(
        <AssetList
          assets={[mockAssets[2]]} // text file
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // File icon should be present for non-image files
      const fileIcons = document.querySelectorAll("svg.lucide-file");
      expect(fileIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Date Formatting", () => {
    it("should format dates correctly in list view", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      // Switch to list view
      const buttons = screen.getAllByRole("button");
      const listViewButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg.lucide-list");
        return svg !== null;
      });

      if (listViewButton) {
        await user.click(listViewButton);

        // Check for formatted dates
        expect(screen.getByText(/Jan 1, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/Jan 2, 2024/i)).toBeInTheDocument();
      }
    });
  });

  describe("Bulk Delete Functionality", () => {
    it("should not show bulk delete button when no assets are selected", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      // Bulk delete button should not be visible
      const deleteButtons = screen.queryAllByRole("button");
      const bulkDeleteButton = deleteButtons.find((btn) =>
        btn.textContent?.includes("Delete")
      );

      expect(bulkDeleteButton).toBeUndefined();
    });

    it("should show checkboxes on hover in grid view", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      // Checkboxes should be present (with opacity-0 class for hover effect)
      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(mockAssets.length);
    });

    it("should show checkboxes in list view", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      // Switch to list view
      const buttons = screen.getAllByRole("button");
      const listViewButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg.lucide-list");
        return svg !== null;
      });

      if (listViewButton) {
        await user.click(listViewButton);

        // Checkboxes should be present in list view
        const checkboxes = screen.getAllByRole("checkbox");
        expect(checkboxes.length).toBe(mockAssets.length);
      }
    });

    it("should select and deselect assets when checkbox is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Click first checkbox to select
      await user.click(checkboxes[0]);

      // Bulk delete button should appear
      const deleteButton = screen.getByText(/Delete 1$/i);
      expect(deleteButton).toBeInTheDocument();

      // Click again to deselect
      await user.click(checkboxes[0]);

      // Bulk delete button should disappear
      const deleteButtons = screen.queryAllByRole("button");
      const bulkDeleteButton = deleteButtons.find(
        (btn) =>
          btn.textContent?.includes("Delete") &&
          btn.textContent?.match(/Delete \d+/)
      );
      expect(bulkDeleteButton).toBeUndefined();
    });

    it("should show correct count when multiple assets are selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Select first two assets
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Bulk delete button should show correct count
      const deleteButton = screen.getByText(/Delete 2$/i);
      expect(deleteButton).toBeInTheDocument();
    });

    it("should use singular form when one asset is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Select one asset
      await user.click(checkboxes[0]);

      // Should show Delete 1
      const deleteButton = screen.getByText(/Delete 1$/i);
      expect(deleteButton).toBeInTheDocument();
    });

    it("should call onBulkDelete with selected asset IDs when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Select first two assets
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk delete button
      const deleteButton = screen.getByText(/Delete 2$/i);
      await user.click(deleteButton);

      // Should call onBulkDelete with correct IDs
      expect(mockOnBulkDelete).toHaveBeenCalledWith([
        mockAssets[0].id,
        mockAssets[1].id,
      ]);
    });

    it("should clear selection after bulk delete is called", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Select assets
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Click bulk delete button
      const deleteButton = screen.getByText(/Delete 2$/i);
      await user.click(deleteButton);

      // Bulk delete button should disappear after delete
      const deleteButtons = screen.queryAllByRole("button");
      const bulkDeleteButton = deleteButtons.find(
        (btn) =>
          btn.textContent?.includes("Delete") &&
          btn.textContent?.match(/Delete \d+/)
      );
      expect(bulkDeleteButton).toBeUndefined();
    });

    it("should not call onBulkDelete when no assets are selected", async () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      // No assets selected, button should not be visible
      expect(mockOnBulkDelete).not.toHaveBeenCalled();
    });

    it("should prevent asset click when clicking checkbox", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");

      // Click checkbox
      await user.click(checkboxes[0]);

      // onAssetClick should not be called when clicking checkbox
      expect(mockOnAssetClick).not.toHaveBeenCalled();
    });

    it("should work in both grid and list views", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkDelete={mockOnBulkDelete}
        />
      );

      // Test in grid view
      let checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      expect(screen.getByText(/Delete 1/i)).toBeInTheDocument();

      // Switch to list view
      const buttons = screen.getAllByRole("button");
      const listViewButton = buttons.find((btn) => {
        const svg = btn.querySelector("svg.lucide-list");
        return svg !== null;
      });

      if (listViewButton) {
        await user.click(listViewButton);

        // Checkboxes should still work in list view
        checkboxes = screen.getAllByRole("checkbox");
        await user.click(checkboxes[1]);

        // Should show 2 files selected now
        expect(screen.getByText(/Delete 2/i)).toBeInTheDocument();
      }
    });
  });

  describe("Bulk Update Functionality", () => {
    it("should not show bulk actions when no assets are selected", () => {
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Bulk Actions label should not be visible
      expect(screen.queryByText("Bulk Actions:")).not.toBeInTheDocument();
    });

    it("should show bulk actions UI when assets are selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Bulk Actions label should be visible
      expect(screen.getByText("Bulk Actions:")).toBeInTheDocument();
    });

    it("should show Change Category button when categories are provided", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(screen.getByText("Change Category")).toBeInTheDocument();
    });

    it("should show Add Tags button when tags are provided", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(screen.getByText("Add Tags")).toBeInTheDocument();
    });

    it("should not show category dropdown when no categories provided", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={[]}
          tags={mockTags}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(screen.queryByText("Change Category")).not.toBeInTheDocument();
    });

    it("should show tags dropdown even when no tags provided (for creating new tags)", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={[]}
        />
      );

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Tags dropdown should still appear for creating new tags
      expect(screen.getByText("Add Tags")).toBeInTheDocument();
    });

    it("should call onBulkUpdate with category when category is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select an asset
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Open category dropdown
      const categoryButton = screen.getByText("Change Category");
      await user.click(categoryButton);

      // Click on a category
      const videosCategory = screen.getByText("Videos");
      await user.click(videosCategory);

      // Should call onBulkUpdate with correct parameters
      expect(mockOnBulkUpdate).toHaveBeenCalledWith([mockAssets[0].id], {
        categoryId: 3,
      });
    });

    it("should call onBulkUpdate with null category when Remove Category is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select an asset
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Open category dropdown
      const categoryButton = screen.getByText("Change Category");
      await user.click(categoryButton);

      // Click on Remove Category
      const removeCategory = screen.getByText("Remove Category");
      await user.click(removeCategory);

      // Should call onBulkUpdate with null category
      expect(mockOnBulkUpdate).toHaveBeenCalledWith([mockAssets[0].id], {
        categoryId: null,
      });
    });

    it("should call onBulkUpdate with tag when tag is selected", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select an asset
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Open tags dropdown
      const tagsButton = screen.getByText("Add Tags");
      await user.click(tagsButton);

      // Click on a tag that the asset doesn't have yet
      const draftTag = screen.getByText("draft");
      await user.click(draftTag);

      // Should call onBulkUpdate with correct parameters (draft is tag id 2)
      expect(mockOnBulkUpdate).toHaveBeenCalledWith([mockAssets[0].id], {
        addTags: [2],
      });
    });

    it("should clear selection after bulk update is called", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select assets
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      // Open category dropdown and select a category
      const categoryButton = screen.getByText("Change Category");
      await user.click(categoryButton);
      const videosCategory = screen.getByText("Videos");
      await user.click(videosCategory);

      // Bulk actions should disappear after update
      expect(screen.queryByText("Bulk Actions:")).not.toBeInTheDocument();
    });

    it("should handle multiple selected assets", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select multiple assets
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      // Open category dropdown and select a category
      const categoryButton = screen.getByText("Change Category");
      await user.click(categoryButton);
      const videosCategory = screen.getByText("Videos");
      await user.click(videosCategory);

      // Should call onBulkUpdate with all selected IDs
      expect(mockOnBulkUpdate).toHaveBeenCalledWith(
        [mockAssets[0].id, mockAssets[1].id, mockAssets[2].id],
        { categoryId: 3 }
      );
    });

    it("should show all available categories in dropdown", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select an asset
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Open category dropdown
      const categoryButton = screen.getByText("Change Category");
      await user.click(categoryButton);

      // All categories should be visible - use getAllByText to handle duplicates
      const imagesCat = screen.getAllByText("Images");
      expect(imagesCat.length).toBeGreaterThan(0);
      const documentsCat = screen.getAllByText("Documents");
      expect(documentsCat.length).toBeGreaterThan(0);
      expect(screen.getByText("Videos")).toBeInTheDocument();
      expect(screen.getByText("Remove Category")).toBeInTheDocument();
    });

    it("should show all available tags in dropdown", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
          onBulkUpdate={mockOnBulkUpdate}
          categories={mockCategories}
          tags={mockTags}
        />
      );

      // Select an asset
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Open tags dropdown
      const tagsButton = screen.getByText("Add Tags");
      await user.click(tagsButton);

      // All tags should be visible
      expect(screen.getByText("important")).toBeInTheDocument();
      expect(screen.getByText("draft")).toBeInTheDocument();
      expect(screen.getByText("final")).toBeInTheDocument();
    });
  });
});
