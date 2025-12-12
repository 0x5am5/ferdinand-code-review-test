/**
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { type BrandAsset, UserRole, DEFAULT_SECTION_DESCRIPTIONS } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { RoleSwitchingProvider } from "@/contexts/role-switching-context";
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
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  sortOrder: 0,
});

describe("LogoSection - Description Display", () => {
  let queryClient: QueryClient;
  const mockOnDeleteLogo = vi.fn();
  const mockOnRemoveSection = vi.fn();
  const clientId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
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
        <RoleSwitchingProvider>
          <LogoSection
            type={logoType}
            logos={logos}
            clientId={clientId}
            onDeleteLogo={mockOnDeleteLogo}
            queryClient={queryClient}
            onRemoveSection={mockOnRemoveSection}
          />
        </RoleSwitchingProvider>
      </QueryClientProvider>
    );
  };

  describe("Role-based Rendering", () => {
    it("should show editable description for Editor role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      // Look for the editable element (has role="button" and aria-label)
      const editableElement = screen.getByRole("button", {
        name: /Main Logo description/i,
      });
      expect(editableElement).toBeInTheDocument();
    });

    it("should show editable description for Admin role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.ADMIN);

      const editableElement = screen.getByRole("button", {
        name: /Main Logo description/i,
      });
      expect(editableElement).toBeInTheDocument();
    });

    it("should show editable description for SuperAdmin role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.SUPER_ADMIN);

      const editableElement = screen.getByRole("button", {
        name: /Main Logo description/i,
      });
      expect(editableElement).toBeInTheDocument();
    });

    it("should show static text for Standard role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.STANDARD);

      // Standard users should see the default description as static text
      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN)
      ).toBeInTheDocument();

      // Should not have editable elements
      const editableElements = screen.queryAllByRole("button", {
        name: /Main Logo description/i,
      });
      expect(editableElements).toHaveLength(0);
    });

    it("should show static text for Guest role", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.GUEST);

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN)
      ).toBeInTheDocument();

      const editableElements = screen.queryAllByRole("button", {
        name: /Main Logo description/i,
      });
      expect(editableElements).toHaveLength(0);
    });
  });

  describe("Description Display", () => {
    it("should show default description for main logo", () => {
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN)
      ).toBeInTheDocument();
    });

    it("should show default description for horizontal logo", () => {
      const logo = createMockLogo(2, "horizontal");
      renderLogoSection([logo], UserRole.EDITOR, "horizontal");

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_HORIZONTAL)
      ).toBeInTheDocument();
    });

    it("should show default description for vertical logo", () => {
      const logo = createMockLogo(3, "vertical");
      renderLogoSection([logo], UserRole.EDITOR, "vertical");

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_VERTICAL)
      ).toBeInTheDocument();
    });

    it("should show default description for square logo", () => {
      const logo = createMockLogo(4, "square");
      renderLogoSection([logo], UserRole.EDITOR, "square");

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_SQUARE)
      ).toBeInTheDocument();
    });

    it("should show default description for app-icon logo", () => {
      const logo = createMockLogo(5, "app-icon");
      renderLogoSection([logo], UserRole.EDITOR, "app-icon");

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_APP_ICON)
      ).toBeInTheDocument();
    });

    it("should show default description for favicon logo", () => {
      const logo = createMockLogo(6, "favicon");
      renderLogoSection([logo], UserRole.EDITOR, "favicon");

      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_FAVICON)
      ).toBeInTheDocument();
    });
  });

  describe("Inline Editing", () => {
    it("should allow editing description when clicked", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const editableElement = screen.getByRole("button", {
        name: /Main Logo description/i,
      });
      await user.click(editableElement);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveFocus();
        expect(textarea).toHaveValue(DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN);
      });
    });

    it("should call API when saving edited description", async () => {
      const user = userEvent.setup({ delay: null });
      const logo = createMockLogo(1, "main");
      renderLogoSection([logo], UserRole.EDITOR);

      const mockFetch = global.fetch as vi.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const editableElement = screen.getByRole("button", {
        name: /Main Logo description/i,
      });
      await user.click(editableElement);

      const textarea = await screen.findByRole("textbox");
      await user.clear(textarea);
      await user.type(textarea, "Updated description");

      // Click outside to trigger blur/save
      const heading = screen.getByText("Main Logo");
      await user.click(heading);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/clients/${clientId}/section-metadata/logo-main`,
          expect.objectContaining({
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              description: "Updated description",
            }),
          })
        );
      });
    });
  });

  describe("Multiple Logos", () => {
    it("should display section title and description when multiple logos exist", () => {
      const logos = [
        createMockLogo(1, "main"),
        createMockLogo(2, "main"),
      ];
      renderLogoSection(logos, UserRole.EDITOR);

      expect(screen.getByText("Main Logo")).toBeInTheDocument();
      expect(
        screen.getByText(DEFAULT_SECTION_DESCRIPTIONS.LOGO_MAIN)
      ).toBeInTheDocument();
    });
  });
});
