import { Button } from '@/shared/components/ui/button.tsx';
import { Mic } from '@/shared/icons/index.ts';

import {
  BUG_REPORT_TEST_IDS,
  BUG_REPORT_VOICE_BAR_COUNT,
} from '../bug-report.constants.ts';

const BAR_INDEXES = Array.from(
  { length: BUG_REPORT_VOICE_BAR_COUNT },
  (_value, index) => index,
);

/**
 * The voice button: a quiet mic at rest; while listening, a glowing orb with two ripple rings
 * and, beside it, a five-bar meter that jumps while the browser hears speech and breathes in silence
 * (`index.css` › Report a bug). Purely presentational — `useSpeechRecognition` owns the state.
 */
export function VoiceInputButton({
  listening,
  hearing,
  label,
  onToggle,
  disabled = false,
}: {
  listening: boolean;
  hearing: boolean;
  /** "Dictate with your voice" at rest, "Stop dictating" while listening. */
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-slot="pill"
        className="bug-report-orb bug-report-press text-muted-foreground hover:text-foreground relative rounded-full"
        data-testid={BUG_REPORT_TEST_IDS.voice}
        data-listening={listening || undefined}
        aria-pressed={listening}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onToggle}
      >
        <Mic aria-hidden="true" />
      </Button>
      {listening ? (
        <span
          aria-hidden="true"
          className="bug-report-bars flex h-5 items-center gap-0.5"
          data-hearing={hearing || undefined}
        >
          {BAR_INDEXES.map((index) => (
            <span key={index} className="h-full w-0.5 rounded-xs" />
          ))}
        </span>
      ) : null}
    </div>
  );
}
