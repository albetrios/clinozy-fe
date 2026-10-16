import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  VOICE_INPUT_KEYS,
  VOICE_INPUT_NS,
} from '@/shared/components/VoiceInputButton/index.ts';

import type { SpokenMarkWords, VoiceVocabulary } from './voice-commands.ts';

const PUNCTUATION = ['period', 'comma', 'question', 'exclamation', 'colon'] as const;

const LINE_BREAKS = [
  { mark: 'newLine', text: '\n' },
  { mark: 'newParagraph', text: '\n\n' },
] as const;

/** The ways to say one command, from its copy ("full stop|period"). */
function wordsOf(list: string): string[] {
  return list
    .split('|')
    .map((words) => words.trim())
    .filter(Boolean);
}

/**
 * The commands a voice field hears, in the app's language — the recognition language too: the marks
 * said as words ("full stop", "comma", "new line"), each written in the language's own script, and
 * the words that take a phrase back ("scratch that"). Copy in `app` › `voice.say` / `voice.marks`.
 */
export function useVoiceVocabulary(): VoiceVocabulary {
  const { t } = useTranslation(VOICE_INPUT_NS);
  return useMemo(() => {
    const punctuation: SpokenMarkWords[] = PUNCTUATION.map((mark) => ({
      mark,
      words: wordsOf(t(VOICE_INPUT_KEYS.say[mark])),
      text: t(VOICE_INPUT_KEYS.marks[mark]),
    }));
    const lineBreaks: SpokenMarkWords[] = LINE_BREAKS.map(({ mark, text }) => ({
      mark,
      words: wordsOf(t(VOICE_INPUT_KEYS.say[mark])),
      text,
    }));
    return {
      marks: [...punctuation, ...lineBreaks],
      scratch: wordsOf(t(VOICE_INPUT_KEYS.say.scratch)),
    };
  }, [t]);
}
