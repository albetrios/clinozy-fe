import {
  BUG_REPORT_DESCRIPTION_MAX_LENGTH,
  type BugReportInputMethod,
} from '@/shared/api/bug-report-contracts.ts';
import type { SpeechRecognitionProblem } from '@/shared/hooks/useSpeechRecognition/index.ts';

import { BUG_REPORT_KEYS } from './bug-report.constants.ts';

const PROBLEM_KEYS: Record<SpeechRecognitionProblem, string> = {
  denied: BUG_REPORT_KEYS.voiceDenied,
  'no-speech': BUG_REPORT_KEYS.voiceNoSpeech,
  unavailable: BUG_REPORT_KEYS.voiceUnavailable,
};

/** `current` and a newly dictated phrase, one space between, capped at the backend's limit. */
export function appendPhrase(current: string, phrase: string): string {
  const head = current.trimEnd();
  const joined = head ? `${head} ${phrase}` : phrase;
  return joined.slice(0, BUG_REPORT_DESCRIPTION_MAX_LENGTH);
}

/** How the report was written: dictated only, typed only, or both. */
export function inputMethodOf({
  usedVoice,
  typed,
}: {
  usedVoice: boolean;
  typed: boolean;
}): BugReportInputMethod {
  if (usedVoice && typed) return 'mixed';
  return usedVoice ? 'voice' : 'typed';
}

/**
 * The line beside the voice button: a problem first (blocked microphone, silence, no service),
 * else "Hearing you…" / "Listening…" while listening, else nothing.
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
  return hearing ? BUG_REPORT_KEYS.voiceHearing : BUG_REPORT_KEYS.voiceListening;
}
