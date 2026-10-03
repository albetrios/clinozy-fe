import type { Presence } from './clinic-schema.ts';

let stored: Presence = 'online';

/** TanStack Query keys for the signed-in member's presence. */
export const presenceQueryKeys = {
  mine: () => ['clinic', 'presence', 'mine'] as const,
};

/** Read my presence. REPLACE_WITH_API: the staff profile's `presence` (S:206). */
export async function fetchMyPresence(): Promise<Presence> {
  return stored;
}

/** Set my presence. REPLACE_WITH_API: `setPresence` (S:1571). */
export async function saveMyPresence(presence: Presence): Promise<Presence> {
  stored = presence;
  return stored;
}

/** Test-only: put the fixture back to Online. */
export function resetPresenceFixture(): void {
  stored = 'online';
}
