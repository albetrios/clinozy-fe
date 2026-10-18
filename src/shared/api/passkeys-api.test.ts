import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: getMock, post: postMock, delete: deleteMock },
}));

import { AppError } from '@/shared/errors/AppError.ts';
import { FRONTEND_ERROR_CODES } from '@/shared/errors/frontend-error-codes.ts';

import { listPasskeys, registerPasskey, removePasskey } from './passkeys-api.ts';

/** One row exactly as clinozy-be `serializeWebauthnCredential` emits it. */
const CREDENTIAL_WIRE = {
  id: 'wac_abcdefghijklmnopqrstu',
  device_type: 'multiDevice',
  backed_up: true,
  transports: ['internal', 'hybrid'],
  created_at: '2026-06-24T00:00:00.000Z',
  last_used_at: null,
};

const CHALLENGE_TOKEN = 'c'.repeat(64);

/** `POST …/register/options` as clinozy-be answers it: `{ options, challenge_token }`. */
const OPTIONS_WIRE = {
  challenge_token: CHALLENGE_TOKEN,
  options: {
    challenge: 'Y2hhbGxlbmdl',
    rp: { id: 'localhost', name: 'Clinozy' },
    user: { id: 'dXNlcg', name: 'u@example.com', displayName: 'U' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    timeout: 60000,
    attestation: 'none',
    excludeCredentials: [{ id: 'AQID', type: 'public-key', transports: ['usb'] }],
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    extensions: { credProps: true },
  },
};

function fakeCredential() {
  return {
    id: 'AQID',
    rawId: new Uint8Array([1, 2, 3]).buffer,
    type: 'public-key',
    authenticatorAttachment: 'platform',
    getClientExtensionResults: () => ({ credProps: { rk: true } }),
    response: {
      clientDataJSON: new Uint8Array([4, 5]).buffer,
      attestationObject: new Uint8Array([6, 7]).buffer,
      getTransports: () => ['internal'],
    },
  };
}

/** Bytes of a decoded buffer as a plain array — buffers from jsdom's realm never deep-equal ours. */
function bytes(buffer: ArrayBuffer): number[] {
  return Array.from(new Uint8Array(buffer));
}

function stubWebAuthn(create: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {});
  vi.stubGlobal('navigator', { credentials: { create } });
}

beforeEach(() => {
  getMock.mockReset();
  postMock.mockReset();
  deleteMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('passkeys-api', () => {
  it('lists and maps the backend credential row → domain', async () => {
    getMock.mockResolvedValue({ data: [CREDENTIAL_WIRE] });
    const res = await listPasskeys();
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me/webauthn/credentials'),
    );
    expect(res).toEqual([
      {
        id: 'wac_abcdefghijklmnopqrstu',
        synced: true,
        createdAt: '2026-06-24T00:00:00.000Z',
        lastUsedAt: null,
      },
    ]);
  });

  it('maps a single-device credential as not synced', async () => {
    getMock.mockResolvedValue({
      data: [{ ...CREDENTIAL_WIRE, device_type: 'singleDevice', backed_up: false }],
    });
    const [passkey] = await listPasskeys();
    expect(passkey?.synced).toBe(false);
  });

  it('rejects a list body that is not the backend contract instead of claiming "no passkeys"', async () => {
    getMock.mockResolvedValue({ data: null });
    await expect(listPasskeys()).rejects.toThrow();
  });

  it('registers with the backend contract: empty options body → ceremony → { challenge_token, response }', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE }).mockResolvedValueOnce({
      data: { verified: true, credential_id: CREDENTIAL_WIRE.id },
    });
    const create = vi.fn().mockResolvedValue(fakeCredential());
    stubWebAuthn(create);

    await expect(registerPasskey()).resolves.toBeUndefined();

    // The options route is `z.object({}).strict()` — any key (the old `name`) is a 400.
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/auth/me/webauthn/register/options'),
      {},
    );

    // The wrapped `options` reach the browser with binary members decoded.
    expect(create).toHaveBeenCalledOnce();
    const publicKey = create.mock.calls[0]?.[0]?.publicKey;
    expect(bytes(publicKey.challenge)).toEqual([
      ...new TextEncoder().encode('challenge'),
    ]);
    expect(bytes(publicKey.user.id)).toEqual([...new TextEncoder().encode('user')]);
    expect(bytes(publicKey.excludeCredentials[0].id)).toEqual([1, 2, 3]);
    expect(publicKey.excludeCredentials[0].transports).toEqual(['usb']);
    expect(publicKey.authenticatorSelection).toEqual(
      OPTIONS_WIRE.options.authenticatorSelection,
    );
    expect(publicKey).not.toHaveProperty('challenge_token');

    // Verify echoes the token and sends RegistrationResponseJSON (camelCase, base64url).
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/me/webauthn/register/verify'),
      {
        challenge_token: CHALLENGE_TOKEN,
        response: {
          id: 'AQID',
          rawId: 'AQID',
          type: 'public-key',
          response: {
            clientDataJSON: 'BAU',
            attestationObject: 'Bgc',
            transports: ['internal'],
          },
          authenticatorAttachment: 'platform',
          clientExtensionResults: { credProps: { rk: true } },
        },
      },
    );
  });

  it('turns a dismissed device prompt (NotAllowedError) into AUTH_PASSKEY_CANCELLED and never verifies', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE });
    stubWebAuthn(
      vi.fn().mockRejectedValue(new DOMException('cancelled', 'NotAllowedError')),
    );

    const error = await registerPasskey().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED);
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('turns an already-enrolled authenticator (InvalidStateError) into its own code', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE });
    stubWebAuthn(
      vi.fn().mockRejectedValue(new DOMException('excluded', 'InvalidStateError')),
    );

    const error = await registerPasskey().catch((caught: unknown) => caught);
    expect((error as AppError).code).toBe(
      FRONTEND_ERROR_CODES.AUTH_PASSKEY_ALREADY_REGISTERED,
    );
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('treats a null credential as cancelled', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE });
    stubWebAuthn(vi.fn().mockResolvedValue(null));

    const error = await registerPasskey().catch((caught: unknown) => caught);
    expect((error as AppError).code).toBe(FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED);
  });

  it('rethrows any other ceremony failure untouched', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE });
    const failure = new DOMException('bad rp', 'SecurityError');
    stubWebAuthn(vi.fn().mockRejectedValue(failure));

    await expect(registerPasskey()).rejects.toBe(failure);
  });

  it('refuses before prompting when the browser has no WebAuthn', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE });
    const create = vi.fn();
    vi.stubGlobal('PublicKeyCredential', undefined);
    vi.stubGlobal('navigator', { credentials: { create } });

    const error = await registerPasskey().catch((caught: unknown) => caught);
    expect((error as AppError).code).toBe(FRONTEND_ERROR_CODES.AUTH_PASSKEY_UNAVAILABLE);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an options answer that is not the wrapped { options, challenge_token } shape', async () => {
    postMock.mockResolvedValueOnce({ data: OPTIONS_WIRE.options });
    const create = vi.fn();
    stubWebAuthn(create);

    await expect(registerPasskey()).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it('revokes via DELETE (id encoded into the path)', async () => {
    deleteMock.mockResolvedValue({ data: null });
    await removePasskey(CREDENTIAL_WIRE.id);
    expect(deleteMock).toHaveBeenCalledWith(
      expect.stringContaining(`/auth/me/webauthn/credentials/${CREDENTIAL_WIRE.id}`),
    );
  });
});
