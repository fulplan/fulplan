import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { AuthProvider } from './lib/auth-context';
import { getToken } from './lib/storage';
import { apiUrl, trpc } from './lib/trpc';
import { ReceiptPage } from './pages/ReceiptPage';

// Check for the public receipt route before rendering the full app.
// Receipt pages are unauthenticated — share links must open without a login wall.
const receiptMatch = window.location.pathname.match(/^\/receipt\/([^/]+)$/);

function makeClients() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        staleTime: 10_000,
        retry: 1,
      },
    },
  });

  const trpcClient = trpc.createClient({
    links: [
      httpBatchLink({
        url: `${apiUrl}/trpc`,
        headers() {
          const token = getToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });

  return { queryClient, trpcClient };
}

function ReceiptRoot({ saleId }: { saleId: string }) {
  const [{ queryClient, trpcClient }] = useState(makeClients);
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ReceiptPage saleId={saleId} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

function Root() {
  const [{ queryClient, trpcClient }] = useState(makeClients);

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
    {receiptMatch ? <ReceiptRoot saleId={receiptMatch[1]!} /> : <Root />}
  </React.StrictMode>,
);
