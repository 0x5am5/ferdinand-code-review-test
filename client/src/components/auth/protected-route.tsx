
import { FC } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';

interface ProtectedRouteProps {
  component: FC;
  adminOnly?: boolean;
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({ component: Component, adminOnly }) => {
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

  return <Component />;
};
