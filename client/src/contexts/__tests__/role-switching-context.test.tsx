/**
 * @vitest-environment jsdom
 */

import type { User } from "@shared/schema";
import { UserRole } from "@shared/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
  RoleSwitchingProvider,
  useRoleSwitching,
} from "../role-switching-context";

// Mock the useAuth hook
const mockUseAuth = vi.fn();

vi.mock("../../hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Test component that uses the context
function TestComponent() {
  const {
    currentViewingRole,
    actualUserRole,
    switchRole,
    resetRole,
    isRoleSwitched,
    isReady,
    canAccessCurrentPage,
  } = useRoleSwitching();

  return (
    <div>
      <div data-testid="viewing-role">{currentViewingRole}</div>
      <div data-testid="actual-role">{actualUserRole}</div>
      <div data-testid="is-switched">
        {isRoleSwitched ? "switched" : "not-switched"}
      </div>
      <div data-testid="is-ready">{isReady ? "ready" : "not-ready"}</div>
      <button
        data-testid="switch-to-editor"
        onClick={() => switchRole(UserRole.EDITOR)}
      >
        Switch to Editor
      </button>
      <button
        data-testid="switch-to-standard"
        onClick={() => switchRole(UserRole.STANDARD)}
      >
        Switch to Standard
      </button>
      <button
        data-testid="switch-to-admin"
        onClick={() => switchRole(UserRole.ADMIN)}
      >
        Switch to Admin
      </button>
      <button data-testid="reset-role" onClick={resetRole}>
        Reset Role
      </button>
      <div data-testid="can-access-dashboard">
        {canAccessCurrentPage(UserRole.SUPER_ADMIN)
          ? "can-access"
          : "cannot-access"}
      </div>
      <div data-testid="can-access-editor">
        {canAccessCurrentPage(UserRole.EDITOR) ? "can-access" : "cannot-access"}
      </div>
    </div>
  );
}

describe("RoleSwitchingContext", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Mock window.location.pathname
    delete (window as any).location;
    (window as any).location = { pathname: "/design-builder" };

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    queryClient.clear();
  });

  describe("Initialization", () => {
    it("should initialize with user actual role when not super admin", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.EDITOR
      );
      expect(screen.getByTestId("actual-role")).toHaveTextContent(
        UserRole.EDITOR
      );
      expect(screen.getByTestId("is-switched")).toHaveTextContent(
        "not-switched"
      );
    });

    it("should initialize with persisted viewing role for super admin", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sessionStorage.setItem("ferdinand_viewing_role", UserRole.EDITOR);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });

      expect(screen.getByTestId("actual-role")).toHaveTextContent(
        UserRole.SUPER_ADMIN
      );
      expect(screen.getByTestId("is-switched")).toHaveTextContent("switched");
    });

    it("should initialize with super admin role when no persisted role exists", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.SUPER_ADMIN
      );
      expect(screen.getByTestId("is-switched")).toHaveTextContent(
        "not-switched"
      );
    });

    it("should initialize to guest role when user is null (not authenticated)", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.GUEST
      );
      expect(screen.getByTestId("actual-role")).toHaveTextContent(
        UserRole.GUEST
      );
    });

    it("should wait for auth to load before initializing", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: true,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      // Should be not-ready while loading
      expect(screen.getByTestId("is-ready")).toHaveTextContent("not-ready");
    });

    it("should clear sessionStorage when non-super-admin logs in", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sessionStorage.setItem("ferdinand_viewing_role", UserRole.ADMIN);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(sessionStorage.getItem("ferdinand_viewing_role")).toBeNull();
    });
  });

  describe("Role switching", () => {
    it("should allow super admin to switch roles", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.SUPER_ADMIN
      );

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });
      expect(screen.getByTestId("is-switched")).toHaveTextContent("switched");
    });

    it("should prevent non-super-admin from switching roles", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.EDITOR
      );

      // Try to switch to ADMIN
      act(() => {
        screen.getByTestId("switch-to-admin").click();
      });

      // Should remain EDITOR
      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.EDITOR
      );
      expect(screen.getByTestId("is-switched")).toHaveTextContent(
        "not-switched"
      );
    });

    it("should allow super admin to switch to multiple different roles", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });

      // Switch to STANDARD
      act(() => {
        screen.getByTestId("switch-to-standard").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.STANDARD
        );
      });

      // Switch to ADMIN
      act(() => {
        screen.getByTestId("switch-to-admin").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.ADMIN
        );
      });
    });
  });

  describe("isRoleSwitched flag", () => {
    it("should return false when viewing role equals actual role", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("is-switched")).toHaveTextContent(
        "not-switched"
      );
    });

    it("should return true when super admin viewing role differs from actual role", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch role
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("is-switched")).toHaveTextContent("switched");
      });
    });
  });

  describe("resetRole", () => {
    it("should restore actual role when called", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });

      // Reset
      act(() => {
        screen.getByTestId("reset-role").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.SUPER_ADMIN
        );
        expect(screen.getByTestId("is-switched")).toHaveTextContent(
          "not-switched"
        );
      });
    });

    it("should clear sessionStorage when reset is called", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(sessionStorage.getItem("ferdinand_viewing_role")).toBe(
          UserRole.EDITOR
        );
      });

      // Reset
      act(() => {
        screen.getByTestId("reset-role").click();
      });

      await waitFor(() => {
        expect(sessionStorage.getItem("ferdinand_viewing_role")).toBeNull();
      });
    });
  });

  describe("SessionStorage persistence", () => {
    it("should persist viewing role to sessionStorage when super admin switches", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(sessionStorage.getItem("ferdinand_viewing_role")).toBe(
          UserRole.EDITOR
        );
      });
    });

    it("should not persist viewing role for non-super-admin", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(sessionStorage.getItem("ferdinand_viewing_role")).toBeNull();
    });

    it("should reject invalid persisted roles from sessionStorage", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sessionStorage.setItem("ferdinand_viewing_role", "invalid_role");

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Should default to SUPER_ADMIN when persisted role is invalid
      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.SUPER_ADMIN
      );
    });
  });

  describe("canAccessCurrentPage", () => {
    it("should allow SUPER_ADMIN to access dashboard", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/dashboard";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("can-access-dashboard")).toHaveTextContent(
        "can-access"
      );
    });

    it("should prevent EDITOR from accessing dashboard", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/dashboard";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      // EDITOR should not be able to access dashboard
      // Note: canAccessCurrentPage is evaluated at initialization,
      // so we check if it would allow EDITOR role access
      const EditorAccessTest = () => {
        const { canAccessCurrentPage } = useRoleSwitching();
        return (
          <div>
            {canAccessCurrentPage(UserRole.EDITOR)
              ? "can-access"
              : "cannot-access"}
          </div>
        );
      };

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <EditorAccessTest />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      (window as any).location.pathname = "/dashboard";

      await waitFor(() => {
        expect(container.textContent).toContain("cannot-access");
      });
    });

    it("should allow ADMIN to access users page", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/users";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // After switching to ADMIN, should be able to access users page
      const AdminAccessTest = () => {
        const { canAccessCurrentPage } = useRoleSwitching();
        return (
          <div>
            {canAccessCurrentPage(UserRole.ADMIN)
              ? "can-access"
              : "cannot-access"}
          </div>
        );
      };

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <AdminAccessTest />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      (window as any).location.pathname = "/users";

      await waitFor(() => {
        expect(container.textContent).toContain("can-access");
      });
    });

    it("should allow EDITOR to access design-builder", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/design-builder";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("can-access-editor")).toHaveTextContent(
        "can-access"
      );
    });

    it("should allow all roles to access client pages", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/clients/123";

      const ClientAccessTest = () => {
        const { canAccessCurrentPage } = useRoleSwitching();
        const results = [
          UserRole.SUPER_ADMIN,
          UserRole.ADMIN,
          UserRole.EDITOR,
          UserRole.STANDARD,
          UserRole.GUEST,
        ]
          .map((role) => (canAccessCurrentPage(role) ? "can" : "cannot"))
          .join(",");
        return <div>{results}</div>;
      };

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <ClientAccessTest />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/can,can,can,can,can/)).toBeInTheDocument();
      });
    });
  });

  describe("Auto-revert when navigating to restricted pages", () => {
    it("should auto-revert when super admin navigates to page they cannot access with switched role", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/design-builder";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to STANDARD (cannot access dashboard)
      act(() => {
        screen.getByTestId("switch-to-standard").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.STANDARD
        );
      });

      // Navigate to dashboard
      (window as any).location.pathname = "/dashboard";

      // Trigger popstate event to simulate navigation
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      // Should auto-revert to SUPER_ADMIN since STANDARD cannot access dashboard
      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.SUPER_ADMIN
        );
      });
    });

    it("should not auto-revert when role can access current page", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      (window as any).location.pathname = "/design-builder";

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Switch to EDITOR (can access design-builder)
      act(() => {
        screen.getByTestId("switch-to-editor").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });

      // Remain on design-builder
      (window as any).location.pathname = "/design-builder";

      // Trigger popstate event
      act(() => {
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      // Should remain EDITOR since they can access design-builder
      expect(screen.getByTestId("viewing-role")).toHaveTextContent(
        UserRole.EDITOR
      );
    });
  });

  describe("Error cases and edge cases", () => {
    it("should handle context usage outside provider", () => {
      expect(() => {
        render(<TestComponent />);
      }).toThrow(
        "useRoleSwitching must be used within a RoleSwitchingProvider"
      );
    });

    it("should handle rapid role switches", async () => {
      const mockUser: User = {
        id: 1,
        email: "superadmin@example.com",
        role: UserRole.SUPER_ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      // Rapidly switch roles
      act(() => {
        screen.getByTestId("switch-to-editor").click();
        screen.getByTestId("switch-to-admin").click();
        screen.getByTestId("switch-to-standard").click();
        screen.getByTestId("switch-to-editor").click();
      });

      // Should end up in the last switched role
      await waitFor(() => {
        expect(screen.getByTestId("viewing-role")).toHaveTextContent(
          UserRole.EDITOR
        );
      });
    });

    it("should handle user role changes", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });

      expect(screen.getByTestId("actual-role")).toHaveTextContent(
        UserRole.EDITOR
      );

      // User is promoted to SUPER_ADMIN
      const promotedUser: User = {
        ...mockUser,
        role: UserRole.SUPER_ADMIN,
      };

      mockUseAuth.mockReturnValue({
        user: promotedUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      rerender(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      // Should update actual role
      await waitFor(() => {
        expect(screen.getByTestId("actual-role")).toHaveTextContent(
          UserRole.SUPER_ADMIN
        );
      });
    });
  });

  describe("isReady flag lifecycle", () => {
    it("should be false during initialization", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        firebaseUser: null,
        isLoading: true,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      expect(screen.getByTestId("is-ready")).toHaveTextContent("not-ready");
    });

    it("should be true after initialization completes", async () => {
      const mockUser: User = {
        id: 1,
        email: "editor@example.com",
        role: UserRole.EDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        firebaseUser: null,
        isLoading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RoleSwitchingProvider>
            <TestComponent />
          </RoleSwitchingProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("is-ready")).toHaveTextContent("ready");
      });
    });
  });
});
