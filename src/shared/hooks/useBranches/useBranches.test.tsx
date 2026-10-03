import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { useBranches } from './useBranches.ts';

describe('useBranches', () => {
  it('loads the active branches', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useBranches(), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.branches.length).toBeGreaterThan(1));
    expect(result.current.isPending).toBe(false);
  });
});
