import {
  ArrowRight,
  BookText,
  BuildingIcon,
  Figma,
  Image,
  PaletteIcon,
  UsersIcon,
} from "lucide-react";
import { useId } from "react";
import { getContrastingTextColor } from "@/lib/color-utils";

interface BrandAsset {
  id: number;
  name: string;
  data: unknown;
  category: string;
  clientId: number;
  fileData?: string | null;
  mimeType?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

interface ClientDashboardProps {
  clientId: number;
  clientName: string;
  logos: BrandAsset[];
  primaryColor?: string;
  featureToggles: {
    logoSystem: boolean;
    colorSystem: boolean;
    typeSystem: boolean;
    userPersonas: boolean;
    inspiration: boolean;
    figmaIntegration: boolean;
  };
  onTabChange: (tab: string) => void;
}

export function ClientDashboard({
  clientId: _clientId,
  clientName,
  logos = [],
  primaryColor,
  featureToggles,
  onTabChange,
}: ClientDashboardProps) {
  const patternId = useId();
  // Find the primary logo (horizontal is usually best for display)
  const mainLogo =
    logos && logos.length > 0
      ? logos.find((logo) => {
          if (!logo || !logo.data) return false;
          try {
            const data =
              typeof logo.data === "string" ? JSON.parse(logo.data) : logo.data;
            return data?.type === "horizontal" || data?.type === "primary";
          } catch (e: unknown) {
            console.log("Error parsing logo data:", e);
            return false;
          }
        })
      : null;

  // Fallback to any logo if no horizontal/primary found
  const fallbackLogo = logos && logos.length > 0 ? logos[0] : null;
  const logoToShow = mainLogo || fallbackLogo;

  // Feature cards to display
  const features = [
    {
      id: "logos",
      title: "Logo System",
      description: "Access and download brand logos in various formats",
      icon: <BuildingIcon className="h-5 w-5" />,
      enabled: featureToggles.logoSystem,
    },
    {
      id: "colors",
      title: "Color Palette",
      description: "Explore brand colors and color combinations",
      icon: <PaletteIcon className="h-5 w-5" />,
      enabled: featureToggles.colorSystem,
    },
    {
      id: "typography",
      title: "Typography",
      description: "View and download brand fonts and typography guidelines",
      icon: <BookText className="h-5 w-5" />,
      enabled: featureToggles.typeSystem,
    },
    {
      id: "personas",
      title: "User Personas",
      description: "Understand target audiences and user archetypes",
      icon: <UsersIcon className="h-5 w-5" />,
      enabled: featureToggles.userPersonas,
    },
    {
      id: "inspiration",
      title: "Inspiration",
      description: "Browse inspiration boards and reference materials",
      icon: <Image className="h-5 w-5" />,
      enabled: featureToggles.inspiration,
    },
    {
      id: "design-system",
      title: "Design System",
      description: "Sync design tokens and styles with Figma design files",
      icon: <Figma className="h-5 w-5" />,
      enabled: featureToggles.figmaIntegration,
    },
  ];

  // Filter out disabled features
  const enabledFeatures = features.filter((feature) => feature.enabled);

  // Handle navigation to a specific section
  const handleNavigate = (tabId: string) => {
    console.log("Dashboard: navigating to tab:", tabId);

    // First update parent component state
    onTabChange(tabId);

    // Add a small delay to ensure the state is updated before dispatching the event
    setTimeout(() => {
      // Dispatch the event for sidebar to catch
      const event = new CustomEvent("client-tab-change", {
        detail: { tab: tabId },
      });
      window.dispatchEvent(event);

      // Update URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }, 10);
  };

  const backgroundColor = primaryColor || "#ffffff";
  const textColor = getContrastingTextColor(backgroundColor);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <title>Background grid pattern</title>
          <defs>
            <pattern
              id={patternId}
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </div>

      <div className="container mx-auto px-4 py-12 z-10 flex flex-col items-center">
        {/* Logo or Client Name */}
        <div className="mt-[12vh] mb-[12vh] text-center">
          {logoToShow ? (
            <div className="max-w-md max-h-40 mx-auto mb-4">
              <img
                src={logoToShow?.id ? `/api/assets/${logoToShow.id}/file?t=${logoToShow.updatedAt ? new Date(logoToShow.updatedAt).getTime() : Date.now()}` : ""}
                alt={clientName}
                className="max-h-40 w-auto mx-auto object-contain"
                style={{
                  filter:
                    textColor === "#ffffff"
                      ? "brightness(0) invert(1)"
                      : "none",
                }}
                onError={(e) => {
                  // Handle image loading errors
                  e.currentTarget.style.display = "none";
                  console.log("Error loading logo image");
                }}
              />
            </div>
          ) : (
            <h1 className="text-5xl font-bold mb-4" style={{ color: textColor }}>
              {clientName}
            </h1>
          )}

          <h2
            className="text-2xl font-light opacity-90 mt-6"
            style={{ color: textColor }}
          >
            Brand Management Dashboard
          </h2>
        </div>

        {/* Feature Cards */}
        <div className="max-w-5xl w-full mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enabledFeatures.map((feature) => (
              <button
                type="button"
                key={feature.id}
                className="backdrop-blur-sm rounded-lg p-6 transition-all group cursor-pointer text-left w-full"
                style={{
                  backgroundColor:
                    textColor === "#ffffff"
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                  borderColor:
                    textColor === "#ffffff"
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(0, 0, 0, 0.2)",
                  borderWidth: "1px",
                  color: textColor,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    textColor === "#ffffff"
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    textColor === "#ffffff"
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)";
                }}
                onClick={() => handleNavigate(feature.id)}
                aria-label={`Navigate to ${feature.title}`}
              >
                <div className="flex flex-col h-full">
                  <div
                    className="mb-4 w-12 h-12 flex items-center justify-center rounded-full"
                    style={{
                      backgroundColor:
                        textColor === "#ffffff"
                          ? "rgba(255, 255, 255, 0.2)"
                          : "rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm mb-6 flex-grow"
                    style={{ opacity: 0.8 }}
                  >
                    {feature.description}
                  </p>
                  <span className="inline-flex items-center justify-start p-0 group-hover:translate-x-1 transition-transform">
                    Explore <ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
