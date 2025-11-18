import { UserRole } from "@shared/schema";
import { X } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { InlineEditable } from "@/components/ui/inline-editable";
import { useAuth } from "@/hooks/use-auth";

interface AssetSectionProps {
  title: string;
  description: string;
  isEmpty: boolean;
  onRemoveSection?: (type: string) => void;
  sectionType: string;
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
  uploadComponent,
  emptyPlaceholder,
  children,
  onDescriptionUpdate,
  enableEditableDescription = false,
}: AssetSectionProps) {
  const { user } = useAuth();
  const canManageSections =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.EDITOR;

  const canEditDescriptions =
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.EDITOR;

  return (
    <div className="asset-section">
      <div className="asset-section__header">
        <div className="flex items-center justify-between w-full">
          <h3>{title}</h3>
          {canManageSections && onRemoveSection && (
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Description - always shown regardless of isEmpty */}
        <div className="asset-section__description mb-4 col-span-1">
          {enableEditableDescription &&
          canEditDescriptions &&
          onDescriptionUpdate ? (
            <InlineEditable
              value={description}
              onSave={onDescriptionUpdate}
              inputType="textarea"
              placeholder="Add a section description..."
              debounceMs={500}
              ariaLabel={`${title} description`}
              className="text-muted-foreground"
            />
          ) : (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {isEmpty ? (
          <div className="col-span-2">
            {user &&
            user.role !== UserRole.STANDARD &&
            user.role !== UserRole.GUEST
              ? uploadComponent
              : emptyPlaceholder}
          </div>
        ) : (
          <div className="col-span-2">{children}</div>
        )}
      </div>
    </div>
  );
}
