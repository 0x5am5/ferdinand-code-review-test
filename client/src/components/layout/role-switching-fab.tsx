import { UserRole } from "@shared/schema";
import { Eye, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

const getRoleDisplayName = (role: UserRoleType): string => {
  return role
    .replace("_", " ")
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
};

const getRoleColor = (role: UserRoleType): string => {
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

export function RoleSwitchingFAB() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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
  const isActive = isRoleSwitched;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            className={cn(
              "rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200",
              "flex items-center justify-center relative",
              isActive
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            )}
          >
            <Eye
              className={cn(
                "h-6 w-6 mr-2",
                isActive ? "text-white" : "text-gray-700"
              )}
            />
            View as
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          className="w-80 p-4 bg-white border border-gray-200 shadow-lg rounded-lg"
          sideOffset={10}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">View as</span>
              </div>
              {isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetRole();
                    setIsOpen(false);
                  }}
                  className="h-6 w-6 p-0"
                  title="Reset to your actual role"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Current Status */}
            {isActive && (
              <div className="bg-muted p-3 rounded-md">
                <div className="text-xs text-muted-foreground mb-1">
                  Currently viewing as:
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn("text-xs", getRoleColor(currentViewingRole))}
                  >
                    {getRoleDisplayName(currentViewingRole)}
                  </Badge>
                </div>
              </div>
            )}

            {/* Role Selection */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Select Role</div>
              <Select
                value={currentViewingRole}
                onValueChange={(value: string) => {
                  switchRole(value as (typeof UserRole)[keyof typeof UserRole]);
                  setIsOpen(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        getRoleColor(currentViewingRole)
                      )}
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
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
