import type { SpeechRecognitionProblem } from '@/shared/hooks/useSpeechRecognition/index.ts';

import { VOICE_INPUT_KEYS } from './voice-input.constants.ts';

const PROBLEM_KEYS: Record<SpeechRecognitionProblem, string> = {
  denied: VOICE_INPUT_KEYS.denied,
  'no-speech': VOICE_INPUT_KEYS.noSpeech,
  unavailable: VOICE_INPUT_KEYS.unavailable,
};

/**
 * The line beside or under the voice button: a problem first (blocked microphone, silence, no
 * service), else "Hearing you…" / "Listening…" while listening, else nothing.
 */
export function voiceStatusKey({
  problem,
  listening,
  hearing,
}: {
  problem: SpeechRecognitionProblem | null;
  listening: boolean;
  hearing: boolean;
}): string | null {
  if (problem) return PROBLEM_KEYS[problem];
  if (!listening) return null;
  return hearing ? VOICE_INPUT_KEYS.hearing : VOICE_INPUT_KEYS.listening;
}
