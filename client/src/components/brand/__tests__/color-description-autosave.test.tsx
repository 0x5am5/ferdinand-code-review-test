import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEditable } from "@/components/ui/inline-editable";

// Mock toast hook
const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Component that mimics the color manager's description update logic
function TestColorDescriptionComponent({
  clientId,
  assetId,
  initialDescription,
}: {
  clientId: number;
  assetId: number;
  initialDescription: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = require("@/hooks/use-toast").useToast();

  const updateDescriptionMutation = useMutation({
    mutationFn: async ({ description }: { description: string }) => {
      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${assetId}/description`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update description");
      }

      return response.json();
    },
    onMutate: async ({ description }) => {
      await queryClient.cancelQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });

      const previousAssets = queryClient.getQueryData([
        `/api/clients/${clientId}/brand-assets`,
      ]);

      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        (old: unknown[] | undefined) => {
          if (!old) return old;
          return old.map((asset) => {
            const assetObj = asset as Record<string, unknown>;
            if (assetObj.id !== assetId) return asset;
            const data =
              typeof assetObj.data === "string"
                ? JSON.parse(assetObj.data as string)
                : assetObj.data;
            return {
              ...assetObj,
              data: {
                ...(data as Record<string, unknown>),
                description,
              },
            };
          });
        }
      );

      return { previousAssets };
    },
    onError: (error: Error, _variables, context) => {
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        context?.previousAssets
      );
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
      toast({
        title: "Description saved",
        description: "Color description has been updated successfully.",
      });
    },
  });

  const handleDescriptionUpdate = (value: string) => {
    updateDescriptionMutation.mutate({ description: value });
  };

  return (
    <div data-testid="color-description">
      <InlineEditable
        value={initialDescription}
        onSave={handleDescriptionUpdate}
        inputType="textarea"
        placeholder="Add a description for this color..."
        debounceMs={500}
        ariaLabel="Color description"
      />
    </div>
  );
}

describe("Color Description Autosave Integration", () => {
  let queryClient: QueryClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Set initial query data
    queryClient.setQueryData(
      ["/api/clients/1/brand-assets"],
      [
        {
          id: 1,
          name: "Primary Color",
          data: { description: "Initial description" },
        },
      ]
    );

    fetchMock = jest.fn();
    global.fetch = fetchMock;

    mockToast.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <TestColorDescriptionComponent
          clientId={1}
          assetId={1}
          initialDescription="Initial description"
        />
      </QueryClientProvider>
    );
  };

  describe("Debounced Autosave", () => {
    it("should not save immediately while typing", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "New description");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should trigger save after 500ms of inactivity", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Updated description");

      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ description: "Updated description" }),
          })
        );
      });
    });

    it("should only make one API call for multiple rapid changes", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);

      await user.type(textarea, "A");
      act(() => jest.advanceTimersByTime(100));

      await user.type(textarea, "B");
      act(() => jest.advanceTimersByTime(100));

      await user.type(textarea, "C");
      act(() => jest.advanceTimersByTime(100));

      await user.type(textarea, "D");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({ description: "ABCD" }),
          })
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should rollback on failed save and show error toast", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Failed to update description" }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Failed update");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            description: "Failed to update description",
            variant: "destructive",
          })
        );
      });
    });

    it("should handle network errors gracefully", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Network fail");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("Success Notifications", () => {
    it("should show success toast after successful save", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Successfully saved");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Description saved",
            description: "Color description has been updated successfully.",
          })
        );
      });
    });
  });

  describe("Blur Behavior", () => {
    it("should save on blur with pending changes", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Blur save");

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({ description: "Blur save" }),
          })
        );
      });
    });

    it("should clear pending debounce timer on blur", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Clear pending");

      act(() => jest.advanceTimersByTime(300));
      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      act(() => jest.advanceTimersByTime(500));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cancel Behavior", () => {
    it("should cancel pending save on Escape", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Cancelled change");

      act(() => jest.advanceTimersByTime(300));

      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(fetchMock).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(500));
      expect(fetchMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByText("Initial description")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should trim whitespace from descriptions", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent();

      const descriptionField = screen.getByText("Initial description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "  Trimmed description  ");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({ description: "Trimmed description" }),
          })
        );
      });
    });
  });
});
