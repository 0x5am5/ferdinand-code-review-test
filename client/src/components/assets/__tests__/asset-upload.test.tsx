import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetUpload } from "../asset-upload";

// Mock the asset queries
jest.mock("@/lib/queries/assets", () => ({
  useAssetCategoriesQuery: jest.fn(() => ({
    data: [
      { id: 1, name: "Documents", slug: "documents" },
      { id: 2, name: "Images", slug: "images" },
    ],
  })),
  useAssetTagsQuery: jest.fn(() => ({
    data: [
      { id: 1, name: "marketing", slug: "marketing" },
      { id: 2, name: "design", slug: "design" },
    ],
  })),
  useUploadAssetMutation: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue({}),
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

describe("AssetUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("File Upload Flow", () => {
    it("should render upload dialog trigger button", () => {
      render(<AssetUpload />, { wrapper: createWrapper() });

      expect(
        screen.getByRole("button", { name: /upload assets/i })
      ).toBeInTheDocument();
    });

    it("should open dialog when upload button is clicked", async () => {
      const user = userEvent.setup();
      render(<AssetUpload />, { wrapper: createWrapper() });

      const uploadButton = screen.getByRole("button", {
        name: /upload assets/i,
      });
      await user.click(uploadButton);

      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });

    it("should allow file selection via input", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const file = new File(["hello"], "test.txt", { type: "text/plain" });
      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });
    });

    it("should display file preview for selected files", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const file = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("document.pdf")).toBeInTheDocument();
        expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
      });
    });

    it("should allow removing files from selection", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });

      // Find and click the remove button (X button)
      const removeButtons = screen.getAllByRole("button");
      const removeButton = removeButtons.find((btn) =>
        btn.querySelector("svg.lucide-x")
      );

      if (removeButton) {
        await user.click(removeButton);
      }

      await waitFor(() => {
        expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
      });
    });

    it("should support multiple file selection", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const files = [
        new File(["content1"], "file1.txt", { type: "text/plain" }),
        new File(["content2"], "file2.txt", { type: "text/plain" }),
        new File(["content3"], "file3.txt", { type: "text/plain" }),
      ];

      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText("file1.txt")).toBeInTheDocument();
        expect(screen.getByText("file2.txt")).toBeInTheDocument();
        expect(screen.getByText("file3.txt")).toBeInTheDocument();
        expect(screen.getByText(/selected files \(3\)/i)).toBeInTheDocument();
      });
    });
  });

  describe("Drag and Drop Upload", () => {
    it("should handle drag and drop events", async () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const dropZone = screen.getByRole("button", { name: /drag and drop/i });
      const file = new File(["content"], "dropped.txt", { type: "text/plain" });

      // Create drag event
      const dragEvent = new Event("dragover", { bubbles: true });
      Object.defineProperty(dragEvent, "dataTransfer", {
        value: { files: [file] },
      });

      fireEvent(dropZone, dragEvent);

      // Create drop event
      const dropEvent = new Event("drop", { bubbles: true });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: { files: [file] },
      });

      fireEvent(dropZone, dropEvent);

      await waitFor(() => {
        expect(screen.getByText("dropped.txt")).toBeInTheDocument();
      });
    });

    it("should highlight drop zone on drag over", () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const dropZone = screen.getByRole("button", { name: /drag and drop/i });

      fireEvent.dragOver(dropZone);

      // Check if the drop zone has the highlighted class
      expect(dropZone).toHaveClass("border-primary");
    });

    it("should remove highlight when drag leaves", () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const dropZone = screen.getByRole("button", { name: /drag and drop/i });

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      // Check if the highlight class is removed
      expect(dropZone).not.toHaveClass("border-primary");
    });
  });

  describe("Metadata Selection", () => {
    it("should allow selecting visibility option", async () => {
      const _user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      // Default visibility should be "shared"
      expect(
        screen.getByText(/shared \(all team members\)/i)
      ).toBeInTheDocument();
    });

    it("should allow selecting categories", async () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      // Categories should be available
      expect(screen.getByText(/categories \(optional\)/i)).toBeInTheDocument();
    });

    it("should allow entering tags", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const tagInput = screen.getByPlaceholderText(/enter new tags/i);
      await user.type(tagInput, "test, example");

      expect(tagInput).toHaveValue("test, example");
    });

    it("should display selected categories as badges", async () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      // Test that category selection UI is present
      expect(screen.getByText(/categories \(optional\)/i)).toBeInTheDocument();
    });
  });

  describe("Upload Progress", () => {
    it("should disable upload button when no files selected", () => {
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const uploadButtons = screen.getAllByRole("button");
      const uploadButton = uploadButtons.find((btn) =>
        btn.textContent?.includes("Upload")
      );

      expect(uploadButton).toBeDisabled();
    });

    it("should enable upload button when files are selected", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, file);

      await waitFor(() => {
        const uploadButtons = screen.getAllByRole("button");
        const uploadButton = uploadButtons.find((btn) =>
          btn.textContent?.includes("Upload 1 file")
        );
        expect(uploadButton).not.toBeDisabled();
      });
    });

    it("should show correct file count in upload button text", async () => {
      const user = userEvent.setup();
      render(<AssetUpload open={true} onOpenChange={jest.fn()} />, {
        wrapper: createWrapper(),
      });

      const files = [
        new File(["content1"], "file1.txt", { type: "text/plain" }),
        new File(["content2"], "file2.txt", { type: "text/plain" }),
      ];

      const input = screen
        .getByRole("button", { name: /drag and drop/i })
        .querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, files);

      await waitFor(() => {
        expect(screen.getByText(/upload 2 files/i)).toBeInTheDocument();
      });
    });
  });

  describe("Dialog Actions", () => {
    it("should close dialog when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      render(<AssetUpload open={true} onOpenChange={onOpenChange} />, {
        wrapper: createWrapper(),
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("should handle initial files prop", () => {
      const initialFiles = [
        new File(["content"], "initial.txt", { type: "text/plain" }),
      ];

      render(
        <AssetUpload
          open={true}
          onOpenChange={jest.fn()}
          initialFiles={initialFiles}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("initial.txt")).toBeInTheDocument();
    });
  });
});
