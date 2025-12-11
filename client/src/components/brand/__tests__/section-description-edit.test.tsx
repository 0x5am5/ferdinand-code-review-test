/**
 * @vitest-environment jsdom
 */

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { sectionMetadataApi } from "@/lib/api";
import { useToast } from "../../../hooks/use-toast";
import { InlineEditable } from "../../ui/inline-editable";

// Mock firebase before anything else
vi.mock("@/lib/firebase", () => ({
  auth: {},
  googleProvider: {},
}));

// Mock toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock sectionMetadataApi
vi.mock("@/lib/api", () => ({
  sectionMetadataApi: {
    list: vi.fn(),
    update: vi.fn(),
  },
}));

// Component that mimics AssetSection's description editing behavior
function TestSectionDescriptionEdit({
  clientId,
  sectionType,
  initialDescription,
}: {
  clientId: number;
  sectionType: string;
  initialDescription: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateSectionDescriptionMutation = useMutation({
    mutationFn: ({
      sectionType,
      description,
    }: {
      sectionType: string;
      description: string;
    }) => {
      if (!clientId) throw new Error("Client ID is required");
      return sectionMetadataApi.update(clientId, sectionType, description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/section-metadata`],
      });
      toast({
        title: "Description saved",
        description: "Section description has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSectionDescriptionUpdate = (value: string) => {
    updateSectionDescriptionMutation.mutate({
      sectionType,
      description: value,
    });
  };

  return (
    <div data-testid={`section-description-${sectionType}`}>
      <InlineEditable
        value={initialDescription}
        onSave={handleSectionDescriptionUpdate}
        inputType="textarea"
        placeholder="Add a section description..."
        showControls={true}
        ariaLabel={`${sectionType} description`}
        className="text-muted-foreground"
      />
    </div>
  );
}

describe("Section Description Edit Integration", () => {
  let queryClient: QueryClient;
  const mockUpdate = sectionMetadataApi.update as Mock;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Set initial query data
    queryClient.setQueryData(
      ["/api/clients/1/section-metadata"],
      [
        {
          sectionType: "logo-main",
          description: "Primary brand logo",
        },
      ]
    );

    mockUpdate.mockClear();
    mockToast.mockClear();
  });

  const renderComponent = (
    sectionType = "logo-main",
    description = "Primary brand logo"
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TestSectionDescriptionEdit
          clientId={1}
          sectionType={sectionType}
          initialDescription={description}
        />
      </QueryClientProvider>
    );
  };

  describe("View Mode", () => {
    it("should display description as clickable button in view mode", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      expect(viewButton).toBeInTheDocument();
      expect(viewButton).toHaveTextContent("Primary brand logo");
    });

    it("should enter edit mode when clicked", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue("Primary brand logo");
    });

    it("should show placeholder when description is empty", () => {
      renderComponent("logo-main", "");

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      expect(viewButton).toHaveTextContent("Add a section description...");
    });
  });

  describe("Edit Mode with Controls", () => {
    it("should show textarea and save/cancel buttons in edit mode", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      expect(saveButton).toBeInTheDocument();

      const cancelButton = screen.getByRole("button", {
        name: /cancel changes/i,
      });
      expect(cancelButton).toBeInTheDocument();
    });

    it("should focus and select all text when entering edit mode", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea).toHaveFocus();
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe("Primary brand logo".length);
    });
  });

  describe("Save Behavior", () => {
    it("should call API when save button is clicked", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Updated description" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          1,
          "logo-main",
          "Updated description"
        );
      });
    });

    it("should show success toast after successful save", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "New description" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Description saved",
          description: "Section description has been updated successfully.",
        });
      });
    });

    it("should exit edit mode after successful save", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "New description" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("should trim whitespace before saving", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "  Trimmed text  " } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(1, "logo-main", "Trimmed text");
      });
    });

    it("should not call API if value has not changed", async () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).not.toHaveBeenCalled();
      });
    });
  });

  describe("Cancel Behavior", () => {
    it("should revert changes when cancel button is clicked", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Cancelled changes" } });

      const cancelButton = screen.getByRole("button", {
        name: /cancel changes/i,
      });
      fireEvent.click(cancelButton);

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /logo-main description/i })
      ).toHaveTextContent("Primary brand logo");
    });

    it("should exit edit mode when Escape key is pressed", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Escape test" } });
      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /logo-main description/i })
      ).toHaveTextContent("Primary brand logo");
    });

    it("should not call API when cancelled", () => {
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Will be cancelled" } });

      const cancelButton = screen.getByRole("button", {
        name: /cancel changes/i,
      });
      fireEvent.click(cancelButton);

      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should show error toast when API call fails", async () => {
      mockUpdate.mockRejectedValueOnce(
        new Error("Failed to update description")
      );

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Error test" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Failed to update description",
          variant: "destructive",
        });
      });
    });

    it("should exit edit mode after error (InlineEditable behavior)", async () => {
      mockUpdate.mockRejectedValueOnce(new Error("Server error"));

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Error test" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalled();
      });

      // InlineEditable exits edit mode even on error (by design)
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("should save when Enter is pressed (single-line input only, not textarea)", () => {
      // This test verifies that textarea does NOT save on Enter
      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Enter test" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      // Should NOT have saved (textarea requires explicit save button)
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should save when Ctrl+Enter is pressed in textarea", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      renderComponent();

      const viewButton = screen.getByRole("button", {
        name: /logo-main description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Ctrl+Enter test" } });
      fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          1,
          "logo-main",
          "Ctrl+Enter test"
        );
      });
    });
  });

  describe("Multiple Section Types", () => {
    it("should handle different section types correctly", async () => {
      mockUpdate.mockResolvedValueOnce({ success: true });

      const { rerender } = renderComponent("logo-secondary", "Secondary logo");

      const viewButton = screen.getByRole("button", {
        name: /logo-secondary description/i,
      });
      fireEvent.click(viewButton);

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Updated secondary" } });

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          1,
          "logo-secondary",
          "Updated secondary"
        );
      });
    });
  });
});
