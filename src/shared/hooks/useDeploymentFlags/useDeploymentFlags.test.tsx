import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { DEFAULT_DEPLOYMENT_FLAGS } from '@/shared/tenancy/deployment-mode.ts';

const { useMeContextMock } = vi.hoisted(() => ({
  useMeContextMock: vi.fn(),
}));

vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: useMeContextMock,
  meContextQueryKey: ['auth', 'me-context'],
}));

import { useDeploymentFlags, useDeploymentMode } from './useDeploymentFlags.ts';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDeploymentFlags', () => {
  it('prefers me/context flags over the store cache', () => {
    useOrganizationStore.setState({ deploymentFlags: DEFAULT_DEPLOYMENT_FLAGS });
    useMeContextMock.mockReturnValue({
      data: {
        deploymentFlags: { personalOrganizations: false, teamOrganizations: true },
      },
    });

    const wrapper = createWrapper();
    const { result: flagsResult } = renderHook(() => useDeploymentFlags(), { wrapper });
    expect(flagsResult.current).toEqual({
      personalOrganizations: false,
      teamOrganizations: true,
    });

    const { result: modeResult } = renderHook(() => useDeploymentMode(), { wrapper });
    expect(modeResult.current).toBe('team-only');
  });
});
