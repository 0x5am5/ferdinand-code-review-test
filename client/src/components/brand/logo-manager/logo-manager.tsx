import { type BrandAsset, LogoType } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  PermissionAction,
  Resource,
  usePermissions,
} from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { brandAssetApi } from "@/lib/api";
import {
  useAddHiddenSection,
  useHiddenSections,
  useRemoveHiddenSection,
} from "@/lib/queries/hidden-sections";
import { LogoSection } from "./logo-section";
import { parseBrandAssetData } from "./logo-utils";

interface LogoManagerProps {
  clientId: number;
  logos: BrandAsset[];
}

export function LogoManager({ clientId, logos }: LogoManagerProps) {
  const { toast } = useToast();
  const { user = null } = useAuth();
  const queryClient = useQueryClient();
  const [visibleSections, setVisibleSections] = useState<string[]>([]);
  const [showAddSection, setShowAddSection] = useState(false);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const { can } = usePermissions();

  const { data: hiddenSections, isLoading: loadingHiddenSections } =
    useHiddenSections(clientId);

  const addHiddenSection = useAddHiddenSection(clientId);
  const removeHiddenSection = useRemoveHiddenSection(clientId);

  const canManageSections = can(
    PermissionAction.UPDATE,
    Resource.HIDDEN_SECTIONS
  );

  useEffect(() => {
    if (loadingHiddenSections) return;

    const allLogoTypes: string[] = Object.values(LogoType);

    if (hiddenSections && Array.isArray(hiddenSections)) {
      const hiddenTypes: string[] = hiddenSections.map((section) =>
        section.sectionType.replace(/^logo-/, "")
      );
      const visible: string[] = allLogoTypes.filter(
        (type) => !hiddenTypes.includes(type)
      );
      setVisibleSections(visible);
    } else {
      setVisibleSections(allLogoTypes);
    }
  }, [hiddenSections, loadingHiddenSections]);

  useEffect(() => {
    const available: string[] = Object.values(LogoType).filter(
      (type) => !visibleSections.includes(type)
    );
    setAvailableSections(available);
  }, [visibleSections]);

  const deleteLogo = useMutation({
    mutationFn: ({
      logoId,
      variant,
    }: {
      logoId: number;
      variant: "light" | "dark";
    }) => brandAssetApi.delete(clientId, logoId, variant),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/brand-assets`],
      });
      toast({
        title: "Success",
        description: "Logo deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logosByType: Record<string, BrandAsset[]> = Object.values(
    LogoType
  ).reduce(
    (acc, type) => {
      acc[type] = logos.filter((logo) => {
        const parsedData = parseBrandAssetData(logo);
        return parsedData?.type === type;
      });
      return acc;
    },
    {} as Record<string, BrandAsset[]>
  );

  const handleRemoveSection = (type: string) => {
    // Strip the "logo-" prefix since it comes from AssetSection pre-prefixed
    const baseType = type.replace(/^logo-/, "");

    // Optimistic update using base type
    setVisibleSections((prev) =>
      prev.filter((section) => section !== baseType)
    );

    // Send to API with "logo-" prefix added
    addHiddenSection.mutate(`logo-${baseType}`, {
      onSuccess: () => {
        toast({
          title: "Section removed",
          description: `${baseType.charAt(0).toUpperCase() + baseType.slice(1)} logo section has been removed`,
        });
      },
      onError: (error) => {
        // Revert optimistic update on error
        setVisibleSections((prev) => [...prev, baseType]);
        toast({
          title: "Error",
          description: `Failed to remove section: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        });
      },
    });
  };

  const handleAddSection = (type: string) => {
    // Optimistic update
    setVisibleSections((prev) => [...prev, type]);
    setShowAddSection(false);

    removeHiddenSection.mutate(`logo-${type}`, {
      onSuccess: () => {
        toast({
          title: "Section added",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo section has been added`,
        });
      },
      onError: (error) => {
        // Revert optimistic update on error
        setVisibleSections((prev) =>
          prev.filter((section) => section !== type)
        );
        toast({
          title: "Error",
          description: `Failed to add section: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logo System</h1>
          <p className="text-muted-foreground mt-1">
            Manage and download the official logos for this brand
          </p>
        </div>
        <PermissionGate
          action={PermissionAction.UPDATE}
          resource={Resource.HIDDEN_SECTIONS}
        >
          {availableSections.length > 0 && (
            <Button
              onClick={() => setShowAddSection(true)}
              variant="outline"
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Add Section</span>
            </Button>
          )}
        </PermissionGate>
      </div>

      {visibleSections.map((type) => {
        const logosForType = logosByType[type] || [];
        const canUpload = can(PermissionAction.CREATE, Resource.BRAND_ASSETS);

        // Hide empty sections if user can't upload
        if (!canUpload && logosForType.length === 0) {
          return null;
        }

        return (
          <LogoSection
            key={type}
            type={type}
            logos={logosForType}
            clientId={clientId}
            onDeleteLogo={(logoId, variant) =>
              deleteLogo.mutate({ logoId, variant })
            }
            queryClient={queryClient}
            onRemoveSection={
              canManageSections ? handleRemoveSection : undefined
            }
          />
        );
      })}

      <PermissionGate
        action={PermissionAction.UPDATE}
        resource={Resource.HIDDEN_SECTIONS}
      >
        <Dialog open={showAddSection} onOpenChange={setShowAddSection}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Logo Section</DialogTitle>
              <DialogDescription>
                Select a logo section to add to the page
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {availableSections.map((section) => (
                <Button
                  key={section}
                  variant="outline"
                  className="justify-start text-left"
                  onClick={() => handleAddSection(section)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {section.charAt(0).toUpperCase() + section.slice(1)} Logo
                </Button>
              ))}
              {availableSections.length === 0 && (
                <p className="text-muted-foreground text-center py-2">
                  All available sections are already displayed
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </PermissionGate>
    </div>
  );
}
