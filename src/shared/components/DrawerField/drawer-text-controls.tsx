import { type ComponentProps, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { Input } from '@/shared/components/ui/input.tsx';
import { Textarea } from '@/shared/components/ui/textarea.tsx';
import {
  insertPhrase,
  VOICE_INPUT_KEYS,
  VOICE_INPUT_NS,
  VoiceInputButton,
  VoiceMeter,
  voiceStatusKey,
} from '@/shared/components/VoiceInputButton/index.ts';
import {
  resolveSpeechLanguage,
  useSpeechRecognition,
} from '@/shared/hooks/useSpeechRecognition/index.ts';
import { Zap } from '@/shared/icons/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { autoCapitalizeFirstLetter } from './auto-capitalize.ts';
import { DRAWER_INPUT_CLASS, DRAWER_TEXTAREA_CLASS } from './drawer-field-controls.ts';

/** Props for {@link DrawerInput}. */
export interface DrawerInputProps extends ComponentProps<'input'> {
  /**
   * Capitalise the first letter as typed (H:4515–4521). `false` for a value
   * that is not prose in any language — a handle, a code, an id.
   */
  capitalize?: boolean;
}

/**
 * A drawer's text input: 36px, `rounded-lg`, 13.5px, and the first letter of a
 * name capitalised as it is typed — not a phone, an email or a number (pass
 * the matching `type` or `inputMode`), nor a value starting with "@". Takes
 * `react-hook-form`'s `register()` like the input it wraps.
 */
export function DrawerInput({
  capitalize = true,
  className,
  onChange,
  ...props
}: DrawerInputProps) {
  return (
    <Input
      {...props}
      className={cn(DRAWER_INPUT_CLASS, className)}
      onChange={(event) => {
        if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
        onChange?.(event);
      }}
    />
  );
}

/** A chip under a note field that writes its text into it (the check-in's last plan). */
export interface DrawerTextSuggestion {
  /** Stable id — the chip's test-id suffix. */
  id: string;
  /** The chip's words ("Same plan as last time"). */
  label: string;
  /** What it writes into the field. */
  text: string;
}

/** Props for {@link DrawerTextarea}. */
export interface DrawerTextareaProps extends ComponentProps<'textarea'> {
  /** Capitalise the first letter as typed; a message's own field opts out by its label. */
  capitalize?: boolean;
  /**
   * The microphone in the field's corner — speak instead of typing (on by default; it shows only
   * where the browser recognises speech, and never on a read-only or disabled field).
   */
  dictation?: boolean;
  /** Chips under the field that write a text into it; a chip hides once it has been used. */
  suggestions?: readonly DrawerTextSuggestion[];
}

/** The one recognizer listening in the page: a field that starts stops the one before it. */
let stopListeningField: (() => void) | null = null;

/** The value setter React tracks, so a written value reaches `onChange` like typing does. */
function writeFieldValue(field: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Where a phrase goes: the selection once the field has been used, else the end of its text. */
function insertionRange(field: HTMLTextAreaElement, used: boolean) {
  if (!used) return { start: field.value.length, end: field.value.length };
  return { start: field.selectionStart, end: field.selectionEnd };
}

/** A sentence written into the field through `onChange`, with the caret after it. */
function useWritePhrase(
  boxRef: { current: HTMLDivElement | null },
  usedRef: { current: boolean },
) {
  return useCallback(
    (phrase: string) => {
      const field = boxRef.current?.querySelector('textarea');
      if (!field) return;
      const { start, end } = insertionRange(field, usedRef.current);
      const limit = field.maxLength > 0 ? field.maxLength : undefined;
      const next = insertPhrase({
        value: field.value,
        phrase,
        start,
        end,
        maxLength: limit,
      });
      writeFieldValue(field, next.value);
      field.setSelectionRange(next.caret, next.caret);
      usedRef.current = true;
    },
    [boxRef, usedRef],
  );
}

/** The microphone's live words and status under the field, while listening or after a problem. */
function DictationStatus({
  speech,
  testId,
}: {
  speech: ReturnType<typeof useSpeechRecognition>;
  testId: string | undefined;
}) {
  const { t } = useTranslation(VOICE_INPUT_NS);
  const statusKey = voiceStatusKey(speech);
  const status = statusKey ? t(statusKey) : '';
  const interim = speech.interim.trim();
  return (
    <>
      {/* Always mounted, so screen readers hear "Listening…" and a problem as they change. */}
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
      {statusKey || interim ? (
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-0.5 ps-0.5">
          {interim ? (
            <p
              dir="auto"
              data-testid={testId ? `${testId}-interim` : undefined}
              className="voice-interim text-detail"
            >
              {interim}
            </p>
          ) : null}
          <p
            data-testid={testId ? `${testId}-voice-status` : undefined}
            className={cn(
              'flex min-w-0 items-center gap-1.5 text-xs',
              speech.problem ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {speech.listening ? (
              <VoiceMeter hearing={speech.hearing} className="h-3" />
            ) : null}
            <span className="min-w-0">{status}</span>
          </p>
        </div>
      ) : null}
    </>
  );
}

/**
 * The microphone and its writer for one note field: the recognizer, the box around the field
 * (phrases find the textarea in it — the field's own `ref` stays the caller's) and the toggle.
 */
function useFieldDictation() {
  const locale = useLocaleStore((state) => state.locale);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const usedRef = useRef(false);
  const writePhrase = useWritePhrase(boxRef, usedRef);
  const speech = useSpeechRecognition({
    language: resolveSpeechLanguage({
      appLocale: locale,
      browserLanguages: globalThis.navigator?.languages ?? [],
    }),
    onFinal: writePhrase,
  });
  const toggle = () => {
    if (speech.listening) {
      speech.stop();
      if (stopListeningField === speech.stop) stopListeningField = null;
      return;
    }
    if (stopListeningField && stopListeningField !== speech.stop) stopListeningField();
    stopListeningField = speech.stop;
    speech.start();
  };
  /** The field has been focused: phrases go to its caret from now on. */
  const markUsed = () => {
    usedRef.current = true;
  };
  return { speech, boxRef, writePhrase, toggle, markUsed };
}

/** The 28px microphone in the field's bottom inline-end corner, clear of the resize grip. */
function DictationButton({
  speech,
  onToggle,
  testId,
}: {
  speech: ReturnType<typeof useSpeechRecognition>;
  onToggle: () => void;
  testId: string | undefined;
}) {
  const { t } = useTranslation(VOICE_INPUT_NS);
  return (
    <VoiceInputButton
      size="sm"
      meter={false}
      listening={speech.listening}
      hearing={speech.hearing}
      label={t(speech.listening ? VOICE_INPUT_KEYS.stop : VOICE_INPUT_KEYS.start)}
      onToggle={onToggle}
      testId={testId ? `${testId}-voice` : undefined}
      className="absolute end-4 bottom-1.5"
    />
  );
}

/** The suggestion chips under a note field; each hides once it has written its text. */
function TextSuggestionChips({
  suggestions,
  onPick,
  testId,
}: {
  suggestions: readonly DrawerTextSuggestion[];
  onPick: (text: string) => void;
  testId: string | undefined;
}) {
  const [used, setUsed] = useState<ReadonlySet<string>>(() => new Set());
  const offered = suggestions.filter(
    (suggestion) => suggestion.text.trim() && !used.has(suggestion.id),
  );
  if (offered.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {offered.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          title={suggestion.text}
          data-testid={testId ? `${testId}-suggestion-${suggestion.id}` : undefined}
          onClick={() => {
            onPick(suggestion.text);
            setUsed((current) => new Set(current).add(suggestion.id));
          }}
          data-slot="pill"
          className="text-foreground hover:bg-muted bg-background inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-medium transition-colors"
        >
          <Zap aria-hidden="true" className="size-3 flex-none" />
          <span className="truncate">{suggestion.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A drawer's textarea (9px 10px, 13.5px / 1.45, vertical resize) with the same
 * first-letter capitalisation as {@link DrawerInput} — a message box is left alone.
 *
 * Every note field also takes speech (feat-write-less-2026-10-14-oixr): a 28px microphone in its
 * bottom inline-end corner — Report a bug's orb — where the browser recognises speech; each settled
 * phrase is written where the caret is (the end, before the field is used), spaced and capitalised,
 * within `maxLength`, through the field's own `onChange` (so `register()` and controlled fields both
 * see it). The live words and "Listening…" show under the field. `suggestions` add chips under it
 * that write their text the same way.
 */
export function DrawerTextarea({
  capitalize = true,
  dictation = true,
  suggestions,
  className,
  onChange,
  onFocus,
  ...props
}: DrawerTextareaProps) {
  const { speech, boxRef, writePhrase, toggle, markUsed } = useFieldDictation();
  const dictationReady = dictation && speech.supported;
  // The wrapper depends on props alone, so the field never remounts while it is in use.
  const wrapped = dictationReady || Boolean(suggestions?.length);
  const voice = dictationReady && !props.disabled && !props.readOnly;
  const testId = (props as { 'data-testid'?: string })['data-testid'];

  const textarea = (
    <Textarea
      {...props}
      className={cn(DRAWER_TEXTAREA_CLASS, voice && 'pe-12', className)}
      onFocus={(event) => {
        markUsed();
        onFocus?.(event);
      }}
      onChange={(event) => {
        if (capitalize) autoCapitalizeFirstLetter(event.currentTarget);
        onChange?.(event);
      }}
    />
  );

  if (!wrapped) return textarea;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <div
        ref={boxRef}
        className="relative w-full min-w-0"
        data-listening={speech.listening || undefined}
      >
        {textarea}
        {voice ? (
          <DictationButton speech={speech} onToggle={toggle} testId={testId} />
        ) : null}
      </div>
      <DictationStatus speech={speech} testId={testId} />
      {suggestions?.length ? (
        <TextSuggestionChips
          suggestions={suggestions}
          onPick={writePhrase}
          testId={testId}
        />
      ) : null}
    </div>
  );
}
