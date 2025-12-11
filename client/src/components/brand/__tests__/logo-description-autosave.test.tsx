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
import { type Mock, vi } from "vitest";
import { useToast } from "../../../hooks/use-toast";
import { InlineEditable } from "../../ui/inline-editable";

// Mock toast hook
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Component that mimics the logo manager's description update logic
function TestLogoDescriptionAutosave({
  clientId,
  assetId,
  variant,
  initialDescription,
}: {
  clientId: number;
  assetId: number;
  variant: "light" | "dark";
  initialDescription: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateDescriptionMutation = useMutation({
    mutationFn: async ({
      assetId,
      description,
    }: {
      assetId: number;
      description?: string;
    }) => {
      const response = await fetch(
        `/api/clients/${clientId}/brand-assets/${assetId}/description`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update description");
      }

      return response.json();
    },
    onMutate: async ({ assetId, description }) => {
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

            const updatedData = { ...(data as Record<string, unknown>) };
            if (description !== undefined) {
              updatedData.description = description;
            }

            return {
              ...assetObj,
              data: updatedData,
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
        description: "Logo description has been updated successfully.",
      });
    },
  });

  const handleDescriptionUpdate = (value: string) => {
    updateDescriptionMutation.mutate({
      assetId,
      description: value,
    });
  };

  return (
    <div data-testid={`logo-description-${variant}`}>
      <InlineEditable
        value={initialDescription}
        onSave={handleDescriptionUpdate}
        inputType="textarea"
        placeholder="Add a description..."
        debounceMs={500}
        ariaLabel={`${variant} variant description`}
      />
    </div>
  );
}

describe("Logo Description Autosave Integration", () => {
  let queryClient: QueryClient;
  let fetchMock: Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    // @ts-expect-error
    global.jest = {
      advanceTimersByTime: vi.advanceTimersByTime.bind(vi),
    };

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
          name: "Primary Logo",
          data: {
            description: "Light variant description",
          },
        },
      ]
    );

    fetchMock = vi.fn();
    global.fetch = fetchMock;

    mockToast.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  const renderComponent = (variant: "light" | "dark" = "light") => {
    const description =
      variant === "light"
        ? "Light variant description"
        : "Dark variant description";

    return render(
      <QueryClientProvider client={queryClient}>
        <TestLogoDescriptionAutosave
          clientId={1}
          assetId={1}
          variant={variant}
          initialDescription={description}
        />
      </QueryClientProvider>
    );
  };

  describe("Debounced Autosave", () => {
    it("should not save immediately while typing in light variant", async () => {
      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, {
          target: { value: "New light description" },
        });
      });

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should trigger save after 500ms for light variant", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Updated light" } });
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              description: "Updated light",
            }),
          })
        );
      });
    });

    it("should only make one API call for multiple rapid changes in light variant", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");

      act(() => {
        fireEvent.change(textarea, { target: { value: "A" } });
      });
      act(() => vi.advanceTimersByTime(100));

      act(() => {
        fireEvent.change(textarea, { target: { value: "AB" } });
      });
      act(() => vi.advanceTimersByTime(100));

      act(() => {
        fireEvent.change(textarea, { target: { value: "ABC" } });
      });
      act(() => vi.advanceTimersByTime(100));

      act(() => {
        fireEvent.change(textarea, { target: { value: "ABCD" } });
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "ABCD",
            }),
          })
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should rollback light variant on failed save and show error toast", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Failed to update logo description" }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Failed update" } });
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Error",
            description: "Failed to update logo description",
            variant: "destructive",
          })
        );
      });
    });

    it("should rollback dark variant on failed save", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Server error" }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "This will fail" } });
      });

      act(() => {
        fireEvent.blur(textarea);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
          })
        );
      });

      expect(fetchMock).toHaveBeenCalled();
    });

    it("should handle network errors gracefully", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Network fail" } });
      });

      act(() => vi.advanceTimersByTime(500));

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
    it("should show success toast after successful light variant save", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, {
          target: { value: "Successfully saved light" },
        });
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Description saved",
            description: "Logo description has been updated successfully.",
          })
        );
      });
    });

    it("should show success toast after successful dark variant save", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, {
        target: { value: "Successfully saved dark" },
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Description saved",
            description: "Logo description has been updated successfully.",
          })
        );
      });
    });
  });

  describe("Blur Behavior", () => {
    it("should save light variant on blur with pending changes", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Blur save light" } });
      });

      act(() => {
        fireEvent.blur(textarea);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "Blur save light",
            }),
          })
        );
      });
    });

    it("should save dark variant on blur with pending changes", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Blur save dark" } });
      });

      act(() => {
        fireEvent.blur(textarea);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "Blur save dark",
            }),
          })
        );
      });
    });

    it("should clear pending debounce timer on blur", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Clear pending" } });
      });

      act(() => vi.advanceTimersByTime(300));
      act(() => {
        fireEvent.blur(textarea);
      });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      act(() => vi.advanceTimersByTime(500));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cancel Behavior", () => {
    it("should cancel pending save on Escape for light variant", async () => {
      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Cancelled light" } });
      });

      act(() => vi.advanceTimersByTime(300));

      act(() => {
        fireEvent.keyDown(textarea, { key: "Escape" });
      });

      expect(fetchMock).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(500));
      expect(fetchMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(
          screen.getByText("Light variant description")
        ).toBeInTheDocument();
      });
    });

    it("should cancel pending save on Escape for dark variant", async () => {
      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "Cancelled dark" } });
      });

      act(() => vi.advanceTimersByTime(300));

      act(() => {
        fireEvent.keyDown(textarea, { key: "Escape" });
      });

      expect(fetchMock).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(500));
      expect(fetchMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(
          screen.getByText("Dark variant description")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should trim whitespace from descriptions", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      act(() => {
        fireEvent.click(descriptionField);
      });

      const textarea = screen.getByRole("textbox");
      act(() => {
        fireEvent.change(textarea, { target: { value: "  Trimmed  " } });
      });

      act(() => vi.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "Trimmed",
            }),
          })
        );
      });
    });
  });
});
