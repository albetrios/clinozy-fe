import {
  BUG_REPORT_DESCRIPTION_MAX_LENGTH,
  type BugReportInputMethod,
} from '@/shared/api/bug-report-contracts.ts';
import { insertPhrase } from '@/shared/components/VoiceInputButton/index.ts';

/**
 * `current` and a newly dictated phrase, one space between (a capital where a sentence starts),
 * capped at the backend's limit — the shared {@link insertPhrase} at the end of the text.
 */
export function appendPhrase(current: string, phrase: string): string {
  return insertPhrase({
    value: current.trimEnd(),
    phrase,
    maxLength: BUG_REPORT_DESCRIPTION_MAX_LENGTH,
  }).value;
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
