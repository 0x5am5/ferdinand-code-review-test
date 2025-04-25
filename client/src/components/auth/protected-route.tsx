
import { FC, ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ children, adminOnly }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !user.role?.includes('ADMIN')) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
};
