import React, { FC, useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CircleUserIcon,
  HomeIcon,
  BuildingIcon,
  UsersIcon,
  PaletteIcon,
  LogOutIcon,
  ChevronDown,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/use-auth";
import { useSpotlight } from "@/hooks/use-spotlight";
import { SpotlightSearch } from "@/components/search/spotlight-search";
import { UserRole } from "@shared/schema";
import { ClientSidebar } from "./client-sidebar";
import { useClientsQuery } from "@/lib/queries/clients";

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
  const themeContext = useTheme();
  const { user } = useAuth();
  const {
    isOpen: showSearch,
    open: openSearch,
    close: closeSearch,
  } = useSpotlight();
  const [activeTab, setActiveTab] = useState<string>("logos");

  // Check if we're on a client detail page
  const isClientDetailPage =
    location.startsWith("/clients/") && location !== "/clients";
  let clientId: number | null = null;

  if (isClientDetailPage && params?.id) {
    clientId = parseInt(params.id, 10);
  }

  // Fetch client data if we're on a client page
  const { data: clients = [] } = useClientsQuery();
  const currentClient = clients.length
    ? clients.find((client) => client.id === clientId)
    : null;
  console.log(
    "Client ID:",
    clientId,
    "Found client?",
    !!currentClient,
    "Total clients:",
    clients.length,
  );

  const { logout } = useAuth();

  // Default feature toggles
  const defaultFeatureToggles = {
    logoSystem: true,
    colorSystem: true,
    typeSystem: true,
    userPersonas: true,
    inspiration: true,
  };

  // Navigation items
  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <HomeIcon className="h-4 w-4" />,
    },
    ...(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
      ? [
          {
            title: "Brands",
            href: "/clients",
            icon: <BuildingIcon className="h-4 w-4" />,
          },
        ]
      : []),
    ...(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN
      ? [
          {
            title: "Users",
            href: "/users",
            icon: <UsersIcon className="h-4 w-4" />,
          },
        ]
      : []),
    ...(user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
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
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const toggleTheme = async () => {
    if (
      !themeContext ||
      !themeContext.designSystem ||
      !themeContext.updateDesignSystem
    ) {
      console.error("Theme context not properly initialized");
      return;
    }

    const currentAppearance = themeContext.designSystem.theme.appearance;
    const newAppearance = currentAppearance === "dark" ? "light" : "dark";

    await themeContext.updateDesignSystem({
      theme: {
        ...themeContext.designSystem.theme,
        appearance: newAppearance,
      },
    });
  };

  // If we're on a client detail page, render the client sidebar
  if (isClientDetailPage && clientId && currentClient) {
    // Safely handle feature toggles with proper type casting
    const clientToggles = (currentClient.featureToggles || {}) as any;

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
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={openSearch}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
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
          <div className="mb-2 px-4">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center text-muted-foreground gap-1"
              onClick={closeSearch}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
          </div>
          <SpotlightSearch className="flex-1" onClose={closeSearch} />
        </div>
      ) : (
        <ScrollArea className="flex-1 py-4">
          <nav className="px-2 space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`flex w-full justify-start items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                    ${
                      isActiveLink(item.href)
                        ? "bg-muted font-medium"
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
              className="w-full justify-start gap-3 px-3 py-2"
            >
              <CircleUserIcon className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm m-0 font-medium truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
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
