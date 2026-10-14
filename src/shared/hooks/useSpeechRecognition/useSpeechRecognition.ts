import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The slice of the Web Speech API's `SpeechRecognition` this hook drives. TypeScript's DOM library
 * ships the event types but not the recognizer itself (Chrome, Edge and Safari expose it as
 * `webkitSpeechRecognition`; Firefox has none), so the shape is declared here.
 */
export interface NativeSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: NativeSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onsoundend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** One `result` event: the results list and where this event's new results begin. */
export interface NativeSpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type NativeSpeechRecognitionConstructor = new () => NativeSpeechRecognition;

/** Why listening stopped on its own: a refused microphone, silence, or no service. */
export type SpeechRecognitionProblem = 'denied' | 'no-speech' | 'unavailable';

/** Where the recognizer may live: `window` in a browser, a plain object in a test. */
type SpeechRecognitionScope = Partial<
  Record<'SpeechRecognition' | 'webkitSpeechRecognition', unknown>
>;

/** The browser's own recognizer, or `null` where there is none (Firefox, older browsers, jsdom). */
export function getSpeechRecognitionConstructor(
  scope: SpeechRecognitionScope = globalThis as SpeechRecognitionScope,
): NativeSpeechRecognitionConstructor | null {
  const candidate = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  return typeof candidate === 'function'
    ? (candidate as NativeSpeechRecognitionConstructor)
    : null;
}

/**
 * The recognition language for an app locale: the browser's own regional tag when it is the same
 * language (`en-IN` for `en` on an Indian English browser — accents matter to recognition),
 * otherwise the app locale as is.
 */
export function resolveSpeechLanguage({
  appLocale,
  browserLanguages,
}: {
  appLocale: string;
  browserLanguages: readonly string[];
}): string {
  const base = appLocale.toLowerCase().split('-')[0] ?? appLocale;
  const regional = browserLanguages.find(
    (tag) => tag.toLowerCase().split('-')[0] === base && tag.includes('-'),
  );
  return regional ?? appLocale;
}

function problemFor(errorCode: string): SpeechRecognitionProblem | null {
  if (errorCode === 'aborted') return null;
  if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') return 'denied';
  if (errorCode === 'no-speech') return 'no-speech';
  return 'unavailable';
}

/** What {@link useSpeechRecognition} hands back. */
export interface SpeechRecognitionState {
  /** The browser can recognize speech at all — show the voice button only then. */
  supported: boolean;
  listening: boolean;
  /** The browser hears speech right now (drives the voice-activity animation). */
  hearing: boolean;
  /** Words recognized but not yet final — shown live, softer, until they settle. */
  interim: string;
  problem: SpeechRecognitionProblem | null;
  start: () => void;
  /** Stop listening; interim words still pending are handed over as final. */
  stop: () => void;
  /** Stop listening and drop interim words — the caller has already taken them. */
  cancel: () => void;
}

/**
 * Speech-to-text with the browser's own `SpeechRecognition` — no library, no audio through us.
 *
 * Continuous with interim results: each FINAL phrase is handed to `onFinal` (the caller appends
 * it), interim words are exposed for a live preview, and `hearing` follows the browser's
 * speech/sound events. When recognition ends with words still interim (Chrome sometimes stops
 * before finalizing), they are handed over as final, so nothing said is lost.
 *
 * @param options.language - BCP 47 tag (see {@link resolveSpeechLanguage}).
 * @param options.onFinal - called with each settled phrase, trimmed.
 */
export function useSpeechRecognition({
  language,
  onFinal,
}: {
  language: string;
  onFinal: (text: string) => void;
}): SpeechRecognitionState {
  const [supported] = useState(() => getSpeechRecognitionConstructor() !== null);
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [interim, setInterim] = useState('');
  const [problem, setProblem] = useState<SpeechRecognitionProblem | null>(null);
  const recognitionRef = useRef<NativeSpeechRecognition | null>(null);
  const interimRef = useRef('');
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const updateInterim = useCallback((text: string) => {
    interimRef.current = text;
    setInterim(text);
  }, []);

  const handleEnd = useCallback(() => {
    const pending = interimRef.current.trim();
    if (pending) onFinalRef.current(pending);
    updateInterim('');
    recognitionRef.current = null;
    setListening(false);
    setHearing(false);
  }, [updateInterim]);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition || recognitionRef.current) return;
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let pending = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        const transcript = result[0].transcript;
        if (result.isFinal) {
          const settled = transcript.trim();
          if (settled) onFinalRef.current(settled);
        } else {
          pending += transcript;
        }
      }
      updateInterim(pending);
    };
    recognition.onspeechstart = () => setHearing(true);
    recognition.onspeechend = () => setHearing(false);
    recognition.onsoundend = () => setHearing(false);
    recognition.onerror = (event) => {
      const next = problemFor(event.error);
      if (next) setProblem(next);
    };
    recognition.onend = handleEnd;
    recognitionRef.current = recognition;
    setProblem(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      // `start()` throws when a recognizer is already running in this page.
      recognitionRef.current = null;
      setListening(false);
      setProblem('unavailable');
    }
  }, [handleEnd, language, updateInterim]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    updateInterim('');
    recognitionRef.current?.abort();
  }, [updateInterim]);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onend = null;
      recognition.onresult = null;
      recognition.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return { supported, listening, hearing, interim, problem, start, stop, cancel };
}
