import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthButton } from "@/components/auth/auth-button";
import { 
  LayoutDashboard, Settings, ChevronLeft, ChevronRight,
  Users, Palette, BookOpen, Briefcase
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { User, UserRole } from "@shared/schema";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Briefcase },
  { name: "Brand Guidelines", href: "/guidelines", icon: BookOpen },
  { name: "Users", href: "/users", icon: Users },
  { name: "Design Builder", href: "/design-builder", icon: Palette },
];

const adminNavigation = [
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/user"],
  });

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN;

  return (
    <div 
      className={cn(
        "flex h-screen flex-col border-r bg-sidebar transition-all duration-200",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="relative flex items-center p-4 h-16 border-b">
        {!isCollapsed && (
          <h1 className="text-xl font-bold">Brandify</h1>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-4 top-6 bg-background border shadow-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isSuperAdmin && !isCollapsed && (
        <div className="bg-primary-light px-4 py-2 border-b">
          <p className="text-sm font-medium text-primary mb-2">Super Admin</p>
          <Select defaultValue={user?.role}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Switch role" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(UserRole).map((role) => (
                <SelectItem key={role} value={role}>
                  {role.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "sidebar-link",
                    location === item.href && "active"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {!isCollapsed && <span>{item.name}</span>}
                </a>
              </Link>
            );
          })}

          {user?.role === UserRole.SUPER_ADMIN && (
            <>
              <div className="my-2 border-t" />
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <a
                      className={cn(
                        "sidebar-link",
                        location === item.href && "active"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </a>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t">
        <AuthButton collapsed={isCollapsed} />
      </div>
    </div>
  );
}