import type { Tone } from '@/shared/api/app/app-schema.ts';

/**
 * The two other tones each tone's art scatters as dots beside its own, so every
 * illustration carries three colours (change-empty-states, `preset.md` › Tones).
 */
export const EMPTY_STATE_ART_ACCENTS: Readonly<Record<Tone, readonly [Tone, Tone]>> = {
  butter: ['peach', 'sky'],
  lav: ['plum', 'sky'],
  sky: ['mint', 'lav'],
  sage: ['lime', 'sky'],
  blush: ['peach', 'lav'],
  mint: ['sky', 'lime'],
  peach: ['butter', 'blush'],
  plum: ['lav', 'blush'],
  lime: ['sage', 'butter'],
  slate: ['sky', 'lav'],
  stone: ['sky', 'peach'],
};
