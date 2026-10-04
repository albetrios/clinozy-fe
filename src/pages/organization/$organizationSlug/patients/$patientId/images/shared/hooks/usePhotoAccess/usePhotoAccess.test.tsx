import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { usePhotoAccess } from './usePhotoAccess.ts';

function renderAccess(role: Role) {
  useUIStore.setState({ previewRole: role });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePhotoAccess(), { wrapper });
}

beforeEach(() => useOrganizationStore.getState().setPermissions(['organization:read']));
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('usePhotoAccess', () => {
  it('opens the Private album to Doctor, Admin and Owner (S:40)', async () => {
    for (const role of ['doctor', 'admin', 'owner'] as const) {
      const { result } = renderAccess(role);
      await waitFor(() => expect(result.current.resolved).toBe(true));
      expect(result.current.albums).toEqual(['general', 'private', 'lhr']);
    }
    const { result } = renderAccess('front_desk');
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.privateAlbum).toBe(false);
    expect(result.current.albums).toEqual(['general', 'lhr']);
  });

  it('follows Patients create, edit and delete for upload, details and delete', async () => {
    const admin = renderAccess('admin');
    await waitFor(() => expect(admin.result.current.resolved).toBe(true));
    expect(admin.result.current).toMatchObject({
      canUpload: true,
      canEdit: true,
      canDelete: true,
    });
    const therapist = renderAccess('therapist');
    await waitFor(() => expect(therapist.result.current.resolved).toBe(true));
    expect(therapist.result.current).toMatchObject({ canUpload: false, canEdit: false });
  });
});
