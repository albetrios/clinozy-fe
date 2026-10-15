import { z } from 'zod';

import { api } from '@/core/http/api.ts';

/** TanStack Query keys for the signed-in person's own settings. */
export const userSettingsQueryKeys = {
  /** The clinic pinned to open at sign-in — `null` for the clinic used last. */
  signInClinic: () => ['account', 'settings', 'sign-in-clinic'] as const,
};

/**
 * The one field of `/users/me/settings` this module reads. A backend that predates it answers
 * without the field, which reads as automatic.
 */
const signInClinicWire = z.object({
  default_organization_id: z.string().nullable().optional(),
});

const signInClinicOf = (data: unknown): string | null =>
  signInClinicWire.parse(data).default_organization_id ?? null;

/**
 * The clinic pinned to open at sign-in (`GET /users/me/settings` › `default_organization_id`), or
 * `null` for the automatic default — the clinic used last. clinozy-be also answers `null` while a
 * pinned clinic is no longer one the person actively belongs to.
 */
export async function fetchSignInClinic(): Promise<string | null> {
  const response = await api.get('/users/me/settings');
  return signInClinicOf(response.data);
}

/**
 * Pin a clinic to open at sign-in, or `null` to go back to the clinic used last
 * (`PATCH /users/me/settings`). Answers what clinozy-be saved. A clinic the person does not
 * actively belong to is a `422` with `reason: default_organization_unavailable`.
 */
export async function saveSignInClinic(
  organizationId: string | null,
): Promise<string | null> {
  const response = await api.patch('/users/me/settings', {
    body: { default_organization_id: organizationId },
  });
  return signInClinicOf(response.data);
}
