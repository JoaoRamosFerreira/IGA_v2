import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <div className="p-6">Loading...</div>;
  if (!session) return <Navigate to="/auth" replace />;
  if (profile?.status === 'pending') return <Navigate to="/pending-approval" replace />;
  if (profile?.status === 'suspended') return <Navigate to="/suspended" replace />;

  return children;
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
