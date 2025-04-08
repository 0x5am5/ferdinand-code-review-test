
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface ProtectedRouteProps {
  component: React.ComponentType;
  adminOnly?: boolean;
}

export function ProtectedRoute({ component: Component, adminOnly = false }: ProtectedRouteProps) {
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["/api/user"],
  });

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !(user.role === 'admin' || user.role === 'super_admin')) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}
