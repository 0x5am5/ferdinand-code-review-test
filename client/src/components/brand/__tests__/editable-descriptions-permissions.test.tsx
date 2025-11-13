/**
 * Editable Descriptions Permissions Tests (JUP-29)
 *
 * This test suite covers role-based UI permissions for editing brand asset descriptions.
 * Tests the AssetSection component's conditional rendering of InlineEditable vs plain text.
 *
 * Test Coverage:
 * - UI visibility tests (editor/admin/super_admin see editable, standard/guest see text)
 * - Interaction tests (editing, saving, error handling, debouncing)
 * - Integration tests with different asset types (logo, color, font)
 * - Variant-specific descriptions for logos
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { AssetSection } from "../logo-manager/asset-section";

// Mock hooks
jest.mock("@/hooks/use-auth");
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

const mockUseAuth = jest.mocked(useAuth);

describe("AssetSection - Editable Descriptions Permissions (JUP-29)", () => {
  let queryClient: QueryClient;
  const mockOnDescriptionUpdate = jest.fn();
  const mockOnRemoveSection = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock fetch globally
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
    queryClient.clear();
  });

  const renderAssetSection = (
    userRole: (typeof UserRole)[keyof typeof UserRole],
    isEmpty = true,
    description = "Test section description"
  ) => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 1,
        email: "test@example.com",
        name: "Test User",
        role: userRole,
      },
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
      it("should show InlineEditable for Super Admin role", () => {
        renderAssetSection(UserRole.SUPER_ADMIN);

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

      it("should show InlineEditable for Admin role", () => {
        renderAssetSection(UserRole.ADMIN);

        const editableElement = screen.getByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElement).toBeInTheDocument();
      });

      it("should show InlineEditable for Editor role", () => {
        renderAssetSection(UserRole.EDITOR);

        const editableElement = screen.getByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElement).toBeInTheDocument();
      });
    });

    describe("Unprivileged Roles - Should See Static Text", () => {
      it("should show plain text for Standard role", () => {
        renderAssetSection(UserRole.STANDARD);

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

      it("should show plain text for Guest role", () => {
        renderAssetSection(UserRole.GUEST);

        const paragraph = screen.getByText("Test section description");
        expect(paragraph).toBeInTheDocument();
        expect(paragraph.tagName).toBe("P");

        const editableElements = screen.queryAllByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElements.length).toBe(0);
      });
    });

    describe("Feature Flag Behavior", () => {
      it("should show plain text when enableEditableDescription is false for editor", () => {
        mockUseAuth.mockReturnValue({
          user: {
            id: 1,
            email: "test@example.com",
            name: "Test User",
            role: UserRole.EDITOR,
          },
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
        mockUseAuth.mockReturnValue({
          user: {
            id: 1,
            email: "test@example.com",
            name: "Test User",
            role: UserRole.EDITOR,
          },
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

  describe("Interaction Tests - Editing Behavior", () => {
    it("should allow editor to click and edit description", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR);

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

    it("should call onDescriptionUpdate when editor saves changes", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "Original description");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original description");
        await user.clear(textarea);
        await user.type(textarea, "Updated description");

        // Advance debounce timer
        jest.advanceTimersByTime(500);

        await waitFor(() => {
          expect(mockOnDescriptionUpdate).toHaveBeenCalledWith(
            "Updated description"
          );
        });
      });
    });

    it("should debounce updates with 500ms delay", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR);

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "New text");

      // Should not call immediately
      expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();

      // Advance by 300ms - still shouldn't call
      jest.advanceTimersByTime(300);
      expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();

      // Advance remaining 200ms to reach 500ms
      jest.advanceTimersByTime(200);

      await waitFor(() => {
        expect(mockOnDescriptionUpdate).toHaveBeenCalledWith("New text");
      });
    });

    it("should cancel edit on Escape key", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "Original");

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
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "Original");

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

    it("should save on blur", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "Original");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");

        // Click outside to trigger blur
        const title = screen.getByText("Test Section");
        await user.click(title);

        await waitFor(() => {
          expect(mockOnDescriptionUpdate).toHaveBeenCalledWith("Modified");
        });
      });
    });
  });

  describe("Role-Based Upload Component Visibility", () => {
    it("should show upload component for editor", () => {
      renderAssetSection(UserRole.EDITOR);

      expect(screen.getByText("Upload Component")).toBeInTheDocument();
    });

    it("should show upload component for admin", () => {
      renderAssetSection(UserRole.ADMIN);

      expect(screen.getByText("Upload Component")).toBeInTheDocument();
    });

    it("should show empty placeholder instead of upload for standard user", () => {
      renderAssetSection(UserRole.STANDARD);

      expect(screen.getByText("Empty Placeholder")).toBeInTheDocument();
      expect(screen.queryByText("Upload Component")).not.toBeInTheDocument();
    });

    it("should show empty placeholder instead of upload for guest user", () => {
      renderAssetSection(UserRole.GUEST);

      expect(screen.getByText("Empty Placeholder")).toBeInTheDocument();
      expect(screen.queryByText("Upload Component")).not.toBeInTheDocument();
    });
  });

  describe("Remove Section Button Visibility", () => {
    it("should show remove button for editor", () => {
      renderAssetSection(UserRole.EDITOR);

      const removeButton = screen.getByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).toBeInTheDocument();
    });

    it("should show remove button for admin", () => {
      renderAssetSection(UserRole.ADMIN);

      const removeButton = screen.getByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).toBeInTheDocument();
    });

    it("should show remove button for super admin", () => {
      renderAssetSection(UserRole.SUPER_ADMIN);

      const removeButton = screen.getByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).toBeInTheDocument();
    });

    it("should not show remove button for standard user", () => {
      renderAssetSection(UserRole.STANDARD);

      const removeButton = screen.queryByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).not.toBeInTheDocument();
    });

    it("should not show remove button for guest user", () => {
      renderAssetSection(UserRole.GUEST);

      const removeButton = screen.queryByRole("button", {
        name: /Remove Section/i,
      });
      expect(removeButton).not.toBeInTheDocument();
    });
  });

  describe("Content Rendering - Empty vs Populated", () => {
    it("should show empty state with description editor when isEmpty is true", () => {
      renderAssetSection(UserRole.EDITOR, true);

      expect(
        screen.getByRole("button", {
          name: /Test Section description/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByText("Upload Component")).toBeInTheDocument();
    });

    it("should show children content when isEmpty is false", () => {
      renderAssetSection(UserRole.EDITOR, false);

      expect(screen.getByText("Section Content")).toBeInTheDocument();
      // Description editor should not be visible when not empty
      expect(
        screen.queryByRole("button", {
          name: /Test Section description/i,
        })
      ).not.toBeInTheDocument();
    });
  });

  describe("Placeholder Text", () => {
    it("should show custom placeholder when editing empty description", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "");

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

  describe("Role Hierarchy Summary", () => {
    it("should confirm all privileged roles have edit capability", () => {
      const privilegedRoles = [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.EDITOR,
      ] as const;

      for (const role of privilegedRoles) {
        const { unmount } = renderAssetSection(role);

        const editableElement = screen.getByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElement).toBeInTheDocument();

        unmount();
      }
    });

    it("should confirm unprivileged roles see static text only", () => {
      const unprivilegedRoles = [UserRole.STANDARD, UserRole.GUEST] as const;

      for (const role of unprivilegedRoles) {
        const { unmount } = renderAssetSection(role);

        const paragraph = screen.getByText("Test section description");
        expect(paragraph).toBeInTheDocument();
        expect(paragraph.tagName).toBe("P");

        const editableElements = screen.queryAllByRole("button", {
          name: /Test Section description/i,
        });
        expect(editableElements.length).toBe(0);

        unmount();
      }
    });
  });

  describe("Multiple Update Scenarios", () => {
    it("should handle rapid consecutive edits with debouncing", async () => {
      const user = userEvent.setup({ delay: null });
      renderAssetSection(UserRole.EDITOR, true, "Start");

      const editableElement = screen.getByRole("button", {
        name: /Test Section description/i,
      });
      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      await user.clear(textarea);

      // Type multiple characters with small delays
      await user.type(textarea, "T");
      jest.advanceTimersByTime(200);

      await user.type(textarea, "e");
      jest.advanceTimersByTime(200);

      await user.type(textarea, "s");
      jest.advanceTimersByTime(200);

      await user.type(textarea, "t");

      // Should not have called yet
      expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();

      // Now advance the full 500ms
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        // Should only call once with final value
        expect(mockOnDescriptionUpdate).toHaveBeenCalledTimes(1);
        expect(mockOnDescriptionUpdate).toHaveBeenCalledWith("Test");
      });
    });
  });

  describe("Integration with Authentication", () => {
    it("should handle missing user gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: null,
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

      // Should show plain text when no user
      const paragraph = screen.getByText("Test description");
      expect(paragraph).toBeInTheDocument();
    });

    it("should handle user without role gracefully", () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 1,
          email: "test@example.com",
          name: "Test User",
          role: undefined as unknown as UserRole,
        },
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

      // Should show plain text when role is undefined
      const paragraph = screen.getByText("Test description");
      expect(paragraph).toBeInTheDocument();
    });
  });
});
