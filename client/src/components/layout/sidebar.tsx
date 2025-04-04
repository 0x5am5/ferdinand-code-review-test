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
        "sidebar",
        isCollapsed ? "sidebar--collapsed" : "sidebar--expanded"
      )}
    >
      <div className="sidebar__header">
        
          <img 
            src="/src/ferdinand--logo.png" 
            alt="Ferdinand Logo" 
            className={cn(
              "sidebar--logo",
              isCollapsed ? "sidebar--collapsed" : "sidebar--expanded"
            )}
          />
      </div>

      {isSuperAdmin && !isCollapsed && (
        <div className="sidebar__admin-panel">
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

        <nav className="sidebar__nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "sidebar__link",
                  location === item.href && "sidebar__link--active"
                )}
              >
                <Icon />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}

          {user?.role === UserRole.SUPER_ADMIN && (
            <>
              <div className="sidebar__divider" />
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link 
                    key={item.href} 
                    href={item.href}
                    className={cn(
                      "sidebar__link",
                      location === item.href && "sidebar__link--active"
                    )}
                  >
                    <Icon />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

      <div className="sidebar__footer">
        <AuthButton collapsed={isCollapsed} />
        
        <Button
          variant="ghost"
          size="icon"
          className="sidebar__toggle-button button--outline"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}