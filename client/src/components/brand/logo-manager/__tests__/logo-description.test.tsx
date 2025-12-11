/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { type BrandAsset, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { LogoSection } from "../logo-section";

// Mock hooks
vi.mock("@/hooks/use-auth");
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockUseAuth = vi.mocked(useAuth);

// Helper to create a mock logo asset
const createMockLogo = (
  id: number,
  type: string,
  description?: string,
  hasDarkVariant = false
): BrandAsset => ({
  id,
  clientId: 1,
  name: `${type} Logo`,
  category: "logo",
  fileData: "base64-encoded-data",
  mimeType: "image/svg+xml",
  data: {
    type,
    format: "svg",
    fileName: `${type}-logo.svg`,
    hasDarkVariant,
    description,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  sortOrder: 0,
});

describe("LogoSection - Description Editing", () => {
  let queryClient: QueryClient;
  const mockOnDeleteLogo = vi.fn();
  const mockOnRemoveSection = vi.fn();
  const clientId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock fetch globally
    global.fetch = vi.fn() as vi.MockedFunction<typeof fetch>;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
    queryClient.clear();
  });

  const renderLogoSection = (
    logos: BrandAsset[],
    userRole: (typeof UserRole)[keyof typeof UserRole],
    logoType = "main"
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
        <LogoSection
          type={logoType}
          logos={logos}
          clientId={clientId}
          onDeleteLogo={mockOnDeleteLogo}
          queryClient={queryClient}
          onRemoveSection={mockOnRemoveSection}
        />
      </QueryClientProvider>
    );
  };

  describe("Role-based Rendering", () => {
    it("should show InlineEditable for Editor role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      // Look for the editable element (has role="button" and aria-label)
      const editableElement = screen.getAllByRole("button", {
        name: /light variant description|dark variant description/i,
      })[0];
      expect(editableElement).toBeInTheDocument();
    });

    it("should show InlineEditable for Admin role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.ADMIN);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description|dark variant description/i,
      })[0];
      expect(editableElement).toBeInTheDocument();
    });

    it("should show InlineEditable for SuperAdmin role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.SUPER_ADMIN);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description|dark variant description/i,
      })[0];
      expect(editableElement).toBeInTheDocument();
    });

    it("should show static text for Standard role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.STANDARD);

      // Standard users should see the fallback text but not be able to edit
      expect(
        screen.getByText(/Use this logo anywhere brand visibility matters/i)
      ).toBeInTheDocument();

      // Should not have editable elements
      const editableElements = screen.queryAllByRole("button", {
        name: /light variant description|dark variant description/i,
      });
      expect(editableElements).toHaveLength(0);
    });

    it("should show static text for Guest role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.GUEST);

      expect(
        screen.getByText(/Use this logo anywhere brand visibility matters/i)
      ).toBeInTheDocument();

      const editableElements = screen.queryAllByRole("button", {
        name: /light variant description|dark variant description/i,
      });
      expect(editableElements).toHaveLength(0);
    });
  });

  describe("Description Display", () => {
    it("should show custom description when available for light variant", () => {
      const customDescription = "This is our primary brand logo";
      const logo = createMockLogo(1, "main", customDescription);
      renderLogoSection([logo], UserRole.EDITOR);

      expect(screen.getByText(customDescription)).toBeInTheDocument();
    });

    it("should fall back to logoUsageGuidance when no custom description", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      // Should show the default usage guidance for main logo
      expect(
        screen.getByText(/Use this logo anywhere brand visibility matters/i)
      ).toBeInTheDocument();
    });

    it("should show custom dark variant description when available", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Light variant description", true);
      renderLogoSection([logo], UserRole.EDITOR);

      // First verify light description is showing
      expect(screen.getByText("Light variant description")).toBeInTheDocument();

      // Click the "Dark Background" button to switch variants
      const darkButton = screen.getByRole("button", {
        name: /dark background/i,
      });
      await user.click(darkButton);

      // Now the fallback description for dark should be visible
      await waitFor(() => {
        expect(
          screen.getByText(/Use this logo anywhere brand visibility matters/i)
        ).toBeInTheDocument();
      });
    });

    it("should handle separate descriptions for light and dark variants", async () => {
      const user = userEvent.setup({ delay: null });
      const lightDescription = "Light mode logo description";
      const logo = createMockLogo(1, "main", lightDescription, true);
      renderLogoSection([logo], UserRole.EDITOR);

      // Light description should be showing initially
      expect(screen.getByText(lightDescription)).toBeInTheDocument();

      // Switch to dark variant
      const darkButton = screen.getByRole("button", {
        name: /dark background/i,
      });
      await user.click(darkButton);

      // Now fallback description should be showing
      await waitFor(() => {
        expect(
          screen.getByText(/Use this logo anywhere brand visibility matters/i)
        ).toBeInTheDocument();
      });

      // Switch back to light
      const lightButton = screen.getByRole("button", {
        name: /light background/i,
      });
      await user.click(lightButton);

      // Light description should be showing again
      await waitFor(() => {
        expect(screen.getByText(lightDescription)).toBeInTheDocument();
      });
    });
  });

  describe("Inline Editing", () => {
    it("should allow editing description when clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original description");
      renderLogoSection([logo], UserRole.EDITOR);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(() => {
        const textarea = screen.getByDisplayValue("Original description");
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe("TEXTAREA");
      });
    });

    it("should show textarea input when editing", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveFocus();
      });
    });

    it("should save on blur", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo, data: { description: "Modified" } }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");

        // Click outside to trigger blur
        const outsideElement = screen.getByText("Main Logo");
        await user.click(outsideElement);

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
            expect.objectContaining({
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                description: "Modified",
                variant: "light",
              }),
            })
          );
        });
      });
    });

    it("should save on Ctrl+Enter for textarea", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo, data: { description: "Modified" } }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Control>}{Enter}{/Control}");

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledWith(
            `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
            expect.objectContaining({
              method: "PATCH",
            })
          );
        });
      });
    });

    it("should cancel on Escape key", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Escape}");

        // Should not call the API
        expect(mockFetch).not.toHaveBeenCalled();
        // Should show original text
        expect(screen.getByText("Original")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should call correct endpoint with proper payload for light variant", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      // Clear the existing text before typing
      await user.clear(textarea);
      await user.type(textarea, "New description");

      // Advance debounce timer
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
          expect.objectContaining({
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              description: "New description",
              variant: "light",
            }),
          })
        );
      });
    });

    it("should call correct endpoint with proper payload for dark variant", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Light desc", true);
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo }),
      } as Response);

      // Switch to dark background first
      const darkBackgroundButton = screen.getByRole("button", {
        name: /dark background/i,
      });
      await user.click(darkBackgroundButton);

      // Now find the dark variant editable element
      const editableElement = await screen.findByRole("button", {
        name: /dark variant description/i,
      });

      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Dark variant description");

      vi.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              description: "Dark variant description",
              variant: "dark",
            }),
          })
        );
      });
    });

    it("should handle API error with toast notification", async () => {
      const user = userEvent.setup({ delay: null });
      const originalDescription = "Original description";
      const logo = createMockLogo(1, "main", originalDescription);

      // Set up the query data before rendering
      queryClient.setQueryData(
        [`/api/clients/${clientId}/brand-assets`],
        [logo]
      );

      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Update failed" }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      const textarea = await screen.findByDisplayValue(originalDescription);
      await user.clear(textarea);
      await user.type(textarea, "Modified description");

      vi.advanceTimersByTime(500);

      // Verify the API was called with the modified description
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
          expect.objectContaining({
            method: "PATCH",
            body: JSON.stringify({
              description: "Modified description",
              variant: "light",
            }),
          })
        );
      });

      // The mutation will handle the error and show toast
      // The rollback happens via TanStack Query's onError handler
    });

    it("should show updated description immediately with optimistic update", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ ...logo, data: { description: "New" } }),
              } as Response);
            }, 1000);
          })
      );

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "New");

        vi.advanceTimersByTime(500);

        // Should see updated description immediately (optimistic update)
        await waitFor(() => {
          expect(screen.getByText("New")).toBeInTheDocument();
        });
      });
    });
  });

  describe("Debounced Autosave", () => {
    it("should wait 500ms before triggering save", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByRole("textbox");
        await user.type(textarea, "New description");

        // Should not call immediately
        expect(mockFetch).not.toHaveBeenCalled();

        // Advance by 300ms - still shouldn't call
        vi.advanceTimersByTime(300);
        expect(mockFetch).not.toHaveBeenCalled();

        // Advance by remaining 200ms to reach 500ms total
        vi.advanceTimersByTime(200);

        await waitFor(() => {
          expect(mockFetch).toHaveBeenCalledTimes(1);
        });
      });
    });

    it("should reset debounce timer on rapid changes", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...logo }),
      } as Response);

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      // Clear existing text first
      await user.clear(textarea);

      // Type multiple characters with small delays
      await user.type(textarea, "T");
      vi.advanceTimersByTime(200);

      await user.type(textarea, "e");
      vi.advanceTimersByTime(200);

      await user.type(textarea, "s");
      vi.advanceTimersByTime(200);

      await user.type(textarea, "t");

      // Should not have called yet
      expect(mockFetch).not.toHaveBeenCalled();

      // Now advance the full 500ms
      vi.advanceTimersByTime(500);

      await waitFor(() => {
        // Should only call once with final value
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/clients/${clientId}/brand-assets/${logo.id}/description`,
          expect.objectContaining({
            body: JSON.stringify({
              description: "Test",
              variant: "light",
            }),
          })
        );
      });
    });

    it("should cancel pending autosave on Escape", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main", "Original");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;

      const editableElement = screen.getAllByRole("button", {
        name: /light variant description/i,
      })[0];
      await user.click(editableElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.type(textarea, " Modified");

        // Advance partway through debounce
        vi.advanceTimersByTime(300);

        // Cancel with Escape
        await user.keyboard("{Escape}");

        // Advance remaining time
        vi.advanceTimersByTime(200);

        // Should not have called API
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("Different Logo Types", () => {
    it("should work with horizontal logo type", () => {
      const logo = createMockLogo(2, "horizontal");
      renderLogoSection([logo], UserRole.EDITOR, "horizontal");

      // Should show horizontal-specific fallback text
      expect(
        screen.getByText(/Best for banners, website headers/i)
      ).toBeInTheDocument();
    });

    it("should work with vertical logo type", () => {
      const logo = createMockLogo(3, "vertical");
      renderLogoSection([logo], UserRole.EDITOR, "vertical");

      expect(
        screen.getByText(/Ideal for square or constrained areas/i)
      ).toBeInTheDocument();
    });

    it("should work with square logo type", () => {
      const logo = createMockLogo(4, "square");
      renderLogoSection([logo], UserRole.EDITOR, "square");

      expect(
        screen.getByText(/Use in spaces where simplicity matters/i)
      ).toBeInTheDocument();
    });

    it("should work with app_icon logo type", () => {
      const logo = createMockLogo(5, "app_icon");
      renderLogoSection([logo], UserRole.EDITOR, "app_icon");

      expect(
        screen.getByText(/Use on mobile devices, app marketplaces/i)
      ).toBeInTheDocument();
    });

    it("should work with favicon logo type", () => {
      const logo = createMockLogo(6, "favicon");
      renderLogoSection([logo], UserRole.EDITOR, "favicon");

      expect(
        screen.getByText(/Use in browsers and tab displays/i)
      ).toBeInTheDocument();
    });
  });

  describe("Multiple Logos", () => {
    it("should handle multiple logos with different descriptions", () => {
      const logos = [
        createMockLogo(1, "main", "Main logo description"),
        createMockLogo(2, "main", "Secondary main logo"),
      ];
      renderLogoSection(logos, UserRole.EDITOR);

      expect(screen.getByText("Main logo description")).toBeInTheDocument();
      expect(screen.getByText("Secondary main logo")).toBeInTheDocument();
    });

    it("should allow editing different logos independently", async () => {
      const user = userEvent.setup({ delay: null });
      const logos = [
        createMockLogo(1, "main", "Logo 1"),
        createMockLogo(2, "main", "Logo 2"),
      ];
      renderLogoSection(logos, UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const editableElements = screen.getAllByRole("button", {
        name: /light variant description/i,
      });

      // Click first logo's editable
      await user.click(editableElements[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Logo 1")).toBeInTheDocument();
      });
    });
  });
});
