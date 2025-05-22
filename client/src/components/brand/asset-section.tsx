
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

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
  children
}: AssetSectionProps) {
  const { user } = useAuth();
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
              onClick={() => onRemoveSection(sectionType)}
            >
              <X className="h-4 w-4 mr-1" />
              <span>Remove Section</span>
            </Button>
          )}
        </div>
      </div>

      <Separator className="asset-section__separator" />

      {isEmpty ? (
        <div className="asset-section__empty">
          <div className="asset-section__empty-info">
            <p>{description}</p>
          </div>
          {user && user.role !== UserRole.STANDARD ? (
            uploadComponent
          ) : (
            emptyPlaceholder
          )}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}
