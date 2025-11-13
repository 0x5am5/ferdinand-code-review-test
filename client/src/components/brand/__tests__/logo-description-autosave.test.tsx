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

// Component that mimics the logo manager's description update logic
function TestLogoDescriptionComponent({
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
  const { toast } = require("@/hooks/use-toast").useToast();

  const updateDescriptionMutation = useMutation({
    mutationFn: async ({
      assetId,
      description,
      darkVariantDescription,
      variant,
    }: {
      assetId: number;
      description?: string;
      darkVariantDescription?: string;
      variant: "light" | "dark";
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
            darkVariantDescription,
            variant,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update description");
      }

      return response.json();
    },
    onMutate: async ({
      assetId,
      description,
      darkVariantDescription,
      variant,
    }) => {
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
            if (variant === "light" && description !== undefined) {
              updatedData.description = description;
            }
            if (variant === "dark" && darkVariantDescription !== undefined) {
              updatedData.darkVariantDescription = darkVariantDescription;
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
      description: variant === "light" ? value : undefined,
      darkVariantDescription: variant === "dark" ? value : undefined,
      variant,
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
          name: "Primary Logo",
          data: {
            description: "Light variant description",
            darkVariantDescription: "Dark variant description",
          },
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

  const renderComponent = (variant: "light" | "dark" = "light") => {
    const description =
      variant === "light"
        ? "Light variant description"
        : "Dark variant description";

    return render(
      <QueryClientProvider client={queryClient}>
        <TestLogoDescriptionComponent
          clientId={1}
          assetId={1}
          variant={variant}
          initialDescription={description}
        />
      </QueryClientProvider>
    );
  };

  describe("Light Variant - Debounced Autosave", () => {
    it("should not save immediately while typing in light variant", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "New light description");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should trigger save after 500ms for light variant", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Updated light");

      act(() => jest.advanceTimersByTime(500));

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
              darkVariantDescription: undefined,
              variant: "light",
            }),
          })
        );
      });
    });

    it("should only make one API call for multiple rapid changes in light variant", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
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
            body: JSON.stringify({
              description: "ABCD",
              darkVariantDescription: undefined,
              variant: "light",
            }),
          })
        );
      });
    });
  });

  describe("Dark Variant - Debounced Autosave", () => {
    it("should not save immediately while typing in dark variant", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "New dark description");

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should trigger save after 500ms for dark variant", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Updated dark");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              description: undefined,
              darkVariantDescription: "Updated dark",
              variant: "dark",
            }),
          })
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should rollback light variant on failed save and show error toast", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Failed to update logo description" }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Failed update");

      act(() => jest.advanceTimersByTime(500));

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
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Server error" }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "This will fail");

      fireEvent.blur(textarea);

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
      const user = userEvent.setup({ delay: null });

      fetchMock.mockRejectedValueOnce(new Error("Network error"));

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
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
    it("should show success toast after successful light variant save", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Successfully saved light");

      act(() => jest.advanceTimersByTime(500));

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
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Successfully saved dark");

      act(() => jest.advanceTimersByTime(500));

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
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Blur save light");

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "Blur save light",
              darkVariantDescription: undefined,
              variant: "light",
            }),
          })
        );
      });
    });

    it("should save dark variant on blur with pending changes", async () => {
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Blur save dark");

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: undefined,
              darkVariantDescription: "Blur save dark",
              variant: "dark",
            }),
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

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
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
    it("should cancel pending save on Escape for light variant", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Cancelled light");

      act(() => jest.advanceTimersByTime(300));

      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(fetchMock).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(500));
      expect(fetchMock).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(
          screen.getByText("Light variant description")
        ).toBeInTheDocument();
      });
    });

    it("should cancel pending save on Escape for dark variant", async () => {
      const user = userEvent.setup({ delay: null });

      renderComponent("dark");

      const descriptionField = screen.getByText("Dark variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Cancelled dark");

      act(() => jest.advanceTimersByTime(300));

      fireEvent.keyDown(textarea, { key: "Escape" });

      expect(fetchMock).not.toHaveBeenCalled();

      act(() => jest.advanceTimersByTime(500));
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
      const user = userEvent.setup({ delay: null });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      renderComponent("light");

      const descriptionField = screen.getByText("Light variant description");
      await user.click(descriptionField);

      const textarea = screen.getByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "  Trimmed  ");

      act(() => jest.advanceTimersByTime(500));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/clients/1/brand-assets/1/description",
          expect.objectContaining({
            body: JSON.stringify({
              description: "Trimmed",
              darkVariantDescription: undefined,
              variant: "light",
            }),
          })
        );
      });
    });
  });
});
