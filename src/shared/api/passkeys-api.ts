import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { AppError } from '@/shared/errors/AppError.ts';
import { FRONTEND_ERROR_CODES } from '@/shared/errors/frontend-error-codes.ts';

import { type Passkey, passkeySchema } from './passkey-contracts.ts';

const WEBAUTHN_API = `${API_BASE_PATH}/auth/me/webauthn`;

/** One row of `GET /auth/me/webauthn/credentials` (clinozy-be `serializeWebauthnCredential`). */
const credentialWireSchema = z.object({
  id: z.string(),
  device_type: z.string(),
  backed_up: z.boolean(),
  transports: z.array(z.string()),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
});

/**
 * `POST /auth/me/webauthn/register/options` → `{ options, challenge_token }`.
 * `options` is `@simplewebauthn/server`'s `PublicKeyCredentialCreationOptionsJSON`:
 * every binary member arrives base64url-encoded.
 */
const registerOptionsWireSchema = z.object({
  challenge_token: z.string(),
  // attestation, authenticatorSelection, extensions, hints: handed to the
  // browser as the server sent them (loose object) — they carry no binary members.
  options: z.looseObject({
    challenge: z.string(),
    rp: z.object({ id: z.string().optional(), name: z.string() }),
    user: z.object({ id: z.string(), name: z.string(), displayName: z.string() }),
    pubKeyCredParams: z.array(
      z.object({ type: z.literal('public-key'), alg: z.number() }),
    ),
    timeout: z.number().optional(),
    excludeCredentials: z
      .array(
        z.object({
          id: z.string(),
          type: z.literal('public-key'),
          transports: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  }),
});

function fromWire(wire: z.infer<typeof credentialWireSchema>): Passkey {
  return passkeySchema.parse({
    id: wire.id,
    synced: wire.device_type === 'multiDevice',
    createdAt: wire.created_at,
    lastUsedAt: wire.last_used_at,
  });
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/={1,2}$/, '');
}

function base64UrlToBuffer(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

function passkeyError(code: string, statusCode: number): AppError {
  return new AppError(code, statusCode, code);
}

/**
 * Run `navigator.credentials.create()` and turn the browser's refusals into our
 * own codes. A dismissed or timed-out prompt rejects with `NotAllowedError`
 * (it does not resolve `null`), and an authenticator that already holds one of
 * the account's passkeys (`excludeCredentials`) rejects with `InvalidStateError`.
 * Either way nothing was registered and the user can simply try again.
 */
async function createCredential(
  publicKey: PublicKeyCredentialCreationOptions,
): Promise<PublicKeyCredential> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    throw passkeyError(FRONTEND_ERROR_CODES.AUTH_PASSKEY_UNAVAILABLE, 400);
  }
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'InvalidStateError') {
      throw passkeyError(FRONTEND_ERROR_CODES.AUTH_PASSKEY_ALREADY_REGISTERED, 409);
    }
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      throw passkeyError(FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED, 400);
    }
    throw error;
  }
  if (!credential) throw passkeyError(FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED, 400);
  return credential as PublicKeyCredential;
}

/** The account's registered passkeys (`GET /auth/me/webauthn/credentials`). */
export async function listPasskeys(): Promise<Passkey[]> {
  const res = await apiClient.get<unknown>(`${WEBAUTHN_API}/credentials`);
  return z.array(credentialWireSchema).parse(res.data).map(fromWire);
}

/**
 * Register a passkey: options → browser ceremony → verify.
 *
 * The options request carries an empty body (the route is `.strict()`), and the
 * `challenge_token` it returns is echoed at verify next to the credential
 * serialized as WebAuthn `RegistrationResponseJSON` (camelCase, base64url).
 * Resolves once the server has stored the credential; the caller refetches the
 * list for the row itself (verify answers only `{ verified, credential_id }`).
 */
export async function registerPasskey(): Promise<void> {
  const optionsRes = await apiClient.post<unknown>(
    `${WEBAUTHN_API}/register/options`,
    {},
  );
  const { options, challenge_token } = registerOptionsWireSchema.parse(optionsRes.data);

  const credential = await createCredential({
    ...(options as unknown as PublicKeyCredentialCreationOptions),
    challenge: base64UrlToBuffer(options.challenge),
    user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((excluded) => ({
      id: base64UrlToBuffer(excluded.id),
      type: excluded.type,
      transports: excluded.transports as AuthenticatorTransport[] | undefined,
    })),
  });

  const attestation = credential.response as AuthenticatorAttestationResponse;
  const transports = attestation.getTransports?.();
  const attachment = credential.authenticatorAttachment;
  await apiClient.post<unknown>(`${WEBAUTHN_API}/register/verify`, {
    challenge_token,
    response: {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
        attestationObject: bufferToBase64Url(attestation.attestationObject),
        ...(transports ? { transports } : {}),
      },
      ...(attachment ? { authenticatorAttachment: attachment } : {}),
      clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    },
  });
}

/** Revoke one passkey by its opaque public id (`DELETE /auth/me/webauthn/credentials/{id}`). */
export async function removePasskey(id: string): Promise<void> {
  await apiClient.delete<unknown>(
    `${WEBAUTHN_API}/credentials/${encodeURIComponent(id)}`,
  );
}
