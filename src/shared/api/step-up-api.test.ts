import { describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: postMock },
}));

import {
  isStepUpRequiredError,
  listAuthMethods,
  stepUpWithEmailCode,
  stepUpWithPassword,
  stepUpWithTotp,
} from './step-up-api.ts';

describe('step-up-api', () => {
  it('lists auth methods as {id, methodType}', async () => {
    getMock.mockResolvedValue({
      data: [
        { id: 'am_1', method_type: 'PASSWORD', provider: null },
        { id: 'am_2', method_type: 'OAUTH', provider: 'google' },
      ],
    });
    await expect(listAuthMethods()).resolves.toEqual([
      { id: 'am_1', methodType: 'PASSWORD' },
      { id: 'am_2', methodType: 'OAUTH' },
    ]);
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/auth-methods'),
    );
  });

  it('steps up with a password via POST /auth/step-up', async () => {
    postMock.mockResolvedValue({ data: null });
    await stepUpWithPassword('hunter2');
    expect(postMock).toHaveBeenCalledWith(expect.stringContaining('/auth/step-up'), {
      password: 'hunter2',
    });
  });

  it('steps up with a bootstrap email code via POST /auth/step-up', async () => {
    postMock.mockResolvedValue({ data: null });
    await stepUpWithEmailCode('A1B2C3');
    expect(postMock).toHaveBeenCalledWith(expect.stringContaining('/auth/step-up'), {
      code: 'A1B2C3',
    });
  });

  it('steps up with TOTP via POST /auth/me/mfa/verify', async () => {
    postMock.mockResolvedValue({ data: null });
    await stepUpWithTotp('123456');
    expect(postMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/mfa/verify'),
      {
        code: '123456',
      },
    );
  });
});

describe('isStepUpRequiredError', () => {
  const stepUpBody = {
    error: { code: 'forbidden', detail: 'Recent step-up authentication is required' },
  };

  it('matches a 403 whose detail names step-up', () => {
    const error = new HttpError('Forbidden', 403, '/x', 'POST', stepUpBody);
    expect(isStepUpRequiredError(error)).toBe(true);
  });

  it('rejects other 403s, other statuses, and non-HTTP errors', () => {
    expect(
      isStepUpRequiredError(
        new HttpError('Forbidden', 403, '/x', 'POST', {
          error: { detail: 'You cannot do that' },
        }),
      ),
    ).toBe(false);
    expect(
      isStepUpRequiredError(new HttpError('Nope', 401, '/x', 'POST', stepUpBody)),
    ).toBe(false);
    expect(isStepUpRequiredError(new Error('boom'))).toBe(false);
  });
});
