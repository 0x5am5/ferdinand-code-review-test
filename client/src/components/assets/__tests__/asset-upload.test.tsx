/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AssetUpload } from "../asset-upload";

// Avoid Radix Portal/focus-management side effects in JSDOM by mocking these UI primitives.
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

    if (asChild && React.isValidElement(child)) {
      const onClick = (e: any) => {
        child.props.onClick?.(e);
        ctx?.onOpenChange?.(true);
      };
      return React.cloneElement(child, { onClick });
    }

    return (
      <button type="button" onClick={() => ctx?.onOpenChange?.(true)}>
        {children}
      </button>
    );
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

vi.mock("@/components/ui/select", async () => {
  // Minimal non-portal select stubs.
  const Select = ({ children }: any) => <div>{children}</div>;
  const SelectTrigger = ({ children, ...props }: any) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const SelectValue = ({ placeholder }: any) => (
    <span>{placeholder ?? ""}</span>
  );
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

// Keep queries deterministic and synchronous.
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

  it("renders the trigger button", () => {
    render(<AssetUpload clientId={1} />);
    expect(
      screen.getByRole("button", { name: /upload assets/i })
    ).toBeInTheDocument();
  });

  it.skip("renders dialog contents when open=true", () => {
    render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText(/drag and drop files here, or click to browse/i)
    ).toBeInTheDocument();

    // Basic controls present
    expect(screen.getByText(/visibility/i)).toBeInTheDocument();
    expect(screen.getByText(/categories \(optional\)/i)).toBeInTheDocument();
    expect(screen.getByText(/tags \(optional\)/i)).toBeInTheDocument();

    // Action buttons present
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload 0 files/i })
    ).toBeInTheDocument();
  });

  it.skip("selecting a file shows it in the selected files list", () => {
    render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;
    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("test.txt")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload 1 file/i })
    ).toBeInTheDocument();
  });

  it.skip("removing a selected file removes it from the list", () => {
    render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;
    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("test.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove test\.txt/i }));

    expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
    expect(screen.queryByText(/selected files/i)).not.toBeInTheDocument();
  });

  it.skip("initialFiles prop shows files when open", () => {
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
    expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
  });
});
