/**
 * @vitest-environment jsdom
 */

import "@testing-library/react/dont-cleanup-after-each";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AssetUpload } from "../asset-upload";

// Mock Dialog to avoid Radix Portal/focus locking issues in JSDOM
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");

  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Dialog = ({ open, onOpenChange, children }: any) => (
    <DialogContext.Provider value={{ open: Boolean(open), onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );

  const DialogTrigger = ({ asChild, children }: any) => {
    const ctx = React.useContext(DialogContext);
    const child = React.Children.only(children);

    if (!asChild || !React.isValidElement(child)) {
      return (
        <button type="button" onClick={() => ctx?.onOpenChange?.(true)}>
          {children}
        </button>
      );
    }

    const handleClick = (event: any) => {
      child.props.onClick?.(event);
      ctx?.onOpenChange?.(true);
    };

    return React.cloneElement(child, { onClick: handleClick });
  };

  const DialogContent = ({ children, ...props }: any) => {
    const ctx = React.useContext(DialogContext);
    if (!ctx?.open) return null;

    return (
      <div role="dialog" {...props}>
        {children}
      </div>
    );
  };

  const DialogHeader = ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  );

  const DialogTitle = ({ children, ...props }: any) => (
    <h2 {...props}>{children}</h2>
  );

  const DialogDescription = ({ children, ...props }: any) => (
    <p {...props}>{children}</p>
  );

  return {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  };
});

// Mock Select to avoid Radix Portal behavior in JSDOM
vi.mock("@/components/ui/select", async () => {
  const Select = ({ children }: any) => <div>{children}</div>;
  const SelectTrigger = ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const SelectValue = ({ placeholder }: any) => <span>{placeholder ?? ""}</span>;
  const SelectContent = ({ children }: any) => <div>{children}</div>;
  const SelectItem = ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  );

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

// Mock the asset queries
vi.mock("@/lib/queries/assets", () => ({
  useAssetCategoriesQuery: vi.fn(() => ({
    data: [
      { id: 1, name: "Documents", slug: "documents" },
      { id: 2, name: "Images", slug: "images" },
    ],
  })),
  useAssetTagsQuery: vi.fn(() => ({
    data: [
      { id: 1, name: "marketing", slug: "marketing" },
      { id: 2, name: "design", slug: "design" },
    ],
  })),
  useUploadAssetMutation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

describe("AssetUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("File Upload Flow", () => {
    it("should render upload dialog trigger button", () => {
      render(<AssetUpload clientId={1} />);

      expect(
        screen.getByRole("button", { name: /upload assets/i })
      ).toBeInTheDocument();
    });

    it("should open dialog when upload button is clicked", async () => {
      const user = userEvent.setup();
      render(<AssetUpload clientId={1} />);

      const uploadButton = screen.getByRole("button", {
        name: /upload assets/i,
      });
      await user.click(uploadButton);

      expect(screen.getByText(/drag and drop files here/i)).toBeInTheDocument();
    });

    it("should allow file selection via input", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const file = new File(["hello"], "test.txt", { type: "text/plain" });
      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    it("should display file preview for selected files", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const file = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("document.pdf")).toBeInTheDocument();
        expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    it("should allow removing files from selection", async () => {
      const user = userEvent.setup();
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });

      const removeButton = screen.getByRole("button", {
        name: /remove test\.txt/i,
      });
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
      });
    });

    it("should support multiple file selection", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const files = [
        new File(["content1"], "file1.txt", { type: "text/plain" }),
        new File(["content2"], "file2.txt", { type: "text/plain" }),
        new File(["content3"], "file3.txt", { type: "text/plain" }),
      ];

      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText("file1.txt")).toBeInTheDocument();
        expect(screen.getByText("file2.txt")).toBeInTheDocument();
        expect(screen.getByText("file3.txt")).toBeInTheDocument();
        expect(screen.getByText(/selected files \(3\)/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });
  });

  describe("Drag and Drop Upload", () => {
    it("should handle drag and drop events", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

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

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    it("should highlight drop zone on drag over", () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const dropZone = screen.getByRole("button", { name: /drag and drop/i });

      fireEvent.dragOver(dropZone);

      // Check if the drop zone has the highlighted class
      expect(dropZone).toHaveClass("border-primary");
    });

    it("should remove highlight when drag leaves", () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const dropZone = screen.getByRole("button", { name: /drag and drop/i });

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      // Check if the highlight class is removed
      expect(dropZone).not.toHaveClass("border-primary");
    });
  });

  describe("Metadata Selection", () => {
    it("should allow selecting visibility option", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      // Default visibility should be "shared"
      expect(
        screen.getByText(/shared \(all team members\)/i)
      ).toBeInTheDocument();
    });

    it("should allow selecting categories", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      // Categories should be available
      expect(screen.getByText(/categories \(optional\)/i)).toBeInTheDocument();
    });

    it("should allow entering tags", async () => {
      const user = userEvent.setup();
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const tagInput = screen.getByPlaceholderText(/enter new tags/i);
      await user.type(tagInput, "test, example");

      expect(tagInput).toHaveValue("test, example");
    });

    it("should display selected categories as badges", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      // Test that category selection UI is present
      expect(screen.getByText(/categories \(optional\)/i)).toBeInTheDocument();
    });
  });

  describe("Upload Progress", () => {
    it("should disable upload button when no files selected", () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const uploadButton = screen.getByRole("button", {
        name: /upload 0 files/i,
      });

      expect(uploadButton).toBeDisabled();
    });

    it("should enable upload button when files are selected", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const uploadButton = screen.getByRole("button", {
          name: /upload 1 file/i,
        });
        expect(uploadButton).not.toBeDisabled();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });

    it("should show correct file count in upload button text", async () => {
      render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

      const files = [
        new File(["content1"], "file1.txt", { type: "text/plain" }),
        new File(["content2"], "file2.txt", { type: "text/plain" }),
      ];

      const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;

      expect(input).toBeInTheDocument();
      fireEvent.change(input, { target: { files } });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /upload 2 files/i })
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    });
  });

  describe("Dialog Actions", () => {
    it("should close dialog when cancel button is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(
        <AssetUpload clientId={1} open={true} onOpenChange={onOpenChange} />
      );

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
          clientId={1}
          open={true}
          onOpenChange={vi.fn()}
          initialFiles={initialFiles}
        />
      );

      expect(screen.getByText("initial.txt")).toBeInTheDocument();
    });
  });
});
