import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}));
vi.mock('@/core/http/api.ts', () => ({ api: { get: getMock, patch: patchMock } }));

import { fetchSignInClinic, saveSignInClinic } from './user-settings-api.ts';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('fetchSignInClinic', () => {
  it('reads the pinned clinic from GET /users/me/settings', async () => {
    getMock.mockResolvedValue({
      data: { language: 'en', default_organization_id: 'org_ojasclinic0000000001' },
    });

    await expect(fetchSignInClinic()).resolves.toBe('org_ojasclinic0000000001');
    expect(getMock).toHaveBeenCalledWith('/users/me/settings');
  });

  it('reads null, and a backend that predates the field, as automatic', async () => {
    getMock.mockResolvedValueOnce({ data: { default_organization_id: null } });
    await expect(fetchSignInClinic()).resolves.toBeNull();

    getMock.mockResolvedValueOnce({ data: { language: 'en' } });
    await expect(fetchSignInClinic()).resolves.toBeNull();
  });
});

describe('saveSignInClinic', () => {
  it('sends only default_organization_id and answers what was saved', async () => {
    patchMock.mockResolvedValue({
      data: { default_organization_id: 'org_ojasclinic0000000001' },
    });

    await expect(saveSignInClinic('org_ojasclinic0000000001')).resolves.toBe(
      'org_ojasclinic0000000001',
    );
    expect(patchMock).toHaveBeenCalledWith('/users/me/settings', {
      body: { default_organization_id: 'org_ojasclinic0000000001' },
    });
  });

  it('sends null to go back to the clinic used last', async () => {
    patchMock.mockResolvedValue({ data: { default_organization_id: null } });

    await expect(saveSignInClinic(null)).resolves.toBeNull();
    expect(patchMock).toHaveBeenCalledWith('/users/me/settings', {
      body: { default_organization_id: null },
    });
  });
});
