import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { useFixtureMyStaff, useFixtureStaff } from './useFixtureStaff.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signIn(email: string | null) {
  useAuthStore.setState({
    user: email ? ({ id: 'usr_me', email, role: 'user' } as AuthUser) : null,
  });
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useAuthStore.setState({ user: null });
});

describe('useFixtureStaff', () => {
  it('reads the fixture world’s staff', async () => {
    const { result } = renderHook(() => useFixtureStaff(), { wrapper });
    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
    expect(result.current.data?.every((profile) => profile.email.includes('@'))).toBe(
      true,
    );
  });
});

describe('useFixtureMyStaff', () => {
  it('finds the signed-in member by their email, whatever its case', async () => {
    const { result: staff } = renderHook(() => useFixtureStaff(), { wrapper });
    await waitFor(() => expect(staff.current.data?.length).toBeGreaterThan(0));
    const someone = staff.current.data?.[0];
    if (!someone) throw new Error('a fixture staff member');
    signIn(` ${someone.email.toUpperCase()} `);
    const { result } = renderHook(() => useFixtureMyStaff(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(someone));
  });

  it('answers null when nobody is signed in, or nobody has the email', async () => {
    signIn(null);
    const { result: signedOut, unmount } = renderHook(() => useFixtureMyStaff(), {
      wrapper,
    });
    await waitFor(() => expect(signedOut.current.isSuccess).toBe(true));
    expect(signedOut.current.data).toBeNull();
    unmount();
    signIn('nobody@elsewhere.com');
    const { result } = renderHook(() => useFixtureMyStaff(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
