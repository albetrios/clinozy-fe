import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { previewPreset } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { usePhotoAccess } from './usePhotoAccess.ts';

function renderAccess({
  codes = ['organization:read'],
  role = null,
}: {
  codes?: OrganizationPermission[];
  role?: Role | null;
}) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions(codes);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (role) previewPreset(client, role);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePhotoAccess(), { wrapper });
}

afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('usePhotoAccess', () => {
  it('opens the Private album by its code, and writes by patient:update', async () => {
    const { result } = renderAccess({
      codes: [
        'organization:read',
        'patient:read',
        'patient:update',
        'patient:private_album:read',
      ],
    });
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({
      privateAlbum: true,
      albums: ['general', 'private', 'lhr'],
      canWrite: true,
    });
  });

  it('keeps the Private album and the writes from a member without their codes', async () => {
    const { result } = renderAccess({
      codes: ['organization:read', 'patient:read'],
    });
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({
      privateAlbum: false,
      albums: ['general', 'lhr'],
      canWrite: false,
    });
  });

  it('previews the Private album by the previewed role’s codes during View-as (Doctor, Admin, Owner)', async () => {
    for (const role of ['doctor', 'admin', 'owner'] as const) {
      const { result } = renderAccess({ role });
      await waitFor(() => expect(result.current.resolved).toBe(true));
      expect(result.current.albums).toEqual(['general', 'private', 'lhr']);
    }
    const { result } = renderAccess({ role: 'front_desk' });
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.privateAlbum).toBe(false);
  });

  it('says nothing until access has answered', () => {
    useOrganizationStore.getState().clearPermissions();
    const client = new QueryClient();
    const { result } = renderHook(() => usePhotoAccess(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current).toMatchObject({ resolved: false, canWrite: false });
  });
});
