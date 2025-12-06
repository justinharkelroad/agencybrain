import { useAuth } from '@/lib/auth';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAgencyOwner?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireAgencyOwner = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, isAgencyOwner, adminLoading } = useAuth();

  if (loading || (requireAdmin && adminLoading) || (requireAgencyOwner && adminLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  // Agency owner routes: allow if admin OR agency owner
  if (requireAgencyOwner && !isAdmin && !isAgencyOwner) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}