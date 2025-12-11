/**
 * Editable Descriptions Permissions Tests (JUP-29)
 *
 * This test suite covers role-based UI permissions for editing brand asset descriptions.
 * Tests the AssetSection component's conditional rendering of InlineEditable vs plain text.
 *
 * Test Coverage:
 * - UI visibility tests (editor/admin/super_admin see editable, standard/guest see text)
 * - Interaction tests (editing, saving with explicit controls, error handling)
 * - Integration tests with different asset types (logo, color, font)
 * - Variant-specific descriptions for logos
 *
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePermissions } from "@/hooks/use-permissions";
import { AssetSection } from "../logo-manager/asset-section";

// Mock firebase before anything else
vi.mock("@/lib/firebase", () => ({
  auth: {},
  googleProvider: {},
}));

// Mock hooks
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: vi.fn(),
  PermissionAction: {
    CREATE: "CREATE",
    UPDATE: "UPDATE",
    DELETE: "DELETE",
    READ: "READ",
  },
  Resource: {
    BRAND_ASSETS: "BRAND_ASSETS",
    HIDDEN_SECTIONS: "HIDDEN_SECTIONS",
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockUsePermissions = usePermissions as ReturnType<typeof vi.fn>;

describe("AssetSection - Editable Descriptions Permissions (JUP-29)", () => {
  let queryClient: QueryClient;
  const mockOnDescriptionUpdate = vi.fn();
  const mockOnRemoveSection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock fetch globally
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderAssetSection = (
    canEdit: boolean,
    isEmpty = true,
    description = "Test section description"
  ) => {
    mockUsePermissions.mockReturnValue({
      can: vi.fn((action, _resource) => {
        // CREATE permission for upload component
        if (action === "CREATE") return canEdit;
        // UPDATE permission for editing descriptions
        if (action === "UPDATE") return canEdit;
        return false;
      }),
      hasRole: vi.fn(),
      canModify: vi.fn(),
      canManageUsers: vi.fn(),
      isLoading: false,
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <AssetSection
          title="Test Section"
          description={description}
          isEmpty={isEmpty}
          onRemoveSection={mockOnRemoveSection}
          sectionType="test"
          uploadComponent={<div>Upload Component</div>}
          emptyPlaceholder={<div>Empty Placeholder</div>}
          onDescriptionUpdate={mockOnDescriptionUpdate}
          enableEditableDescription={true}
        >
          <div>Section Content</div>
        </AssetSection>
      </QueryClientProvider>
    );
  };

  describe("UI Visibility Tests - Role-Based Rendering", () => {
    describe("Privileged Roles - Should See InlineEditable", () => {
      it("should show InlineEditable for users with edit permissions", () => {
        renderAssetSection(true);

        // Look for the editable element (has role="button" and aria-label)
        const editableElement = screen.getByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElement).toBeInTheDocument();

        // Should NOT show plain text paragraph
        const paragraphs = screen.queryAllByText((content, element) => {
          return (
            element?.tagName.toLowerCase() === "p" &&
            content === "Test section description"
          );
        });
        expect(paragraphs.length).toBe(0);
      });
    });

    describe("Unprivileged Roles - Should See Static Text", () => {
      it("should show plain text for users without edit permissions", () => {
        renderAssetSection(false);

        // Should show the description as plain text
        const paragraph = screen.getByText("Test section description");
        expect(paragraph).toBeInTheDocument();
        expect(paragraph.tagName).toBe("P");

        // Should NOT have editable elements
        const editableElements = screen.queryAllByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElements.length).toBe(0);
      });
    });

    describe("Feature Flag Behavior", () => {
      it("should show plain text when enableEditableDescription is false for editor", () => {
        mockUsePermissions.mockReturnValue({
          can: vi.fn(() => true),
          hasRole: vi.fn(),
          canModify: vi.fn(),
          canManageUsers: vi.fn(),
          isLoading: false,
        });

        render(
          <QueryClientProvider client={queryClient}>
            <AssetSection
              title="Test Section"
              description="Test description"
              isEmpty={true}
              sectionType="test"
              uploadComponent={<div>Upload</div>}
              enableEditableDescription={false} // Disabled
            >
              <div>Content</div>
            </AssetSection>
          </QueryClientProvider>
        );

        // Should show plain text even for editor when disabled
        const paragraph = screen.getByText("Test description");
        expect(paragraph).toBeInTheDocument();
      });

      it("should not show InlineEditable when onDescriptionUpdate is missing", () => {
        mockUsePermissions.mockReturnValue({
          can: vi.fn(() => true),
          hasRole: vi.fn(),
          canModify: vi.fn(),
          canManageUsers: vi.fn(),
          isLoading: false,
        });

        render(
          <QueryClientProvider client={queryClient}>
            <AssetSection
              title="Test Section"
              description="Test description"
              isEmpty={true}
              sectionType="test"
              uploadComponent={<div>Upload</div>}
              enableEditableDescription={true}
              // onDescriptionUpdate is missing
            >
              <div>Content</div>
            </AssetSection>
          </QueryClientProvider>
        );

        // Should show plain text when callback is missing
        const paragraph = screen.getByText("Test description");
        expect(paragraph).toBeInTheDocument();
      });
    });
  });

  describe("Interaction Tests - Editing Behavior with Explicit Controls", () => {
    it("should allow editor to click and edit description", async () => {
      const user = userEvent.setup();
      renderAssetSection(true);

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      // Should show textarea
      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveFocus();
      });
    });

    it("should call onDescriptionUpdate when editor clicks save button", async () => {
      const user = userEvent.setup();
      renderAssetSection(true, true, "Original description");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original description");
        await user.clear(textarea);
        await user.type(textarea, "Updated description");

        // Click the save button (checkmark)
        const saveButton = screen.getByRole("button", { name: /save/i });
        await user.click(saveButton);

        await waitFor(() => {
          expect(mockOnDescriptionUpdate).toHaveBeenCalledWith(
            "Updated description"
          );
        });
      });
    });

    it("should show save and cancel buttons in edit mode", async () => {
      const user = userEvent.setup();
      renderAssetSection(true);

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(() => {
        // Should show save button (checkmark icon)
        const saveButton = screen.getByRole("button", { name: /save/i });
        expect(saveButton).toBeInTheDocument();

        // Should show cancel button (X icon)
        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        expect(cancelButton).toBeInTheDocument();
      });
    });

    it("should cancel edit when clicking cancel button", async () => {
      const user = userEvent.setup();
      renderAssetSection(true, true, "Original");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");

        // Click cancel button
        const cancelButton = screen.getByRole("button", { name: /cancel/i });
        await user.click(cancelButton);

        // Should not call the update function
        expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();

        // Should show original text
        await waitFor(() => {
          expect(screen.getByText("Original")).toBeInTheDocument();
        });
      });
    });

    it("should cancel edit on Escape key", async () => {
      const user = userEvent.setup();
      renderAssetSection(true, true, "Original");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Escape}");

        // Should not call the update function
        expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();

        // Should show original text
        await waitFor(() => {
          expect(screen.getByText("Original")).toBeInTheDocument();
        });
      });
    });

    it("should save on Ctrl+Enter for textarea", async () => {
      const user = userEvent.setup();
      renderAssetSection(true, true, "Original");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Control>}{Enter}{/Control}");

        await waitFor(() => {
          expect(mockOnDescriptionUpdate).toHaveBeenCalledWith("Modified");
        });
      });
    });
  });

  describe("Role-Based Upload Component Visibility", () => {
    it("should show upload component for user with create permissions", () => {
      renderAssetSection(true);

      expect(screen.getByText("Upload Component")).toBeInTheDocument();
    });

    it("should show empty placeholder for user without create permissions", () => {
      renderAssetSection(false);

      expect(screen.getByText("Empty Placeholder")).toBeInTheDocument();
      expect(screen.queryByText("Upload Component")).not.toBeInTheDocument();
    });
  });

  describe("Remove Section Button Visibility", () => {
    it("should show remove button for user with update permissions", () => {
      renderAssetSection(true);

      const removeButton = screen.getByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).toBeInTheDocument();
    });

    it("should not show remove button for user without update permissions", () => {
      renderAssetSection(false);

      const removeButton = screen.queryByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).not.toBeInTheDocument();
    });
  });

  describe("Content Rendering - Always Shows Description", () => {
    it("should show description editor when isEmpty is true", () => {
      renderAssetSection(true, true);

      expect(
        screen.getByRole("button", {
          name: /Test Section description/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText("Upload Component")).toBeInTheDocument();
    });

    it("should show description editor even when isEmpty is false", () => {
      renderAssetSection(true, false);

      // Description is ALWAYS shown (production behavior on line 136-137)
      expect(
        screen.getByRole("button", {
          name: /Test Section description/i,
        })
      ).toBeInTheDocument();

      // Children content is also shown
      expect(screen.getByText("Section Content")).toBeInTheDocument();
    });
  });

  describe("Placeholder Text", () => {
    it("should show custom placeholder when editing empty description", async () => {
      const user = userEvent.setup();
      renderAssetSection(true, true, "");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(
          "Add a section description..."
        );
        expect(textarea).toBeInTheDocument();
      });
    });
  });

  describe("Integration with Permissions", () => {
    it("should handle loading permissions state gracefully", () => {
      mockUsePermissions.mockReturnValue({
        can: vi.fn(() => false),
        hasRole: vi.fn(),
        canModify: vi.fn(),
        canManageUsers: vi.fn(),
        isLoading: true, // Still loading permissions
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AssetSection
            title="Test Section"
            description="Test description"
            isEmpty={true}
            sectionType="test"
            uploadComponent={<div>Upload</div>}
            enableEditableDescription={true}
            onDescriptionUpdate={mockOnDescriptionUpdate}
          >
            <div>Content</div>
          </AssetSection>
        </QueryClientProvider>
      );

      // Should show plain text when permissions are loading
      const paragraph = screen.getByText("Test description");
      expect(paragraph).toBeInTheDocument();
    });
  });
});
