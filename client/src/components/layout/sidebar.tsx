import { type Client, type FeatureToggles, UserRole } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import {
  BuildingIcon,
  ChevronDown,
  CircleUserIcon,
  HomeIcon,
  LogOutIcon,
  PaletteIcon,
  Search,
  UsersIcon,
} from "lucide-react";
import type React from "react";
import { type FC, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { SpotlightSearch } from "@/components/search/spotlight-search";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { useSpotlight } from "@/hooks/use-spotlight";
import { useClientsQuery } from "@/lib/queries/clients";
import { ClientSidebar } from "./client-sidebar";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
}

/**
 * Application sidebar navigation
 */
export const Sidebar: FC = () => {
  const [location] = useLocation();
  const params = useParams();
  const { user, logout } = useAuth();
  const {
    isOpen: showSearch,
    open: openSearch,
    close: closeSearch,
  } = useSpotlight();
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Check if we're on a client detail page
  const isClientDetailPage =
    location.startsWith("/clients/") && location !== "/clients";

  // Sync activeTab with URL parameters when on client detail page
  useEffect(() => {
    if (isClientDetailPage) {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab) {
        setActiveTab(tab);
      } else {
        setActiveTab("dashboard"); // Default to dashboard if no tab parameter
      }
    }
  }, [isClientDetailPage]);

  // Listen for tab change events from the client detail page
  useEffect(() => {
    const handleTabChange = (e: CustomEvent) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };

    window.addEventListener(
      "client-tab-change",
      handleTabChange as EventListener
    );

    return () => {
      window.removeEventListener(
        "client-tab-change",
        handleTabChange as EventListener
      );
    };
  }, []);
  let clientId: number | null = null;

  if (isClientDetailPage && params?.id) {
    clientId = parseInt(params.id, 10);
  }

  // Fetch client data if we're on a client page
  // For super_admins, use the admin clients query
  // For other users, use their assigned clients
  const { data: adminClients = [] } = useClientsQuery();
  const { data: userClients = [] } = useQuery<Client[]>({
    queryKey: ["/api/user/clients"],
    queryFn: async () => {
      const response = await fetch("/api/user/clients");
      if (!response.ok) {
        throw new Error("Failed to fetch user clients");
      }
      return response.json();
    },
    enabled: !!user && user.role !== UserRole.SUPER_ADMIN,
  });

  // Use appropriate client list based on user role
  const clients =
    user?.role === UserRole.SUPER_ADMIN ? adminClients : userClients;
  const currentClient = clients.length
    ? clients.find((client) => client.id === clientId)
    : null;

  // Default feature toggles
  const defaultFeatureToggles = {
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
    brandAssets: false,
    figmaIntegration: false,
    slackIntegration: false,
  };

  // Check if admin has multiple clients to determine nav items
  const isMultiClientAdmin =
    user?.role === UserRole.ADMIN && clients.length > 1;

  // Navigation items
  const navItems: NavItem[] = [
    // Show Dashboard for super_admins and multi-client admins
    ...(user?.role === UserRole.SUPER_ADMIN || isMultiClientAdmin
      ? [
          {
            title: "Dashboard",
            href: "/dashboard",
            icon: <HomeIcon className="h-4 w-4" />,
          },
        ]
      : []),
    // Show Clients and Users for super_admins and multi-client admins
    ...(user?.role === UserRole.SUPER_ADMIN || isMultiClientAdmin
      ? [
          {
            title: "Clients",
            href: "/clients",
            icon: <BuildingIcon className="h-4 w-4" />,
          },
          {
            title: "Users",
            href: "/users",
            icon: <UsersIcon className="h-4 w-4" />,
          },
        ]
      : []),
    // Only show Design Builder for single-client admins, editors, and super admins
    ...(user?.role === UserRole.SUPER_ADMIN ||
    (user?.role === UserRole.ADMIN && !isMultiClientAdmin) ||
    user?.role === UserRole.EDITOR
      ? [
          {
            title: "Design Builder",
            href: "/design-builder",
            icon: <PaletteIcon className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  const isActiveLink = (href: string) => {
    if (href === "/clients" && location.startsWith("/clients/")) {
      return true;
    }
    return location === href;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: unknown) {
      console.error(
        "Logout error:",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  };

  // If we're on a client detail page, render the client sidebar
  if (isClientDetailPage && clientId && currentClient) {
    // Safely handle feature toggles with proper type casting
    const clientToggles = (currentClient.featureToggles ||
      {}) as FeatureToggles;

    const featureToggles = {
      logoSystem:
        typeof clientToggles.logoSystem === "boolean"
          ? clientToggles.logoSystem
          : defaultFeatureToggles.logoSystem,
      colorSystem:
        typeof clientToggles.colorSystem === "boolean"
          ? clientToggles.colorSystem
          : defaultFeatureToggles.colorSystem,
      typeSystem:
        typeof clientToggles.typeSystem === "boolean"
          ? clientToggles.typeSystem
          : defaultFeatureToggles.typeSystem,
      userPersonas:
        typeof clientToggles.userPersonas === "boolean"
          ? clientToggles.userPersonas
          : defaultFeatureToggles.userPersonas,
      inspiration:
        typeof clientToggles.inspiration === "boolean"
          ? clientToggles.inspiration
          : defaultFeatureToggles.inspiration,
      figmaIntegration:
        typeof clientToggles.figmaIntegration === "boolean"
          ? clientToggles.figmaIntegration
          : defaultFeatureToggles.figmaIntegration,
      slackIntegration:
        typeof clientToggles.slackIntegration === "boolean"
          ? clientToggles.slackIntegration
          : defaultFeatureToggles.slackIntegration,
      brandAssets:
        typeof clientToggles.brandAssets === "boolean"
          ? clientToggles.brandAssets
          : defaultFeatureToggles.brandAssets,
    };

    return (
      <ClientSidebar
        clientId={clientId}
        clientName={currentClient.name}
        featureToggles={featureToggles}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  }

  // Otherwise, render the standard navigation sidebar
  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-background flex flex-col z-50">
      <div className="p-4 flex justify-between items-center">
        <h2 className="font-bold">Ferdinand</h2>
      </div>

      <div className="px-4 py-2">
        <Button
          variant="outline"
          className="w-full justify-between text-muted-foreground"
          onClick={openSearch}
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search...</span>
          </div>
          <div className="flex items-center text-xs">
            <kbd className="rounded border px-1 py-0.5 bg-muted">⌘</kbd>
            <span className="mx-0.5">+</span>
            <kbd className="rounded border px-1 py-0.5 bg-muted">K</kbd>
          </div>
        </Button>
      </div>

      {showSearch ? (
        <div className="flex-1 flex flex-col">
          <SpotlightSearch className="flex-1" onClose={closeSearch} />
        </div>
      ) : (
        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`flex w-full justify-start items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-slate-100
                    ${
                      isActiveLink(item.href)
                        ? "bg-slate-100 font-medium"
                        : "hover:bg-muted/50"
                    }`}
                >
                  {item.icon}
                  {item.title}
                </Button>
              </Link>
            ))}
          </nav>
        </ScrollArea>
      )}

      <div className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-3"
            >
              <CircleUserIcon className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm m-0 font-medium truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate m-0">
                  {user?.email || "Unknown"}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" side="top">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
};
