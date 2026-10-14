import './voice-input.css';

import { cn } from '@/lib/utils.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Mic } from '@/shared/icons/index.ts';

import { VOICE_BAR_COUNT } from './voice-input.constants.ts';

const BAR_INDEXES = Array.from({ length: VOICE_BAR_COUNT }, (_value, index) => index);

/**
 * The voice-activity meter: five bars that breathe in silence and jump while the browser hears
 * speech (`voice-input.css`). Decorative — the caller says "Listening…" in words.
 */
export function VoiceMeter({
  hearing,
  className,
}: {
  hearing: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('voice-bars flex h-5 items-center gap-0.5', className)}
      data-hearing={hearing || undefined}
    >
      {BAR_INDEXES.map((index) => (
        <span key={index} className="h-full w-0.5 rounded-xs" />
      ))}
    </span>
  );
}

/** Props of {@link VoiceInputButton}. */
export interface VoiceInputButtonProps {
  listening: boolean;
  hearing: boolean;
  /** "Dictate with your voice" at rest, "Stop dictating" while listening. */
  label: string;
  onToggle: () => void;
  disabled?: boolean;
  /** `md` — Report a bug's 36px orb; `sm` — a drawer note field's 28px corner button. */
  size?: 'md' | 'sm';
  /** The meter beside the orb while listening (Report a bug); a field shows its own on the status line. */
  meter?: boolean;
  testId?: string;
  className?: string;
}

/**
 * The voice button: a quiet mic at rest; while listening, a glowing orb with two ripple rings and,
 * beside it by default, the five-bar {@link VoiceMeter} (`voice-input.css`). Purely presentational —
 * `useSpeechRecognition` owns the state. Report a bug and every drawer note field (`DrawerTextarea`)
 * draw the same one.
 */
export function VoiceInputButton({
  listening,
  hearing,
  label,
  onToggle,
  disabled = false,
  size = 'md',
  meter = true,
  testId,
  className,
}: VoiceInputButtonProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant="ghost"
        size={size === 'sm' ? 'icon-sm' : 'icon'}
        data-slot="pill"
        className={cn(
          'voice-orb text-muted-foreground hover:text-foreground relative rounded-full',
          size === 'sm' && 'size-7 [&_svg]:size-3.5',
        )}
        data-testid={testId}
        data-listening={listening || undefined}
        aria-pressed={listening}
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onToggle}
      >
        <Mic aria-hidden="true" />
      </Button>
      {listening && meter ? <VoiceMeter hearing={hearing} /> : null}
    </div>
  );
}
