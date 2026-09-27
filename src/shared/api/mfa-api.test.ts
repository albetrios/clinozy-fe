import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: postMock, delete: deleteMock },
}));

import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
} from './mfa-api.ts';

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  deleteMock.mockReset();
});

describe('mfa-api', () => {
  it('reads status', async () => {
    getMock.mockResolvedValue({ data: [{ method_type: 'MFA_TOTP' }] });
    await expect(getMfaStatus()).resolves.toBe(true);
  });

  it('begins enrollment and maps otpauth_uri', async () => {
    postMock.mockResolvedValue({ data: { secret: 'S', otpauth_uri: 'otpauth://x' } });
    const result = await beginMfaEnrollment();
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/mfa/enroll'),
      { method_type: 'MFA_TOTP' },
    );
    expect(result).toEqual({ secret: 'S', otpauthUri: 'otpauth://x' });
  });

  it('confirms with a code body and maps recovery_codes', async () => {
    postMock.mockResolvedValue({ data: { recovery_codes: ['a', 'b'] } });
    const result = await confirmMfaEnrollment('123456');
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/mfa/enroll/confirm'),
      {
        code: '123456',
      },
    );
    expect(result).toEqual({ recoveryCodes: ['a', 'b'] });
  });

  it('disables by listing enrolled methods and deleting each by id', async () => {
    // clinozy-be has no collection DELETE — each method is removed by id.
    getMock.mockResolvedValue({ data: [{ id: 'mfa_1' }, { id: 'mfa_2' }] });
    deleteMock.mockResolvedValue({ data: null });
    await disableMfa();
    expect(deleteMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/mfa/mfa_1'),
    );
    expect(deleteMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/mfa/mfa_2'),
    );
  });
});
