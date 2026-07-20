import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { AuthProvider } from './lib/auth-context';
import { getToken } from './lib/storage';
import { apiUrl, trpc } from './lib/trpc';

function Root() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Multi-cashier visibility: refetch periodically so one till sees
            // another's stock changes without a full real-time layer.
            // See Product-Features.md "Multi-cashier live sync".
            refetchOnWindowFocus: true,
            staleTime: 10_000,
            retry: 1,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${apiUrl}/trpc`,
          headers() {
            const token = getToken();
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
