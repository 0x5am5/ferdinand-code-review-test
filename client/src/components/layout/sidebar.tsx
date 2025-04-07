import { FC } from "react";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CircleUserIcon, 
  HomeIcon, 
  BuildingIcon, 
  UsersIcon,
  PaletteIcon,
  ServerIcon,
  LogOutIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

/**
 * Application sidebar navigation
 */
export const Sidebar: FC = () => {
  const [location] = useLocation();
  const themeContext = useTheme();
  
  // In a real app, you'd get this from the auth context
  const isAdmin = true; // Hardcoded for development
  
  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <HomeIcon className="h-4 w-4" />
    },
    {
      title: "Clients",
      href: "/clients",
      icon: <BuildingIcon className="h-4 w-4" />
    },
    {
      title: "Users",
      href: "/users",
      icon: <UsersIcon className="h-4 w-4" />,
      adminOnly: true
    },
    {
      title: "Design Builder",
      href: "/design-builder",
      icon: <PaletteIcon className="h-4 w-4" />,
      adminOnly: true
    },
    {
      title: "Instances",
      href: "/admin/instances",
      icon: <ServerIcon className="h-4 w-4" />,
      adminOnly: true
    }
  ];
  
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || (item.adminOnly && isAdmin)
  );
  
  const isActiveLink = (href: string) => {
    if (href === '/clients' && location.startsWith('/clients/')) {
      return true;
    }
    return location === href;
  };
  
  const handleLogout = () => {
    // Would handle logout in real app
    console.log("Logging out...");
  };
  
  const toggleTheme = async () => {
    if (!themeContext || !themeContext.designSystem || !themeContext.updateDesignSystem) {
      console.error("Theme context not properly initialized");
      return;
    }
    
    const currentAppearance = themeContext.designSystem.theme.appearance;
    const newAppearance = currentAppearance === 'dark' ? 'light' : 'dark';
    
    await themeContext.updateDesignSystem({
      theme: {
        ...themeContext.designSystem.theme,
        appearance: newAppearance
      }
    });
  };
  
  const isDarkMode = themeContext?.designSystem?.theme?.appearance === 'dark';
  
  return (
    <aside className="w-64 border-r border-border h-screen fixed left-0 top-0 bg-background flex flex-col z-50">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-xl">
          F
        </div>
        <div>
          <h2 className="font-bold">Ferdinand</h2>
          <p className="text-xs text-muted-foreground">Brand Management</p>
        </div>
      </div>
      
      <ScrollArea className="flex-1 py-4">
        <nav className="px-2 space-y-1">
          {filteredNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={`flex w-full justify-start items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors
                  ${isActiveLink(item.href) 
                    ? 'bg-muted font-medium' 
                    : 'hover:bg-muted/50'}`}
              >
                {item.icon}
                {item.title}
              </Button>
            </Link>
          ))}
        </nav>
      </ScrollArea>
      
      <div className="border-t p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <Switch 
            id="dark-mode" 
            checked={isDarkMode}
            onCheckedChange={toggleTheme}
          />
          <Label htmlFor="dark-mode">Dark Mode</Label>
        </div>
        
        <div className="flex items-center gap-3 px-3 py-2">
          <CircleUserIcon className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Admin User</p>
            <p className="text-xs text-muted-foreground truncate">admin@example.com</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground" 
          onClick={handleLogout}
        >
          <LogOutIcon className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};