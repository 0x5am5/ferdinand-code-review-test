/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AssetUpload } from "../asset-upload";

// Avoid Radix Portal/focus-management side effects in JSDOM by mocking these UI primitives.
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");

  const DialogContext = React.createContext<{
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  } | null>(null);

  const Dialog = ({
    open,
    onOpenChange,
    children,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (
    <DialogContext.Provider value={{ open: Boolean(open), onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );

  const DialogTrigger = ({
    asChild,
    children,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => {
    const ctx = React.useContext(DialogContext);
    const child = React.Children.only(children);

    if (asChild && React.isValidElement(child)) {
      const onClick = (e: React.MouseEvent) => {
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

  const DialogContent = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    const ctx = React.useContext(DialogContext);
    if (!ctx?.open) return null;
    return (
      <div role="dialog" {...props}>
        {children}
      </div>
    );
  };

  const DialogHeader = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );
  const DialogTitle = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <h2 {...props}>{children}</h2>
  );
  const DialogDescription = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
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
  const React = await import("react");
  // Minimal non-portal select stubs.
  const Select = ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  );
  const SelectTrigger = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  const SelectValue = ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder ?? ""}</span>
  );
  const SelectContent = ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  );
  const SelectItem = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("AssetUpload", () => {
  beforeAll(() => {
    global.URL.createObjectURL = vi.fn(() => "mock-object-url");
    global.URL.revokeObjectURL = vi.fn();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the trigger button", () => {
    render(<AssetUpload clientId={1} />);
    expect(
      screen.getByRole("button", { name: /upload assets/i })
    ).toBeInTheDocument();
  });

  it("renders dialog contents when open=true", () => {
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

  it("selecting a file shows it in the selected files list", async () => {
    render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;
    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText("test.txt")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /upload 1 file/i })
      ).toBeInTheDocument();
    });
  });

  it("removing a selected file removes it from the list", async () => {
    render(<AssetUpload clientId={1} open={true} onOpenChange={vi.fn()} />);

    const input = screen.getByTestId("asset-upload-input") as HTMLInputElement;
    const file = new File(["hello"], "test.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("test.txt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /remove test\.txt/i }));

    await waitFor(() => {
      expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
      expect(screen.queryByText(/selected files/i)).not.toBeInTheDocument();
    });
  });

  it("initialFiles prop shows files when open", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("initial.txt")).toBeInTheDocument();
      expect(screen.getByText(/selected files \(1\)/i)).toBeInTheDocument();
    });
  });
});
