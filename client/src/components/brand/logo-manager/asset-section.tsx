import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type React from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { InlineEditable } from "@/components/ui/inline-editable";
import {
  PermissionAction,
  Resource,
  usePermissions,
} from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { sectionMetadataApi } from "@/lib/api";

interface AssetSectionProps {
  title: string;
  description: string;
  isEmpty: boolean;
  onRemoveSection?: (type: string) => void;
  sectionType: string;
  clientId?: number;
  uploadComponent: React.ReactNode;
  emptyPlaceholder?: React.ReactNode;
  children: React.ReactNode;
  onDescriptionUpdate?: (value: string) => void;
  enableEditableDescription?: boolean;
}

export function AssetSection({
  title,
  description,
  isEmpty,
  onRemoveSection,
  sectionType,
  clientId,
  uploadComponent,
  emptyPlaceholder,
  children,
  onDescriptionUpdate,
  enableEditableDescription = false,
}: AssetSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const canUpload = can(PermissionAction.CREATE, Resource.BRAND_ASSETS);
  const canEditDescriptions = can(
    PermissionAction.UPDATE,
    Resource.BRAND_ASSETS
  );

  // Fetch section metadata if clientId is provided and editable descriptions are enabled
  const { data: sectionMetadataList = [] } = useQuery<
    Array<{ sectionType: string; description?: string }>
  >({
    queryKey: [`/api/clients/${clientId}/section-metadata`],
    queryFn: () => sectionMetadataApi.list(clientId!),
    enabled: enableEditableDescription && !!clientId,
  });

  // Get the description from section metadata, fallback to prop description
  const sectionMetadata = sectionMetadataList.find(
    (m) => m.sectionType === sectionType
  );
  const displayDescription = sectionMetadata?.description || description;

  // Section description update mutation
  const updateSectionDescriptionMutation = useMutation({
    mutationFn: ({
      sectionType,
      description,
    }: {
      sectionType: string;
      description: string;
    }) => sectionMetadataApi.update(clientId!, sectionType, description),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/section-metadata`],
      });
      toast({
        title: "Description saved",
        description: "Section description has been updated successfully.",
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

  const handleSectionDescriptionUpdate = (value: string) => {
    if (onDescriptionUpdate) {
      onDescriptionUpdate(value);
    } else if (clientId) {
      updateSectionDescriptionMutation.mutate({
        sectionType,
        description: value,
      });
    }
  };

  return (
    <div className="asset-section">
      <div className="asset-section__header">
        <div className="flex items-center justify-between w-full">
          <h3>{title}</h3>
          <PermissionGate
            action={PermissionAction.UPDATE}
            resource={Resource.HIDDEN_SECTIONS}
          >
            {onRemoveSection && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onRemoveSection(sectionType)}
              >
                <X className="h-4 w-4 mr-1" />
                <span>Remove Section</span>
              </Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Description - always shown regardless of isEmpty */}
        <div className="asset-section__description mb-4 col-span-1">
          {enableEditableDescription && canEditDescriptions ? (
            <InlineEditable
              value={displayDescription}
              onSave={handleSectionDescriptionUpdate}
              inputType="textarea"
              placeholder="Add a section description..."
              showControls={true}
              ariaLabel={`${title} description`}
              className="text-muted-foreground"
            />
          ) : (
            <p className="text-muted-foreground">{displayDescription}</p>
          )}
        </div>

        {isEmpty ? (
          <div className="col-span-2">
            {canUpload ? uploadComponent : emptyPlaceholder}
          </div>
        ) : (
          <div className="col-span-2">{children}</div>
        )}
      </div>
    </div>
  );
}
