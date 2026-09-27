import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';

const MFA_API = `${API_BASE_PATH}/auth/me/mfa`;

export interface MfaEnrollment {
  secret: string;
  otpauthUri: string;
}
export interface MfaConfirmation {
  recoveryCodes: string[];
}

// clinozy-be names the QR URI `provisioning_uri`; accept the older `otpauth_uri`
// alias too so a version skew never breaks enrollment mid-ceremony.
const enrollWireSchema = z.object({
  secret: z.string(),
  provisioning_uri: z.string().optional(),
  otpauth_uri: z.string().optional(),
});
const confirmWireSchema = z.object({ recovery_codes: z.array(z.string()) });
const mfaMethodWireSchema = z.object({ id: z.string() });

export async function getMfaStatus(): Promise<boolean> {
  const res = await apiClient.get<unknown>(MFA_API);
  return z.array(z.unknown()).parse(res.data).length > 0;
}

export async function beginMfaEnrollment(): Promise<MfaEnrollment> {
  const res = await apiClient.post<unknown>(`${MFA_API}/enroll`, {
    method_type: 'MFA_TOTP',
  });
  const wire = enrollWireSchema.parse(res.data);
  const uri = wire.provisioning_uri ?? wire.otpauth_uri;
  if (!uri) throw new Error('MFA enrollment returned no provisioning URI');
  return { secret: wire.secret, otpauthUri: uri };
}

export async function confirmMfaEnrollment(code: string): Promise<MfaConfirmation> {
  const res = await apiClient.post<unknown>(`${MFA_API}/enroll/confirm`, {
    code,
  });
  return { recoveryCodes: confirmWireSchema.parse(res.data).recovery_codes };
}

/**
 * Disable MFA. clinozy-be has no collection DELETE — each enrolled method is
 * removed by id (`DELETE /auth/me/mfa/:mfa_method_id`, STRONG step-up gated),
 * so list first and delete every enrolled method.
 */
export async function disableMfa(): Promise<void> {
  const res = await apiClient.get<unknown>(MFA_API);
  const methods = z.array(mfaMethodWireSchema).parse(res.data);
  for (const method of methods) {
    await apiClient.delete<unknown>(`${MFA_API}/${method.id}`);
  }
}
