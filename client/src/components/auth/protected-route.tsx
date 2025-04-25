
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

  if (adminOnly && !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
};
