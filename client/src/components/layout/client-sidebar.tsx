import type { BrandAsset } from "@shared/schema";
import {
  ArrowLeft,
  BookText,
  BuildingIcon,
  Figma,
  Image,
  LayoutDashboard,
  PaletteIcon,
  Search,
  UsersIcon,
} from "lucide-react";
import React, { type FC, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { SpotlightSearch } from "@/components/search/spotlight-search";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useSpotlight } from "@/hooks/use-spotlight";
import { useClientAssetsById } from "@/lib/queries/clients";

interface ClientSidebarProps {
  clientId: number;
  clientName: string;
  featureToggles: {
    logoSystem: boolean;
    colorSystem: boolean;
    typeSystem: boolean;
    userPersonas: boolean;
    inspiration: boolean;
    figmaIntegration: boolean;
  };
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

export const ClientSidebar: FC<ClientSidebarProps> = ({
  clientId,
  clientName,
  featureToggles,
  activeTab = "dashboard",
  onTabChange,
}) => {
  const [, setLocation] = useLocation();
  const [internalActiveTab, setInternalActiveTab] = useState(activeTab);
  const {
    isOpen: showSearch,
    open: openSearch,
    close: closeSearch,
  } = useSpotlight();

  // Fetch logos for this client
  const { data: clientAssets = [] } = useClientAssetsById(clientId);
  const logoAssets = clientAssets.filter((asset) => asset.category === "logo");

  // Keep internal state synced with prop
  useEffect(() => {
    setInternalActiveTab(activeTab);
  }, [activeTab]);

  // Listen for tab changes from the dashboard or other components
  useEffect(() => {
    const handleTabChangeEvent = (e: CustomEvent) => {
      if (e.detail && e.detail.tab) {
        console.log("Sidebar received tab change event:", e.detail.tab);
        setInternalActiveTab(e.detail.tab);
      }
    };

    window.addEventListener(
      "client-tab-change",
      handleTabChangeEvent as EventListener
    );

    return () => {
      window.removeEventListener(
        "client-tab-change",
        handleTabChangeEvent as EventListener
      );
    };
  }, []);

  const handleAllBrands = () => {
    setLocation("/dashboard");
  };

  const tabs = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <LayoutDashboard className="h-4 w-4" />,
      enabled: true, // Dashboard is always enabled
    },
    {
      id: "logos",
      title: "Logo System",
      icon: <BuildingIcon className="h-4 w-4" />,
      enabled: featureToggles.logoSystem,
    },
    {
      id: "colors",
      title: "Colors",
      icon: <PaletteIcon className="h-4 w-4" />,
      enabled: featureToggles.colorSystem,
    },
    {
      id: "typography",
      title: "Typography",
      icon: <BookText className="h-4 w-4" />,
      enabled: featureToggles.typeSystem,
    },
    {
      id: "personas",
      title: "User Personas",
      icon: <UsersIcon className="h-4 w-4" />,
      enabled: featureToggles.userPersonas,
    },
    {
      id: "inspiration",
      title: "Inspiration",
      icon: <Image className="h-4 w-4" />,
      enabled: featureToggles.inspiration,
    },
    {
      id: "design-system",
      title: "Design System",
      icon: <Figma className="h-4 w-4" />,
      enabled: featureToggles.figmaIntegration,
    },
  ];

  const enabledTabs = tabs.filter((tab) => tab.enabled);

  // Handle tab change and dispatch custom event for client page
  const handleTabChange = (tabId: string) => {
    // Call the parent's callback
    onTabChange(tabId);

    // Dispatch a custom event that the client page can listen for
    const event = new CustomEvent("client-tab-change", {
      detail: { tab: tabId },
    });
    window.dispatchEvent(event);

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <aside className="w-64 border-border h-screen fixed left-0 top-0 bg-background flex flex-col z-50">
      <div className="p-4 flex justify-between items-center">
        {(() => {
          // Find logo to display in the sidebar
          // First try to find a main logo, then fall back to horizontal logo
          const mainLogo = logoAssets.find((logo: BrandAsset) => {
            try {
              const data =
                typeof logo.data === "string"
                  ? JSON.parse(logo.data)
                  : logo.data;
              return data?.type === "main";
            } catch (e: unknown) {
              console.error(
                "Error parsing logo data:",
                e instanceof Error ? e.message : "Unknown error"
              );
              return false;
            }
          });

          const horizontalLogo = logoAssets.find((logo: BrandAsset) => {
            try {
              const data =
                typeof logo.data === "string"
                  ? JSON.parse(logo.data)
                  : logo.data;
              return data?.type === "horizontal";
            } catch (e: unknown) {
              console.error(
                "Error parsing logo data:",
                e instanceof Error ? e.message : "Unknown error"
              );
              return false;
            }
          });

          // Use main logo if available, otherwise try horizontal
          const logoToUse = mainLogo || horizontalLogo;

          // If we found a usable logo, display it
          if (logoToUse && logoToUse.id) {
            return (
              <div className="w-[90%]">
                <img
                  src={`/api/assets/${logoToUse.id}/file`}
                  alt={clientName}
                  className="h-full w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    // On error, revert to the client name as fallback
                    e.currentTarget.insertAdjacentHTML(
                      "afterend",
                      `<h2 class="font-bold">${clientName}</h2>`
                    );
                  }}
                />
              </div>
            );
          }

          // If no logo is available, display the client name
          return <h2 className="font-bold">{clientName}</h2>;
        })()}
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
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2">
            <div className="mb-3">
              <Button
                variant="ghost"
                className="flex items-center text-muted-foreground gap-1 w-full justify-start"
                onClick={handleAllBrands}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>All Brands</span>
              </Button>
            </div>
          </div>

          <Separator className="mb-2" />

          <ScrollArea className="flex-1">
            <div className="px-2 py-2">
              <div className="mb-2 px-3">
                <p className="text-xs font-medium text-muted-foreground">
                  BRAND ELEMENTS
                </p>
              </div>
              <nav className="space-y-1">
                {enabledTabs.length > 0 ? (
                  enabledTabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant="ghost"
                      className={`flex w-full justify-start items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                        ${internalActiveTab === tab.id ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      {tab.icon}
                      {tab.title}
                    </Button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No enabled features
                  </div>
                )}
              </nav>
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">
          <p className="mb-1">Brand last edited:</p>
          <p className="mb-0">May 2, 2025</p>
        </div>
      </div>
    </aside>
  );
};
