import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthButton } from "@/components/auth/auth-button";
import { 
  LayoutDashboard, Settings
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const adminNavigation = [
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
  });

  return (
    <div className="flex h-screen flex-col border-r bg-background">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Brand Manager</h1>
      </div>

      <ScrollArea className="flex-1 px-4">
        <nav className="flex flex-col gap-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={location === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2",
                    location === item.href && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}

          {user?.role === "admin" && (
            <>
              <div className="my-2 border-t" />
              {adminNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={location === item.href ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-2",
                        location === item.href && "bg-secondary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t">
        <AuthButton />
      </div>
    </div>
  );
}