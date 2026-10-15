import { useCallback, useEffect, useRef } from 'react';

import type { ShortcutKeys } from '@/lib/apple-platform.ts';
import { insertPhrase } from '@/shared/components/VoiceInputButton/index.ts';
import {
  resolveSpeechLanguage,
  type SpeechRecognitionState,
  useSpeechRecognition,
} from '@/shared/hooks/useSpeechRecognition/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { useVoiceVocabulary } from './use-voice-vocabulary.ts';
import { readSpokenPhrase } from './voice-commands.ts';
import { isVoiceShortcut, voiceShortcutKeys } from './voice-shortcut.ts';

/** The one recognizer listening in the page: a field that starts stops the one before it. */
let stopListeningField: (() => void) | null = null;

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** The value setter React tracks, so a written value reaches `onChange` like typing does. */
function writeFieldValue(field: TextField, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    'value',
  )?.set;
  if (setter) setter.call(field, value);
  else field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Where a phrase goes: the selection once the field has been used, else the end of its text. */
function insertionRange(field: TextField, used: boolean) {
  const end = field.value.length;
  if (!used) return { start: end, end };
  return { start: field.selectionStart ?? end, end: field.selectionEnd ?? end };
}

/** The field's end padding, clear of the microphone: 40px for a note's corner mic, 32px for a line's. */
function micPadding({ micShown, multiline }: { micShown: boolean; multiline: boolean }) {
  if (!micShown) return undefined;
  return multiline ? 'pe-10' : 'pe-8';
}

/** One phrase written in: the text before and after, and where it began — for "scratch that". */
interface WrittenPhrase {
  before: string;
  after: string;
  caret: number;
}

/** Options of {@link useVoiceField}. */
export interface VoiceFieldOptions {
  /** Offer the microphone at all (it shows only where the browser recognises speech). */
  enabled?: boolean;
  /** A field of several lines: "new line" breaks the line; a single line has none. */
  multiline: boolean;
  /** Read-only or disabled now: no microphone, no shortcut. */
  blocked?: boolean;
  /** Take each settled phrase instead of writing it into the field (a chip input adds chips). */
  onPhrase?: (text: string) => void;
  /** The field's test id: the mic is `<testId>-voice`, its lines `-voice-status` and `-interim`. */
  testId?: string;
}

/** What {@link useVoiceField} hands to {@link VoiceField} and to the field it wraps. */
export interface VoiceFieldState {
  speech: SpeechRecognitionState;
  /** Offered where the browser recognises speech: the field is boxed (stable for the page). */
  ready: boolean;
  /** The microphone shows: ready, and the field takes input. */
  micShown: boolean;
  multiline: boolean;
  testId: string | undefined;
  /** The keys that toggle the microphone from the field. */
  keys: ShortcutKeys;
  /**
   * The box around the field (a callback ref): the field is found in it, and it hears the field's
   * focus and the shortcut — so the field's own `ref`, `onFocus` and `onKeyDown` stay the caller's.
   */
  attachBox: (box: HTMLDivElement | null) => (() => void) | undefined;
  /** Spread on the field: it names its shortcut (`aria-keyshortcuts`). */
  fieldProps: { 'aria-keyshortcuts'?: string };
  /** The field's end padding, clear of the microphone — last in its class list. */
  paddingClass: string | undefined;
  /** Write words at the caret (a note field's suggestion chip uses it too). */
  write: (text: string) => void;
  toggle: () => void;
}

/**
 * Speech for one text field — the common engine behind every microphone in a field: the browser's
 * recognizer in the app's language (one listening per page — a field that starts stops the other),
 * each settled phrase read for its spoken commands (marks, "new line", "scratch that") and written
 * where the caret is (the end, before the field is used) through the field's own `onChange`, so
 * `register()` and controlled fields both see it; ⌘ / Ctrl ⇧ Space in the field starts and stops
 * it. The field is found inside the box ({@link VoiceField}), so its own `ref` stays the caller's.
 *
 * @param options - See {@link VoiceFieldOptions}.
 * @returns The state {@link VoiceField} draws and the props the field takes.
 */
export function useVoiceField({
  enabled = true,
  multiline,
  blocked = false,
  onPhrase,
  testId,
}: VoiceFieldOptions): VoiceFieldState {
  const locale = useLocaleStore((state) => state.locale);
  const vocabulary = useVoiceVocabulary();
  const boxNodeRef = useRef<HTMLDivElement | null>(null);
  const usedRef = useRef(false);
  const shortcutRef = useRef<() => void>(() => {});
  const writtenRef = useRef<WrittenPhrase[]>([]);
  const onPhraseRef = useRef(onPhrase);

  useEffect(() => {
    onPhraseRef.current = onPhrase;
  }, [onPhrase]);

  const fieldOf = useCallback(
    () => boxNodeRef.current?.querySelector<TextField>('textarea, input') ?? null,
    [],
  );

  const write = useCallback(
    (phrase: string) => {
      const field = fieldOf();
      if (!field) return;
      const { start, end } = insertionRange(field, usedRef.current);
      const before = field.value;
      const next = insertPhrase({
        value: before,
        phrase,
        start,
        end,
        maxLength: field.maxLength > 0 ? field.maxLength : undefined,
      });
      if (next.value === before) return;
      writeFieldValue(field, next.value);
      field.setSelectionRange(next.caret, next.caret);
      writtenRef.current.push({ before, after: next.value, caret: start });
      usedRef.current = true;
    },
    [fieldOf],
  );

  /** "Scratch that": the last phrase written comes out — unless the text changed since. */
  const takeBack = useCallback(() => {
    const field = fieldOf();
    const last = writtenRef.current.pop();
    if (!(field && last) || field.value !== last.after) {
      writtenRef.current = [];
      return;
    }
    writeFieldValue(field, last.before);
    const caret = Math.min(last.caret, last.before.length);
    field.setSelectionRange(caret, caret);
  }, [fieldOf]);

  const hear = useCallback(
    (phrase: string) => {
      const spoken = readSpokenPhrase({ phrase, vocabulary, multiline });
      if (onPhraseRef.current) {
        if (spoken.text) onPhraseRef.current(spoken.text);
        return;
      }
      for (let count = 0; count < spoken.undo; count += 1) takeBack();
      if (spoken.text) write(spoken.text);
    },
    [vocabulary, multiline, takeBack, write],
  );

  const speech = useSpeechRecognition({
    language: resolveSpeechLanguage({
      appLocale: locale,
      browserLanguages: globalThis.navigator?.languages ?? [],
    }),
    onFinal: hear,
  });
  const ready = enabled && speech.supported;
  const micShown = ready && !blocked;
  const keys = voiceShortcutKeys();

  const toggle = () => {
    if (speech.listening) {
      speech.stop();
      if (stopListeningField === speech.stop) stopListeningField = null;
      return;
    }
    if (stopListeningField && stopListeningField !== speech.stop) stopListeningField();
    stopListeningField = speech.stop;
    writtenRef.current = [];
    speech.start();
  };

  useEffect(() => {
    shortcutRef.current = micShown ? toggle : () => {};
  });

  const attachBox = useCallback((box: HTMLDivElement | null) => {
    boxNodeRef.current = box;
    if (!box) return undefined;
    const onFocusIn = () => {
      usedRef.current = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isVoiceShortcut(event)) return;
      event.preventDefault();
      shortcutRef.current();
    };
    box.addEventListener('focusin', onFocusIn);
    box.addEventListener('keydown', onKeyDown);
    return () => {
      boxNodeRef.current = null;
      box.removeEventListener('focusin', onFocusIn);
      box.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return {
    speech,
    ready,
    micShown,
    multiline,
    testId,
    keys,
    attachBox,
    fieldProps: micShown ? { 'aria-keyshortcuts': keys.aria } : {},
    paddingClass: micPadding({ micShown, multiline }),
    write,
    toggle,
  };
}
