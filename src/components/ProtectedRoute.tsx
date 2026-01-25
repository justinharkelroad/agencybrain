import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';
import { PendingActivationGuard } from '@/components/PendingActivationGuard';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAgencyOwner?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireAgencyOwner = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isAgencyOwner, isKeyEmployee, adminLoading, roleLoading, membershipTier } = useAuth();

  if (loading || (requireAdmin && adminLoading) || (requireAgencyOwner && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // Admins bypass tier check
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  // Agency owner routes: allow if admin OR agency owner OR key employee
  if (requireAgencyOwner && !isAdmin && !isAgencyOwner && !isKeyEmployee) {
    return <Navigate to="/dashboard" />;
  }

  // For non-admin users, check if tier is pending (NULL) or inactive
  // Admins and key employees should always have access regardless of tier
  // Key employees inherit access from their agency owner
  if (!isAdmin && !isKeyEmployee && (!membershipTier || membershipTier === 'Inactive')) {
    return <PendingActivationGuard>{children}</PendingActivationGuard>;
  }

  return <>{children}</>;
}