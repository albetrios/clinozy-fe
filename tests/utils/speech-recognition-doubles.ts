/**
 * A stand-in for the browser's `SpeechRecognition` in component tests: it records its settings,
 * `stop()` and `abort()` end the session as the browser does (`onend`), and the test speaks
 * through {@link FakeSpeechRecognition.say}. Install it with `installFakeSpeechRecognition()`
 * (the `webkitSpeechRecognition` Chrome exposes) and read the live one with
 * `lastSpeechRecognition()`; `vi.unstubAllGlobals()` removes it.
 */
import { vi } from 'vitest';

import type { NativeSpeechRecognition } from '@/shared/hooks/useSpeechRecognition/useSpeechRecognition.ts';

/** The recognizers constructed since the last install; the latest is {@link lastSpeechRecognition}. */
const constructed: FakeSpeechRecognition[] = [];

/** The fake recognizer; each one constructed is recorded for {@link lastSpeechRecognition}. */
export class FakeSpeechRecognition implements NativeSpeechRecognition {
  lang = '';
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onresult: NativeSpeechRecognition['onresult'] = null;
  onerror: NativeSpeechRecognition['onerror'] = null;
  onend: NativeSpeechRecognition['onend'] = null;
  onspeechstart: NativeSpeechRecognition['onspeechstart'] = null;
  onspeechend: NativeSpeechRecognition['onspeechend'] = null;
  onsoundend: NativeSpeechRecognition['onsoundend'] = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());
  constructor() {
    constructed.push(this);
  }
  /** The browser recognised `transcript` — settled when `isFinal`, still interim otherwise. */
  say(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript } }] });
  }
  /** The browser gave up — `not-allowed`, `no-speech`, `network`… */
  fail(error: string) {
    this.onerror?.({ error });
  }
}

/** Make the browser offer speech recognition (as Chrome does, prefixed). */
export function installFakeSpeechRecognition(): void {
  constructed.length = 0;
  vi.stubGlobal('webkitSpeechRecognition', FakeSpeechRecognition);
}

/** The recognizer the component started last, or `null` before any. */
export function lastSpeechRecognition(): FakeSpeechRecognition | null {
  return constructed.at(-1) ?? null;
}
