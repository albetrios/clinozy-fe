import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: postMock, delete: deleteMock },
}));

import { listPasskeys, registerPasskey, removePasskey } from './passkeys-api.ts';

const WIRE = {
  id: 'pk_x',
  name: 'YubiKey 5C',
  created_at: '2026-06-24T00:00:00.000Z',
  last_used_at: null,
};

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  deleteMock.mockReset();
});

describe('passkeys-api', () => {
  it('lists and maps wire → domain', async () => {
    getMock.mockResolvedValue({ data: [WIRE] });
    const res = await listPasskeys();
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/webauthn/credentials'),
    );
    expect(res).toEqual([
      {
        id: 'pk_x',
        name: 'YubiKey 5C',
        createdAt: '2026-06-24T00:00:00.000Z',
        lastUsedAt: null,
      },
    ]);
  });

  it('returns [] for a non-array body', async () => {
    getMock.mockResolvedValue({ data: null });
    expect(await listPasskeys()).toEqual([]);
  });

  it('registers via the WebAuthn ceremony (options → create → verify)', async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          challenge: 'Y2hhbGxlbmdl',
          rp: { name: 'Core' },
          user: { id: 'dXNlcg', name: 'u', displayName: 'U' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        },
      })
      .mockResolvedValueOnce({ data: WIRE });
    const create = vi.fn().mockResolvedValue({
      id: 'cred_x',
      rawId: new Uint8Array([1, 2, 3]).buffer,
      type: 'public-key',
      response: {
        clientDataJSON: new Uint8Array([4, 5]).buffer,
        attestationObject: new Uint8Array([6, 7]).buffer,
      },
    });
    vi.stubGlobal('navigator', { credentials: { create } });
    try {
      const pk = await registerPasskey('YubiKey 5C');
      expect(postMock).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/auth/me/webauthn/register/options'),
        { name: 'YubiKey 5C' },
      );
      expect(create).toHaveBeenCalledOnce();
      expect(postMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/auth/me/webauthn/register/verify'),
        expect.objectContaining({ name: 'YubiKey 5C' }),
      );
      expect(pk.name).toBe('YubiKey 5C');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('revokes via DELETE (id encoded into the path)', async () => {
    deleteMock.mockResolvedValue({ data: null });
    await removePasskey('pk_x');
    expect(deleteMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/webauthn/credentials/pk_x'),
    );
  });
});
