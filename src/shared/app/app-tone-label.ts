import type { Tone } from '@/shared/api/app/app-schema.ts';

/**
 * The palette's tones, declared here rather than imported: `organization-api.ts` tones the members
 * and roles it reads, and it is on the first paint, where `app-schema.ts` (zod) and the tone class
 * table must not follow. `app-tone-label.test.ts` pins it equal to the contract's `TONE_VALUES`.
 */
export const SERVED_TONES: readonly Tone[] = [
  'butter',
  'lav',
  'sky',
  'sage',
  'blush',
  'mint',
  'peach',
  'plum',
  'lime',
  'slate',
  'stone',
];

/** The six tones an untoned label hashes onto, in the design's order (H:3875). */
const HASHED_TONES: readonly Tone[] = ['sky', 'sage', 'lav', 'butter', 'blush', 'mint'];

/**
 * The tone of a label without one of its own: the design's string hash
 * (`x * 31 + code`, unsigned 32-bit) of the trimmed, lower-cased label, onto
 * sky · sage · lav · butter · blush · mint (H:3875). Stable, so a label keeps
 * its colour everywhere it appears.
 */
export function toneForLabel(label: string): Tone {
  let hash = 0;
  for (const char of label.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return HASHED_TONES[hash % HASHED_TONES.length] ?? 'stone';
}

/**
 * A tone clinozy-be served (a member's, a role's): it when the palette has it, else the label's
 * own hashed tone — a tone a newer backend adds never breaks a row.
 */
export function servedTone(tone: string, label: string): Tone {
  return (SERVED_TONES as readonly string[]).includes(tone)
    ? (tone as Tone)
    : toneForLabel(label);
}
