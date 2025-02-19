import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthButton } from "@/components/auth/auth-button";
import { 
  Layout, Palette, Type, Grid, Image, BookOpen,
  Settings
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

const navigation = [
  { name: "Overview", href: "/dashboard", icon: Layout },
  { name: "Colors", href: "/colors", icon: Palette },
  { name: "Typography", href: "/typography", icon: Type },
  { name: "Patterns", href: "/patterns", icon: Grid },
  { name: "Icons", href: "/icons", icon: Image },
  { name: "Illustrations", href: "/illustrations", icon: BookOpen },
];

export function Sidebar() {
  const [location] = useLocation();
  const { data: user } = useQuery<User>({ 
    queryKey: ["/api/auth/me"],
  });

  return (
    <div className="flex h-screen flex-col border-r bg-background">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Brand Guidelines</h1>
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
            <Link href="/admin/instances">
              <Button
                variant={location === "/admin/instances" ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-2",
                  location === "/admin/instances" && "bg-secondary"
                )}
              >
                <Settings className="h-4 w-4" />
                Client Instances
              </Button>
            </Link>
          )}
        </nav>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <AuthButton />
      </div>
    </div>
  );
}
