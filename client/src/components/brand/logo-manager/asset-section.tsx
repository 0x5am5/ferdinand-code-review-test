import { PermissionAction, Resource } from "@shared/permissions";
import { X } from "lucide-react";
import type React from "react";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";

interface AssetSectionProps {
  title: string;
  description: string;
  isEmpty: boolean;
  onRemoveSection?: (type: string) => void;
  sectionType: string;
  uploadComponent: React.ReactNode;
  emptyPlaceholder?: React.ReactNode;
  children: React.ReactNode;
}

export function AssetSection({
  title,
  description,
  isEmpty,
  onRemoveSection,
  sectionType,
  uploadComponent,
  emptyPlaceholder,
  children,
}: AssetSectionProps) {
  const { can } = usePermissions();
  const canUpload = can(PermissionAction.CREATE, Resource.BRAND_ASSETS);

  return (
    <div className="asset-section">
      <div className="asset-section__header">
        <div className="flex items-center justify-between w-full">
          <h3>{title}</h3>
          <PermissionGate
            action={PermissionAction.DELETE}
            resource={Resource.BRAND_ASSETS}
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

      {isEmpty ? (
        <div className="asset-section__empty">
          <div className="asset-section__empty-info">
            <p>{description}</p>
          </div>
          {canUpload ? uploadComponent : emptyPlaceholder}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
