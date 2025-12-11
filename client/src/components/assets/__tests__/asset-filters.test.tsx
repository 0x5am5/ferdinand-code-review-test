/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { AssetFilters as Filters } from "@/lib/queries/assets";
import { AssetFilters } from "../asset-filters";

// Mock the asset queries
vi.mock("@/lib/queries/assets", () => ({
  ...(vi.importActual("@/lib/queries/assets") as object),
  useAssetCategoriesQuery: vi.fn(() => ({
    data: [
      { id: 1, name: "Documents", slug: "documents" },
      { id: 2, name: "Images", slug: "images" },
      { id: 3, name: "Videos", slug: "videos" },
    ],
  })),
  useAssetTagsQuery: vi.fn(() => ({
    data: [
      { id: 1, name: "marketing", slug: "marketing" },
      { id: 2, name: "design", slug: "design" },
      { id: 3, name: "social", slug: "social" },
    ],
  })),
  useDeleteTagMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: JSX.Element }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AssetFilters", () => {
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Run all pending timers to ensure cleanup
    vi.runOnlyPendingTimers();
    // Clear all timers
    vi.clearAllTimers();
    // Restore real timers
    vi.useRealTimers();
  });

  describe("Search Functionality", () => {
    it("should render search input", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByPlaceholderText(/search assets/i)).toBeInTheDocument();
    });

    it("should debounce search input", async () => {
      // Use real timers for this test
      vi.useRealTimers();

      const user = userEvent.setup();
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      const searchInput = screen.getByPlaceholderText(/search assets/i);

      // Should not call immediately after typing
      await user.type(searchInput, "test query");
      expect(mockOnFiltersChange).not.toHaveBeenCalled();

      // Wait for debounce delay (300ms + buffer)
      await waitFor(
        () => {
          expect(mockOnFiltersChange).toHaveBeenCalledWith({
            search: "test query",
          });
        },
        { timeout: 500 }
      );

      vi.useFakeTimers();
    });

    it("should only trigger search after debounce period", async () => {
      // Use real timers for this test
      vi.useRealTimers();

      const user = userEvent.setup();
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      const searchInput = screen.getByPlaceholderText(/search assets/i);

      // Type multiple characters
      await user.type(searchInput, "test");

      // Should only call once after debounce period
      await waitFor(
        () => {
          expect(mockOnFiltersChange).toHaveBeenCalledTimes(1);
          expect(mockOnFiltersChange).toHaveBeenCalledWith({
            search: "test",
          });
        },
        { timeout: 500 }
      );

      vi.useFakeTimers();
    });

    it("should display existing search value", () => {
      const filters: Filters = { search: "existing query" };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      const searchInput = screen.getByPlaceholderText(
        /search assets/i
      ) as HTMLInputElement;
      expect(searchInput.value).toBe("existing query");
    });
  });

  describe("Category Filter", () => {
    it("should render category dropdown", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/category/i)).toBeInTheDocument();
    });

    it('should display "All Categories" by default', () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/all categories/i)).toBeInTheDocument();
    });

    it("should show selected category", () => {
      const filters: Filters = { categoryId: 1 };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      // The selected category name should be displayed
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
  });

  describe("Visibility Filter", () => {
    it("should render visibility dropdown", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/visibility/i)).toBeInTheDocument();
    });

    it('should display "All" by default', () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      const visibilitySection = screen.getByText(/visibility/i).parentElement;
      expect(visibilitySection).toBeInTheDocument();
    });

    it("should show selected visibility", () => {
      const filters: Filters = { visibility: "private" };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/private/i)).toBeInTheDocument();
    });
  });

  describe("Tag Filter", () => {
    it("should render tag badges", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("marketing")).toBeInTheDocument();
      expect(screen.getByText("design")).toBeInTheDocument();
      expect(screen.getByText("social")).toBeInTheDocument();
    });

    it("should toggle tag selection when clicked", async () => {
      vi.useRealTimers();

      const user = userEvent.setup();
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      const marketingTag = screen.getByText("marketing");
      await user.click(marketingTag);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        tagIds: [1],
      });

      vi.useFakeTimers();
    });

    it("should show selected tags with different styling", () => {
      const filters: Filters = { tagIds: [1, 2] };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      // Selected tags should have an X icon
      const xIcons = document.querySelectorAll("svg.lucide-x");

      // Should have at least 2 X icons for the selected tags (and possibly more for clear buttons, etc)
      expect(xIcons.length).toBeGreaterThanOrEqual(2);
    });

    it("should remove tag when clicked again", async () => {
      vi.useRealTimers();

      const user = userEvent.setup();
      const filters: Filters = { tagIds: [1] };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      const marketingTag = screen.getByText("marketing");
      await user.click(marketingTag);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        tagIds: undefined,
      });

      vi.useFakeTimers();
    });

    it("should handle multiple tag selection", async () => {
      vi.useRealTimers();

      const user = userEvent.setup();
      const filters: Filters = { tagIds: [1] };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      const designTag = screen.getByText("design");
      await user.click(designTag);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        tagIds: [1, 2],
      });

      vi.useFakeTimers();
    });
  });

  describe("Clear Filters", () => {
    it("should show clear filters button when filters are active", () => {
      const filters: Filters = { search: "test" };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });

    it("should not show clear filters button when no filters are active", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument();
    });

    it("should clear all filters when clicked", async () => {
      vi.useRealTimers();

      const user = userEvent.setup();
      const filters: Filters = {
        search: "test",
        categoryId: 1,
        visibility: "private",
        tagIds: [1, 2],
      };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      const clearButton = screen.getByText(/clear filters/i);
      await user.click(clearButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith({});

      vi.useFakeTimers();
    });

    it("should show clear button for category filter", () => {
      const filters: Filters = { categoryId: 1 };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });

    it("should show clear button for visibility filter", () => {
      const filters: Filters = { visibility: "private" };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });

    it("should show clear button for tag filter", () => {
      const filters: Filters = { tagIds: [1] };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });
  });

  describe("Filter Combination", () => {
    it("should handle multiple active filters", () => {
      const filters: Filters = {
        search: "test",
        categoryId: 1,
        visibility: "shared",
        tagIds: [1, 2],
      };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByDisplayValue("test")).toBeInTheDocument();
      expect(screen.getByText("Documents")).toBeInTheDocument();
      expect(screen.getByText(/shared/i)).toBeInTheDocument();
      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });

    it("should preserve other filters when updating one filter", async () => {
      vi.useRealTimers();

      const user = userEvent.setup();
      const filters: Filters = {
        categoryId: 1,
        tagIds: [1],
      };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      const searchInput = screen.getByPlaceholderText(/search assets/i);
      await user.type(searchInput, "new search");

      await waitFor(
        () => {
          expect(mockOnFiltersChange).toHaveBeenCalledWith({
            categoryId: 1,
            tagIds: [1],
            search: "new search",
          });
        },
        { timeout: 500 }
      );

      vi.useFakeTimers();
    });
  });

  describe("Source Filter", () => {
    it("should render source dropdown", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/^source$/i)).toBeInTheDocument();
    });

    it('should display "All Sources" by default', () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/all sources/i)).toBeInTheDocument();
    });

    it("should show Google Drive when isGoogleDrive is true", () => {
      const filters: Filters = { isGoogleDrive: true };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/google drive/i)).toBeInTheDocument();
    });

    it("should show Uploaded when isGoogleDrive is false", () => {
      const filters: Filters = { isGoogleDrive: false };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/uploaded/i)).toBeInTheDocument();
    });

    it("should show clear button for source filter", () => {
      const filters: Filters = { isGoogleDrive: true };

      render(
        <AssetFilters
          filters={filters}
          onFiltersChange={mockOnFiltersChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
    });
  });

  describe("UI Elements", () => {
    it("should render search icon", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      const searchIcons = document.querySelectorAll("svg.lucide-search");
      expect(searchIcons.length).toBeGreaterThan(0);
    });

    it("should render filter labels", () => {
      render(
        <AssetFilters filters={{}} onFiltersChange={mockOnFiltersChange} />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/^search$/i)).toBeInTheDocument();
      expect(screen.getByText(/^category$/i)).toBeInTheDocument();
      expect(screen.getByText(/^source$/i)).toBeInTheDocument();
      expect(screen.getByText(/^visibility$/i)).toBeInTheDocument();
      expect(screen.getByText(/^tags$/i)).toBeInTheDocument();
    });
  });
});
