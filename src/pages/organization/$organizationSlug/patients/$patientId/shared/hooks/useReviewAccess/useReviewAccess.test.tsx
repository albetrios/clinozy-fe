import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { useReviewAccess } from './useReviewAccess.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The gates for a member holding `codes` — or View-as `role`. */
function renderAccess(codes: readonly OrganizationPermission[], role?: Role) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  useUIStore.setState({ previewRole: role ?? null });
  return renderHook(() => useReviewAccess(), { wrapper });
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useReviewAccess', () => {
  it('logs, edits and removes reviews on the review codes — Marketing, without patient:update (D83)', async () => {
    const { result } = renderAccess([
      'organization:read',
      'patient:read',
      'patient_review:create',
      'patient_review:update',
      'patient_review:delete',
    ]);
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toEqual({
      resolved: true,
      log: true,
      edit: true,
      remove: true,
    });
  });

  it('logs no review on patient:update alone — the review codes decide', async () => {
    const { result } = renderAccess([
      'organization:read',
      'patient:read',
      'patient:update',
    ]);
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({ log: false, edit: false, remove: false });
  });

  it('follows the previewed role’s Patients matrix under View-as, which holds no codes', async () => {
    const { result } = renderAccess(['organization:read'], 'admin');
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.log).toBe(true);
  });
});
