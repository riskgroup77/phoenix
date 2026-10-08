import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { PageSkeleton } from './ui/Skeleton';

type AllowedRoles = Role[];

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: AllowedRoles;
}

/**
 * Renders children only if user has one of the allowed roles; otherwise redirects to dashboard.
 */
const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasRole = allowedRoles.some((r) => user.role === r);
  if (!hasRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
