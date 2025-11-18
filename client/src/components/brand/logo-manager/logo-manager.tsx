import { type BrandAsset, LogoType, UserRole } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { brandAssetApi, sectionMetadataApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
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

  const { data: hiddenSections, isLoading: loadingHiddenSections } =
    useHiddenSections(clientId);

  const addHiddenSection = useAddHiddenSection(clientId);
  const removeHiddenSection = useRemoveHiddenSection(clientId);

  // Fetch section metadata for descriptions
  const { data: sectionMetadataList = [] } = useQuery({
    queryKey: [`/api/clients/${clientId}/section-metadata`],
    queryFn: () => sectionMetadataApi.list(clientId),
  });

  // Section description update mutation
  const updateSectionDescriptionMutation = useMutation({
    mutationFn: ({ sectionType, description }: { sectionType: string; description: string }) =>
      sectionMetadataApi.update(clientId, sectionType, description),
    onMutate: async ({ sectionType, description }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [`/api/clients/${clientId}/section-metadata`],
      });

      // Snapshot the previous value
      const previousMetadata = queryClient.getQueryData([
        `/api/clients/${clientId}/section-metadata`,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        [`/api/clients/${clientId}/section-metadata`],
        (
          old: Array<{ sectionType: string; description?: string }> | undefined
        ) => {
          if (!old) return old;

          const existingIndex = old.findIndex(
            (m) => m.sectionType === sectionType
          );

          if (existingIndex >= 0) {
            // Update existing metadata
            const updated = [...old];
            updated[existingIndex] = { ...updated[existingIndex], description };
            return updated;
          }

          // Add new metadata if it doesn't exist
          return [...old, { sectionType, description }];
        }
      );

      // Return a context object with the snapshotted value
      return { previousMetadata };
    },
    onError: (error: Error, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(
        [`/api/clients/${clientId}/section-metadata`],
        context?.previousMetadata
      );
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/section-metadata`],
      });
      toast({
        title: "Success",
        description: "Section description updated",
      });
    },
  });

  const canManageSections =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.EDITOR;

  useEffect(() => {
    if (loadingHiddenSections) return;

    const allLogoTypes: string[] = Object.values(LogoType);

    if (hiddenSections && Array.isArray(hiddenSections)) {
      const hiddenTypes: string[] = hiddenSections.map(
        (section) => section.sectionType
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
    mutationFn: ({ logoId, variant }: { logoId: number; variant: "light" | "dark" }) =>
      brandAssetApi.delete(clientId, logoId, variant),
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
    setVisibleSections((prev) => prev.filter((section) => section !== type));

    addHiddenSection.mutate(type, {
      onSuccess: () => {
        toast({
          title: "Section removed",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo section has been removed`,
        });
      },
      onError: (error) => {
        setVisibleSections((prev) => [...prev, type]);
        toast({
          title: "Error",
          description: `Failed to remove section: ${error instanceof Error ? error.message : "Unknown error"}`,
          variant: "destructive",
        });
      },
    });
  };

  const handleAddSection = (type: string) => {
    setVisibleSections((prev) => [...prev, type]);
    setShowAddSection(false);

    removeHiddenSection.mutate(type, {
      onSuccess: () => {
        toast({
          title: "Section added",
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} logo section has been added`,
        });
      },
      onError: (error) => {
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

  // Handler for updating section description
  const handleSectionDescriptionUpdate = (type: string, value: string) => {
    updateSectionDescriptionMutation.mutate({
      sectionType: `logo-${type}`,
      description: value,
    });
  };

  // Get section description from metadata
  const getSectionDescription = (type: string): string | undefined => {
    return sectionMetadataList.find(
      (m: { sectionType: string }) => m.sectionType === `logo-${type}`
    )?.description;
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
        {canManageSections && availableSections.length > 0 && (
          <Button
            onClick={() => setShowAddSection(true)}
            variant="outline"
            className="flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>Add Section</span>
          </Button>
        )}
      </div>

      {visibleSections.map((type) => {
        const logosForType = logosByType[type] || [];
        const isGuest = user?.role === UserRole.GUEST;

        // Hide empty sections for guest users since they can't upload
        if (isGuest && logosForType.length === 0) {
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
            sectionDescription={getSectionDescription(type)}
            onSectionDescriptionUpdate={(value) =>
              handleSectionDescriptionUpdate(type, value)
            }
          />
        );
      })}

      {canManageSections && (
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
      )}
    </div>
  );
}
