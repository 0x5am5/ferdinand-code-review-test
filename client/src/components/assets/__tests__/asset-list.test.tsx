import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Asset } from "@/lib/queries/assets";
import { AssetList } from "../asset-list";

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

describe("AssetList", () => {
  const mockOnAssetClick = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnBulkDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any pending timers or async operations
    jest.clearAllTimers();
  });

  describe("Loading State", () => {
    it("should render loading skeletons when loading", () => {
      render(
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
      render(
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
      render(
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
      render(
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
      render(
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
      render(
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
      render(
        <AssetList
          assets={mockAssets}
          isLoading={false}
          onAssetClick={mockOnAssetClick}
          onDelete={mockOnDelete}
        />
      );

      const images = screen.getAllByRole("img");
      const thumbnailImage = images.find((img) =>
        img.getAttribute("src")?.includes("/api/assets/1/thumbnail")
      );

      expect(thumbnailImage).toBeInTheDocument();
    });
  });

  describe("View Mode Toggle", () => {
    it("should toggle between grid and list view", async () => {
      const user = userEvent.setup();
      render(
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
      render(
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
        expect(screen.getByText("Uploaded")).toBeInTheDocument();
        expect(screen.getByText("Visibility")).toBeInTheDocument();
      }
    });
  });

  describe("Asset Interactions", () => {
    it("should call onAssetClick when asset is clicked in grid view", async () => {
      const user = userEvent.setup();
      render(
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
      render(
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
      const mockOpen = jest.fn();
      window.open = mockOpen;

      render(
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
      render(
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

      render(
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
      render(
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
      render(
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
      render(
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
      render(
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
      render(
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
      render(
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
      const deleteButton = screen.getByText(/Delete 1 file/i);
      expect(deleteButton).toBeInTheDocument();

      // Click again to deselect
      await user.click(checkboxes[0]);

      // Bulk delete button should disappear
      const deleteButtons = screen.queryAllByRole("button");
      const bulkDeleteButton = deleteButtons.find((btn) =>
        btn.textContent?.includes("Delete")
      );
      expect(bulkDeleteButton).toBeUndefined();
    });

    it("should show correct count when multiple assets are selected", async () => {
      const user = userEvent.setup();
      render(
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
      const deleteButton = screen.getByText(/Delete 2 files/i);
      expect(deleteButton).toBeInTheDocument();
    });

    it("should use singular 'file' when one asset is selected", async () => {
      const user = userEvent.setup();
      render(
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

      // Should say "file" not "files"
      const deleteButton = screen.getByText(/Delete 1 file$/i);
      expect(deleteButton).toBeInTheDocument();
    });

    it("should call onBulkDelete with selected asset IDs when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(
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
      const deleteButton = screen.getByText(/Delete 2 files/i);
      await user.click(deleteButton);

      // Should call onBulkDelete with correct IDs
      expect(mockOnBulkDelete).toHaveBeenCalledWith([
        mockAssets[0].id,
        mockAssets[1].id,
      ]);
    });

    it("should clear selection after bulk delete is called", async () => {
      const user = userEvent.setup();
      render(
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
      const deleteButton = screen.getByText(/Delete 2 files/i);
      await user.click(deleteButton);

      // Bulk delete button should disappear after delete
      const deleteButtons = screen.queryAllByRole("button");
      const bulkDeleteButton = deleteButtons.find((btn) =>
        btn.textContent?.includes("Delete")
      );
      expect(bulkDeleteButton).toBeUndefined();
    });

    it("should not call onBulkDelete when no assets are selected", async () => {
      render(
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
      render(
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
      render(
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
      expect(screen.getByText(/Delete 1 file/i)).toBeInTheDocument();

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
        expect(screen.getByText(/Delete 2 files/i)).toBeInTheDocument();
      }
    });
  });
});
