import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';

interface StaffProtectedRouteProps {
  children: React.ReactNode;
}

export function StaffProtectedRoute({ children }: StaffProtectedRouteProps) {
  const { isAuthenticated, loading } = useStaffAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/staff/login" replace />;
  }

  return <>{children}</>;
}
