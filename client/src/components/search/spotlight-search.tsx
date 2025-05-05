import React, { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, X, ChevronRight, Home, Building, Users, Palette, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

// Types for clients and users
interface Client {
  id: number;
  name: string;
  industry?: string;
}

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

type SearchResult = {
  id: string;
  type: "page" | "client" | "asset" | "persona" | "user";
  title: string;
  subtitle?: string;
  href: string;
  icon?: React.ReactNode;
  tags?: string[];
};

export interface SpotlightSearchProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose: () => void;
}

export function SpotlightSearch({ onClose, className, ...props }: SpotlightSearchProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  // Focus the input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Fetch clients for search results
  const { data: clients = [] } = useQuery<Client[], unknown, SearchResult[]>({
    queryKey: ['/api/clients'],
    enabled: user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN,
    select: (data) => data.map((client) => ({
      id: `client-${client.id}`,
      type: "client" as const,
      title: client.name,
      subtitle: client.industry || "Client",
      href: `/clients/${client.id}`,
      icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-600"><Briefcase className="h-3.5 w-3.5" /></div>,
      tags: client.industry ? [client.industry, "brand", "client"] : ["brand", "client"],
    })),
  });

  // Fetch users for search results
  const { data: users = [] } = useQuery<AppUser[], unknown, SearchResult[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN,
    select: (data) => data.map((u) => ({
      id: `user-${u.id}`,
      type: "user" as const,
      title: u.name,
      subtitle: u.email,
      href: `/users?highlight=${u.id}`,
      icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-purple-100 text-purple-600"><User className="h-3.5 w-3.5" /></div>,
      tags: [u.role],
    })),
  });

  // Navigation menu items
  const navigationItems = useMemo(() => {
    const items: SearchResult[] = [
      {
        id: "dashboard",
        type: "page",
        title: "Dashboard",
        subtitle: "Overview of your brand activities",
        href: "/dashboard",
        icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-blue-100 text-blue-600"><Home className="h-3.5 w-3.5" /></div>,
        tags: ["home", "overview", "dashboard"],
      },
    ];

    // Add admin navigation items if user has appropriate role
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) {
      items.push(
        {
          id: "clients",
          type: "page",
          title: "Brands",
          subtitle: "Manage client brands",
          href: "/clients",
          icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 text-indigo-600"><Building className="h-3.5 w-3.5" /></div>,
          tags: ["brands", "clients", "companies"],
        },
        {
          id: "users",
          type: "page",
          title: "Users",
          subtitle: "Manage user accounts",
          href: "/users",
          icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-purple-100 text-purple-600"><Users className="h-3.5 w-3.5" /></div>,
          tags: ["users", "accounts", "team"],
        }
      );
    }

    if (
      user?.role === UserRole.ADMIN ||
      user?.role === UserRole.SUPER_ADMIN ||
      user?.role === UserRole.EDITOR
    ) {
      items.push({
        id: "design-builder",
        type: "page",
        title: "Design Builder",
        subtitle: "Create and edit design assets",
        href: "/design-builder",
        icon: <div className="flex items-center justify-center w-6 h-6 rounded bg-pink-100 text-pink-600"><Palette className="h-3.5 w-3.5" /></div>,
        tags: ["design", "assets", "brand", "creative"],
      });
    }

    return items;
  }, [user?.role]);

  // Combine all search results
  const allSearchResults = useMemo(() => {
    return [...navigationItems, ...clients, ...users];
  }, [navigationItems, clients, users]);

  // Filter results based on search query
  const filteredResults = useMemo(() => {
    if (!query) return allSearchResults;
    
    return allSearchResults.filter(
      (item) => 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
        (item.tags && item.tags.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase())))
    );
  }, [allSearchResults, query]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    onClose();
  };

  return (
    <div className={cn("flex flex-col h-full", className)} {...props}>
      <div className="flex items-center p-2 border-b">
        <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex h-9 w-full rounded-md border-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex items-center gap-1 ml-2">
          <Button 
            onClick={onClose}
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {filteredResults.length > 0 ? (
            <>
              {/* Group results by type */}
              {(() => {
                // Get unique result types
                const resultTypes = Array.from(new Set(filteredResults.map(r => r.type)));
                
                return resultTypes.map(type => {
                  const resultsOfType = filteredResults.filter(r => r.type === type);
                  if (resultsOfType.length === 0) return null;
                  
                  // Generate type label
                  let typeLabel = "Results";
                  if (type === "page") typeLabel = "Pages";
                  if (type === "client") typeLabel = "Brands";
                  if (type === "user") typeLabel = "Users";
                  
                  return (
                    <div key={type} className="space-y-1">
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {typeLabel}
                      </div>
                      {resultsOfType.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelect(result)}
                          className="flex items-center gap-2 w-full p-2 text-sm rounded-md hover:bg-muted text-left"
                        >
                          {result.icon}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{result.title}</div>
                            {result.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  );
                });
              })()}
            </>
          ) : (
            <div className="py-6 text-center">
              <div className="text-muted-foreground">No results found</div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t">
        <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>Search with</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded border">⌘</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded border">K</kbd>
          </div>
          <div className="flex items-center gap-1">
            <span>Navigate with</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded border">↑</kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded border">↓</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}