import { UserRole } from "@shared/schema";
import { Eye, User, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoleSwitching } from "@/contexts/RoleSwitchingContext";
import { useAuth } from "@/hooks/use-auth";
import { useUsersQuery } from "@/lib/queries/users";
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
  const { data: users = [] } = useUsersQuery();
  const [activeTab, setActiveTab] = useState<"role" | "user">("role");
  const {
    currentViewingRole,
    currentViewingUser,
    switchRole,
    switchToUser,
    resetRole,
    isRoleSwitched,
    isUserSwitched,
    canAccessCurrentPage,
  } = useRoleSwitching();

  // Only show for super admins
  if (!user || user.role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  const allRoles = Object.values(UserRole);
  const filteredUsers = users.filter((u) => u.id !== user.id); // Exclude current user

  return (
    <div className="border-t border-sidebar-border bg-sidebar-background p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">
            View as:
          </span>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "role" | "user")}
            className="flex-1"
          >
            <TabsList className="grid w-full grid-cols-2 h-7">
              <TabsTrigger value="role" className="text-xs h-6">
                <UserCheck className="h-3 w-3 mr-1" />
                Role
              </TabsTrigger>
              <TabsTrigger value="user" className="text-xs h-6">
                <User className="h-3 w-3 mr-1" />
                User
              </TabsTrigger>
            </TabsList>

            <TabsContent value="role" className="mt-2">
              <Select
                value={currentViewingUser ? "" : currentViewingRole}
                onValueChange={(
                  value: (typeof UserRole)[keyof typeof UserRole]
                ) => switchRole(value)}
              >
                <SelectTrigger className="h-7 text-xs bg-background border-input">
                  <SelectValue>
                    {currentViewingUser ? (
                      <Badge variant="outline" className="text-xs">
                        Switch to role view
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          getRoleColor(currentViewingRole)
                        )}
                      >
                        {getRoleDisplayName(currentViewingRole)}
                      </Badge>
                    )}
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
            </TabsContent>

            <TabsContent value="user" className="mt-2">
              <Select
                value={currentViewingUser?.id.toString() || ""}
                onValueChange={(value) => {
                  const selectedUser = filteredUsers.find(
                    (u) => u.id.toString() === value
                  );
                  if (selectedUser) {
                    switchToUser({
                      id: selectedUser.id,
                      name: selectedUser.name,
                      email: selectedUser.email,
                      role: selectedUser.role,
                      client_id: selectedUser.client_id,
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 text-xs bg-background border-input">
                  <SelectValue placeholder="Select a user...">
                    {currentViewingUser ? (
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            getRoleColor(currentViewingUser.role)
                          )}
                        >
                          {currentViewingUser.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({getRoleDisplayName(currentViewingUser.role)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Select a user...
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((userData) => {
                    const canAccess = canAccessCurrentPage(userData.role);
                    return (
                      <SelectItem
                        key={userData.id}
                        value={userData.id.toString()}
                        disabled={!canAccess}
                        className={cn(!canAccess && "opacity-50")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{userData.name}</span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              getRoleColor(userData.role)
                            )}
                          >
                            {getRoleDisplayName(userData.role)}
                          </Badge>
                          {!canAccess && (
                            <span className="text-xs text-muted-foreground">
                              (No access)
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {userData.email}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>
        </div>

        {(isRoleSwitched || isUserSwitched) && (
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
