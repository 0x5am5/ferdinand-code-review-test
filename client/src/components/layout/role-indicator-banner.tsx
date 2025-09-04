import { UserRole } from "@shared/schema";
import { Eye, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoleSwitching } from "@/contexts/RoleSwitchingContext";
import { cn } from "@/lib/utils";

const getRoleDisplayName = (role: UserRole): string => {
  return role.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const getRoleColor = (role: UserRole): string => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "bg-red-100 text-red-800 border-red-200";
    case UserRole.ADMIN:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case UserRole.EDITOR:
      return "bg-green-100 text-green-800 border-green-200";
    case UserRole.STANDARD:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case UserRole.GUEST:
      return "bg-gray-100 text-gray-800 border-gray-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

export function RoleIndicatorBanner() {
  const { isRoleSwitched, isUserSwitched, currentViewingRole, resetRole } =
    useRoleSwitching();

  if (!isRoleSwitched && !isUserSwitched) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-b px-4 py-2 flex items-center justify-between gap-4",
        "transition-all duration-200 ease-in-out",
        getRoleColor(currentViewingRole)
      )}
    >
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        <span className="text-sm font-medium">
          You are viewing this page as{" "}
          <Badge variant="secondary" className="bg-white/50">
            {getRoleDisplayName(currentViewingRole)}
          </Badge>
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={resetRole}
        className="h-6 w-6 p-0 hover:bg-white/20"
        title="Return to your actual role"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
