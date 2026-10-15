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
  /** What to say for a mark or to take words back, `|` between the ways to say it. */
  say: {
    period: 'voice.say.period',
    comma: 'voice.say.comma',
    question: 'voice.say.question',
    exclamation: 'voice.say.exclamation',
    colon: 'voice.say.colon',
    newLine: 'voice.say.newLine',
    newParagraph: 'voice.say.newParagraph',
    scratch: 'voice.say.scratch',
  },
  /** The mark each is written as, in the language's own script ("." / "。" / "।"). */
  marks: {
    period: 'voice.marks.period',
    comma: 'voice.marks.comma',
    question: 'voice.marks.question',
    exclamation: 'voice.marks.exclamation',
    colon: 'voice.marks.colon',
  },
  /** The line under a field while it listens: what can be said besides the words. */
  sayHint: 'voice.sayHint',
} as const;

/** Bars in the voice-activity meter. */
export const VOICE_BAR_COUNT = 5;
