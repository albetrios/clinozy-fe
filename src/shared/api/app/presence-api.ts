import { api } from '@/core/http/api.ts';

import { type Presence, presenceSchema } from './app-schema.ts';

/** TanStack Query keys for the signed-in member's presence. */
export const presenceQueryKeys = {
  mine: () => ['app', 'presence', 'mine'] as const,
};

/** A presence as clinozy-be answers it; Online when it names none. */
const presenceOf = (value: unknown): Presence =>
  presenceSchema.catch('online').parse(value);

/**
 * Read my presence — Online · Away · Busy, the Account menu's Status — from my own user
 * (`GET /users/me`). Others' presence is not served (G5): only your own.
 */
export async function fetchMyPresence(): Promise<Presence> {
  const response = await api.get('/users/me');
  return presenceOf(response.data?.presence);
}

/** Set my presence (`PUT /users/me/presence`); answers the presence clinozy-be saved. */
export async function saveMyPresence(presence: Presence): Promise<Presence> {
  const response = await api.put('/users/me/presence', { body: { presence } });
  return presenceOf(response.data?.presence);
}
