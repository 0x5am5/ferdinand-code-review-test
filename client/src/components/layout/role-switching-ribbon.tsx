import { UserRole } from "@shared/schema";
import { Eye, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoleSwitching } from "@/contexts/RoleSwitchingContext";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const getRoleDisplayName = (
  role: (typeof UserRole)[keyof typeof UserRole]
): string => {
  return role
    .replace("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
};

const getRoleColor = (
  role: (typeof UserRole)[keyof typeof UserRole]
): string => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "bg-red-100 text-red-800";
    case UserRole.ADMIN:
      return "bg-blue-100 text-blue-800";
    case UserRole.EDITOR:
      return "bg-green-100 text-green-800";
    case UserRole.STANDARD:
      return "bg-yellow-100 text-yellow-800";
    case UserRole.GUEST:
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export function RoleSwitchingRibbon() {
  const { user } = useAuth();
  const {
    currentViewingRole,
    switchRole,
    resetRole,
    isRoleSwitched,
    canAccessCurrentPage,
  } = useRoleSwitching();

  // Only show for super admins
  if (!user || user.role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  const allRoles = Object.values(UserRole);

  return (
    <div className="border-t border-sidebar-border bg-sidebar-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">
            View as:
          </span>

          <Select
            value={currentViewingRole}
            onValueChange={(value: (typeof UserRole)[keyof typeof UserRole]) =>
              switchRole(value)
            }
          >
            <SelectTrigger className="h-7 text-xs bg-background border-input flex-1">
              <SelectValue>
                <Badge
                  variant="secondary"
                  className={cn("text-xs", getRoleColor(currentViewingRole))}
                >
                  {getRoleDisplayName(currentViewingRole)}
                </Badge>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {allRoles.map((role) => {
                const canAccess = canAccessCurrentPage(role);
                return (
                  <SelectItem
                    key={role}
                    value={role}
                    disabled={!canAccess}
                    className={cn(!canAccess && "opacity-50")}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", getRoleColor(role))}
                      >
                        {getRoleDisplayName(role)}
                      </Badge>
                      {!canAccess && (
                        <span className="text-xs text-muted-foreground">
                          (No access)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {isRoleSwitched && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetRole}
            className="h-7 w-7 p-0 flex-shrink-0"
            title="Reset to your actual role"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
