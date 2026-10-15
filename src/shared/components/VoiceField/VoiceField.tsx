import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { ShortcutKeys } from '@/lib/apple-platform.ts';
import { cn } from '@/lib/utils.ts';
import {
  VOICE_INPUT_KEYS,
  VOICE_INPUT_NS,
  VoiceInputButton,
  VoiceMeter,
  voiceStatusKey,
} from '@/shared/components/VoiceInputButton/index.ts';
import type { SpeechRecognitionState } from '@/shared/hooks/useSpeechRecognition/index.ts';

import type { VoiceFieldState } from './use-voice-field.ts';

/**
 * A single line's mic shows while the field is in use (focused) or listening — a line has no room
 * to spare for a glyph at rest — and takes no press while it is hidden.
 */
const LINE_MIC_REVEAL =
  'pointer-events-none opacity-0 transition-opacity group-focus-within/voice:pointer-events-auto group-focus-within/voice:opacity-100 group-data-[listening]/voice:pointer-events-auto group-data-[listening]/voice:opacity-100';

/**
 * Under a single line the status floats over what follows — rows and forms do not move — as a
 * popover surface, so the theme's elevation and shape apply to it.
 */
const LINE_STATUS_CLASS =
  'bg-popover text-popover-foreground pointer-events-none absolute start-0 top-full z-20 mt-1 max-w-full rounded-lg border px-2 py-1';

/** `<testId>-<part>`, or nothing for a field without a test id. */
const partId = (testId: string | undefined, part: string) =>
  testId ? `${testId}-${part}` : undefined;

/** The microphone: a note's at its bottom inline-end corner (clear of the resize grip), a line's at its end. */
function VoiceFieldMic({
  speech,
  multiline,
  keys,
  onToggle,
  testId,
}: {
  speech: SpeechRecognitionState;
  multiline: boolean;
  keys: ShortcutKeys;
  onToggle: () => void;
  testId: string | undefined;
}) {
  const { t } = useTranslation(VOICE_INPUT_NS);
  return (
    <VoiceInputButton
      size="sm"
      meter={false}
      keepFieldFocus
      shortcut={keys}
      listening={speech.listening}
      hearing={speech.hearing}
      label={t(speech.listening ? VOICE_INPUT_KEYS.stop : VOICE_INPUT_KEYS.start)}
      onToggle={onToggle}
      testId={partId(testId, 'voice')}
      className={
        multiline
          ? 'absolute end-4 bottom-1.5'
          : cn('absolute end-1 top-1/2 -translate-y-1/2', LINE_MIC_REVEAL)
      }
    />
  );
}

/** "Listening…" with its meter, a problem in red, or — before any words — what can be said. */
function VoiceFieldStatusLine({
  speech,
  testId,
}: {
  speech: SpeechRecognitionState;
  testId: string | undefined;
}) {
  const { t } = useTranslation(VOICE_INPUT_NS);
  const statusKey = voiceStatusKey(speech);
  const hint =
    speech.listening && !speech.hearing && !speech.problem && !speech.interim.trim();
  return (
    <p
      data-testid={partId(testId, 'voice-status')}
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-xs',
        speech.problem ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {speech.listening ? (
        <VoiceMeter hearing={speech.hearing} className="h-3 flex-none" />
      ) : null}
      <span className="min-w-0">
        {statusKey ? t(statusKey) : null}
        {hint ? (
          <span data-testid={partId(testId, 'voice-hint')}>
            {' · '}
            {t(VOICE_INPUT_KEYS.sayHint)}
          </span>
        ) : null}
      </span>
    </p>
  );
}

/**
 * The microphone's live words and status: under a note field, in its flow; under a line, floating
 * over what follows. Always mounted, the polite live region reads "Listening…" and a problem out.
 */
function VoiceFieldStatus({
  speech,
  multiline,
  testId,
}: {
  speech: SpeechRecognitionState;
  multiline: boolean;
  testId: string | undefined;
}) {
  const { t } = useTranslation(VOICE_INPUT_NS);
  const statusKey = voiceStatusKey(speech);
  const interim = speech.interim.trim();
  const shown = statusKey !== null || interim !== '';
  return (
    <>
      <span aria-live="polite" className="sr-only">
        {statusKey ? t(statusKey) : ''}
      </span>
      {shown ? (
        <div
          aria-hidden="true"
          data-slot={multiline ? undefined : 'popover-content'}
          className={cn(
            'flex min-w-0 flex-col gap-0.5',
            multiline ? 'ps-0.5' : LINE_STATUS_CLASS,
          )}
        >
          {interim ? (
            <p
              dir="auto"
              data-testid={partId(testId, 'interim')}
              className="voice-interim text-detail"
            >
              {interim}
            </p>
          ) : null}
          <VoiceFieldStatusLine speech={speech} testId={testId} />
        </div>
      ) : null}
    </>
  );
}

/** Props of {@link VoiceField}. */
export interface VoiceFieldProps {
  /** From {@link useVoiceField}, called by the field's owner. */
  voice: VoiceFieldState;
  /** The field: an `<input>` or a `<textarea>`, spread with `voice.fieldProps`. */
  children: ReactNode;
  /** Under a note field, after its status — its suggestion chips. */
  after?: ReactNode;
  /** The box's place in its row or grid (`min-w-0 flex-1`) — where the field itself had it. */
  className?: string;
}

/**
 * The common voice field: any text field — a drawer's note or line, a reason in a dialog — with a
 * small microphone in it (speak instead of typing), the live words and status under it, and
 * ⌘ / Ctrl ⇧ Space from inside it. `useVoiceField` is the engine; this draws it. Where the browser
 * has no speech recognition the field renders as it is, unboxed.
 */
export function VoiceField({ voice, children, after, className }: VoiceFieldProps) {
  const { attachBox, speech, ready, micShown, multiline, keys, toggle, testId } = voice;
  if (!(ready || after)) return children;
  const status = ready ? (
    <VoiceFieldStatus speech={speech} multiline={multiline} testId={testId} />
  ) : null;
  const box = (
    <div
      ref={attachBox}
      className={cn('group/voice relative min-w-0', multiline ? 'w-full' : className)}
      data-listening={speech.listening || undefined}
    >
      {children}
      {micShown ? (
        <VoiceFieldMic
          speech={speech}
          multiline={multiline}
          keys={keys}
          onToggle={toggle}
          testId={testId}
        />
      ) : null}
      {multiline ? null : status}
    </div>
  );
  if (!multiline) return box;
  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-1.5', className)}>
      {box}
      {status}
      {after}
    </div>
  );
}
