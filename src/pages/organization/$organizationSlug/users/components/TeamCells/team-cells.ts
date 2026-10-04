import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** A role or branch pill as the Team draws it: its label in its tone. */
export interface TeamPill {
  id: string;
  label: string;
  tone: Tone;
}

/** Whether an invitation's link has expired (clinozy-be then refuses a resend). */
export function isInvitationExpired(
  invitation: { expiresAt: string },
  now: number = Date.now(),
): boolean {
  return Date.parse(invitation.expiresAt) <= now;
}
