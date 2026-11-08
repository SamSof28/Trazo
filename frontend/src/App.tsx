import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { CookieBanner } from './features/cookies/CookieBanner';
import { Toaster } from './shared/components/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos por defecto
      retry: (failureCount, error) => {
        // No reintentar errores 401, 403, 404 ni 422
        if (typeof error === 'object' && error !== null && 'status' in error) {
          const status = (error as { status: number }).status;
          if ([401, 403, 404, 422].includes(status)) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <CookieBanner />
      <Toaster />
    </QueryClientProvider>
  );
};
