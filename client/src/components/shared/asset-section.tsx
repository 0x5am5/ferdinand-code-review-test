import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BrandAsset, UserRole } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

interface AssetSectionProps {
  type: string;
  title: string;
  assets: BrandAsset[];
  clientId: number;
  onRemoveSection?: (type: string) => void;
  onDeleteAsset: (assetId: number, variant?: string) => void;
  emptyStateDescription?: string;
  renderAssetDisplay: (props: {
    asset: BrandAsset;
    clientId: number;
    queryClient: any;
    onDelete: (assetId: number, variant?: string) => void;
  }) => React.ReactNode;
  renderEmptyState: (props: {
    type: string;
    clientId: number;
    queryClient: any;
    description?: string;
  }) => React.ReactNode;
}

/**
 * A reusable section component for displaying asset types (logos, colors, etc.)
 * Handles both populated and empty states with appropriate UI
 */
export function AssetSection({
  type,
  title,
  assets,
  clientId,
  onRemoveSection,
  onDeleteAsset,
  emptyStateDescription,
  renderAssetDisplay,
  renderEmptyState
}: AssetSectionProps) {
  const { user = null } = useAuth();
  const queryClient = useQueryClient();
  const hasAssets = assets.length > 0;
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  return (
    <div className="asset-section">
      <div className="asset-section__header">
        <div className="flex items-center justify-between w-full">
          <h3>{title}</h3>
          {isAdmin && onRemoveSection && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onRemoveSection(type)}
            >
              <X className="h-4 w-4 mr-1" />
              <span>Remove Section</span>
            </Button>
          )}
        </div>
      </div>

      <Separator className="asset-section__separator" />

      {/* Display assets if available */}
      {hasAssets ? (
        <div className="asset-section__content">
          {assets.map((asset) => renderAssetDisplay({
            asset,
            clientId,
            queryClient,
            onDelete: onDeleteAsset
          }))}
        </div>
      ) : (
        // Empty state
        <div className="asset-section__empty">
          {renderEmptyState({
            type,
            clientId,
            queryClient,
            description: emptyStateDescription
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Standardized empty state component for asset sections
 */
export function AssetEmptyState({
  description,
  icon: Icon,
  type,
  clientId,
  queryClient,
  uploadComponent
}: {
  description?: string;
  icon: React.ComponentType<any>;
  type: string;
  clientId: number;
  queryClient: any;
  uploadComponent?: React.ReactNode;
}) {
  const { user = null } = useAuth();
  const isStandardUser = user?.role === UserRole.STANDARD;

  return (
    <div className="asset-section__empty-layout">
      {/* Info column with description */}
      {description && (
        <div className="asset-section__empty-info">
          <p>{description}</p>
        </div>
      )}

      {/* Upload area or placeholder for non-standard users */}
      {!isStandardUser && uploadComponent ? (
        uploadComponent
      ) : (
        <div className="asset-section__empty-placeholder">
          <Icon className="asset-section__empty-placeholder-icon h-10 w-10" />
          <p>
            No {type.toLowerCase()} uploaded yet
          </p>
        </div>
      )}
    </div>
  );
}