import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The voice button's namespace — the clinic shell's (`app` › `voice`), shared by Report a bug and
 * every drawer note field (feat-write-less-2026-10-14-oixr, D6).
 */
export const VOICE_INPUT_NS = I18N_NAMESPACES.app;

/** The voice button's names and its status line: listening, hearing, and why it stopped. */
export const VOICE_INPUT_KEYS = {
  start: 'voice.start',
  stop: 'voice.stop',
  listening: 'voice.listening',
  hearing: 'voice.hearing',
  denied: 'voice.denied',
  noSpeech: 'voice.noSpeech',
  unavailable: 'voice.unavailable',
} as const;

/** Bars in the voice-activity meter. */
export const VOICE_BAR_COUNT = 5;
