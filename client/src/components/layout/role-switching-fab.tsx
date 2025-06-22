
import React, { useState } from 'react';
import { UserRole } from '@shared/schema';
import { useRoleSwitching } from '@/contexts/RoleSwitchingContext';
import { useAuth } from '@/hooks/use-auth';
import { useUsersQuery } from '@/lib/queries/users';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { X, Eye, User, UserCheck, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const getRoleDisplayName = (role: UserRole): string => {
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getRoleColor = (role: UserRole): string => {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'bg-red-100 text-red-800';
    case UserRole.ADMIN:
      return 'bg-blue-100 text-blue-800';
    case UserRole.EDITOR:
      return 'bg-green-100 text-green-800';
    case UserRole.STANDARD:
      return 'bg-yellow-100 text-yellow-800';
    case UserRole.GUEST:
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function RoleSwitchingFAB() {
  const { user } = useAuth();
  const { data: users = [] } = useUsersQuery();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'role' | 'user'>('role');
  const { 
    currentViewingRole, 
    actualUserRole, 
    currentViewingUser,
    switchRole, 
    switchToUser,
    resetRole, 
    isRoleSwitched,
    isUserSwitched,
    canAccessCurrentPage 
  } = useRoleSwitching();

  // Only show for super admins
  if (!user || user.role !== UserRole.SUPER_ADMIN) {
    return null;
  }

  const allRoles = Object.values(UserRole);
  const filteredUsers = users.filter(u => u.id !== user.id);

  const isActive = isRoleSwitched || isUserSwitched;

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
            <Eye className={cn(
              "h-6 w-6 mr-2",
              isActive ? "text-white" : "text-gray-700"
            )} />
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
                <div className="text-xs text-muted-foreground mb-1">Currently viewing as:</div>
                <div className="flex items-center gap-2">
                  {currentViewingUser ? (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        {currentViewingUser.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({getRoleDisplayName(currentViewingUser.role)})
                      </span>
                    </>
                  ) : (
                    <Badge 
                      variant="secondary" 
                      className={cn("text-xs", getRoleColor(currentViewingRole))}
                    >
                      {getRoleDisplayName(currentViewingRole)}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'role' | 'user')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="role" className="text-xs">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Role
                </TabsTrigger>
                <TabsTrigger value="user" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  User
                </TabsTrigger>
              </TabsList>

              <TabsContent value="role" className="mt-3">
                <Select 
                  value={currentViewingUser ? '' : currentViewingRole} 
                  onValueChange={(value: UserRole) => {
                    switchRole(value);
                    setIsOpen(false);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {currentViewingUser ? (
                        <span className="text-muted-foreground">Select a role...</span>
                      ) : (
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", getRoleColor(currentViewingRole))}
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
                              <span className="text-xs text-muted-foreground">(No access)</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="user" className="mt-3">
                <Select 
                  value={currentViewingUser?.id.toString() || ''} 
                  onValueChange={(value) => {
                    const selectedUser = filteredUsers.find(u => u.id.toString() === value);
                    if (selectedUser) {
                      switchToUser({
                        id: selectedUser.id,
                        name: selectedUser.name,
                        email: selectedUser.email,
                        role: selectedUser.role,
                        client_id: selectedUser.client_id,
                      });
                      setIsOpen(false);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a user...">
                      {currentViewingUser ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{currentViewingUser.name}</span>
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getRoleColor(currentViewingUser.role))}
                          >
                            {getRoleDisplayName(currentViewingUser.role)}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select a user...</span>
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
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{userData.name}</span>
                              <Badge 
                                variant="secondary" 
                                className={cn("text-xs", getRoleColor(userData.role))}
                              >
                                {getRoleDisplayName(userData.role)}
                              </Badge>
                              {!canAccess && (
                                <span className="text-xs text-muted-foreground">(No access)</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{userData.email}</div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
