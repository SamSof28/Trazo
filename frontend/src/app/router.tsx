import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { LandingPage } from '../features/intake/LandingPage';
import { WorkspaceIntakePage } from '../features/workspace/WorkspaceIntakePage';
import { WorkspacePlanPage } from '../features/workspace/WorkspacePlanPage';
import { DashboardPage } from '../features/plans/DashboardPage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { AdminUsersPage } from '../features/users/AdminUsersPage';
import { ProtectedRoute } from './guards/ProtectedRoute';
import { AdminRoute } from './guards/AdminRoute';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <LandingPage />,
      },
      {
        path: '/workspace/:tripRequestId',
        element: <WorkspaceIntakePage />,
      },
      {
        path: '/plans/:planId',
        element: <WorkspacePlanPage />,
      },
      {
        path: '/plans',
        element: <DashboardPage />,
      },
      {
        path: '/catalog',
        element: <CatalogPage />,
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: '/admin/users',
            element: <AdminUsersPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
