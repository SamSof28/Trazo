import React, { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store';

export const ProtectedRoute: React.FC = () => {
  const { status, user, restoreSession } = useAuthStore();

  useEffect(() => {
    if (status === 'idle') {
      void restoreSession();
    }
  }, [status, restoreSession]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-3 border-forest border-t-transparent rounded-full animate-spin" />
          <span className="font-sans text-sm text-muted">Cargando sesión…</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
