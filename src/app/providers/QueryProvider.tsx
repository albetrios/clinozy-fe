import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';

import { platformConfig } from '@/core/config/env.ts';
import { queryClient } from '@/core/http/queryClient.ts';

// Env-gated (VITE_DEVTOOLS). The dynamic import keeps the devtools in a lazy
// chunk that is only fetched when the flag is on — deployed builds set it off,
// so users never download it.
const ReactQueryDevtools = platformConfig.devtools
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : () => null;

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {platformConfig.devtools && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
