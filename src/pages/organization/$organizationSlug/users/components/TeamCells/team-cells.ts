import type { Tone } from '@/shared/api/app/app-schema.ts';

/** A role or branch pill as the Team draws it: its label in its tone. */
export interface TeamPill {
  id: string;
  label: string;
  tone: Tone;
}
