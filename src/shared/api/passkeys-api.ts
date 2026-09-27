import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { AppError } from '@/shared/errors/AppError.ts';
import { FRONTEND_ERROR_CODES } from '@/shared/errors/frontend-error-codes.ts';

import { type Passkey, passkeySchema } from './passkey-contracts.ts';

const WEBAUTHN_API = `${API_BASE_PATH}/auth/me/webauthn`;

const wireSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
});

function fromWire(wire: z.infer<typeof wireSchema>): Passkey {
  return passkeySchema.parse({
    id: wire.id,
    name: wire.name,
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

interface CreationOptionsJson {
  challenge: string;
  rp: { id?: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: { id: string; type: 'public-key' }[];
}

export async function listPasskeys(): Promise<Passkey[]> {
  const res = await apiClient.get<unknown>(`${WEBAUTHN_API}/credentials`);
  const data = res.data;
  if (!Array.isArray(data)) return [];
  return data.map((raw) => fromWire(wireSchema.parse(raw)));
}

export async function registerPasskey(name: string): Promise<Passkey> {
  const optionsRes = await apiClient.post<unknown>(`${WEBAUTHN_API}/register/options`, {
    name,
  });
  const options = optionsRes.data as CreationOptionsJson;

  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: base64UrlToBuffer(options.challenge),
      user: { ...options.user, id: base64UrlToBuffer(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        id: base64UrlToBuffer(c.id),
        type: c.type,
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new AppError(
      FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED,
      400,
      FRONTEND_ERROR_CODES.AUTH_PASSKEY_CANCELLED,
    );
  }

  const attestation = credential.response as AuthenticatorAttestationResponse;
  const verifyRes = await apiClient.post<unknown>(`${WEBAUTHN_API}/register/verify`, {
    name,
    credential: {
      id: credential.id,
      raw_id: bufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        client_data_json: bufferToBase64Url(attestation.clientDataJSON),
        attestation_object: bufferToBase64Url(attestation.attestationObject),
      },
    },
  });
  return fromWire(wireSchema.parse(verifyRes.data));
}

export async function removePasskey(id: string): Promise<void> {
  await apiClient.delete<unknown>(
    `${WEBAUTHN_API}/credentials/${encodeURIComponent(id)}`,
  );
}
