import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getSpeechRecognitionConstructor,
  type NativeSpeechRecognition,
  type NativeSpeechRecognitionEvent,
  resolveSpeechLanguage,
  useSpeechRecognition,
} from './useSpeechRecognition.ts';

/** A stand-in for the browser's recognizer: records its settings and lets the test drive events. */
class FakeRecognition implements NativeSpeechRecognition {
  static readonly instances: FakeRecognition[] = [];
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
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

function resultEvent(
  results: Array<{ transcript: string; isFinal: boolean }>,
  resultIndex = 0,
): NativeSpeechRecognitionEvent {
  return {
    resultIndex,
    results: results.map((result) => ({
      isFinal: result.isFinal,
      0: { transcript: result.transcript },
    })),
  };
}

function installRecognizer(name: 'SpeechRecognition' | 'webkitSpeechRecognition') {
  FakeRecognition.instances.length = 0;
  vi.stubGlobal(name, FakeRecognition);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSpeechRecognitionConstructor', () => {
  it('finds the standard or the webkit-prefixed recognizer, or none', () => {
    expect(getSpeechRecognitionConstructor({ SpeechRecognition: FakeRecognition })).toBe(
      FakeRecognition,
    );
    expect(
      getSpeechRecognitionConstructor({ webkitSpeechRecognition: FakeRecognition }),
    ).toBe(FakeRecognition);
    expect(getSpeechRecognitionConstructor({})).toBeNull();
  });
});

describe('resolveSpeechLanguage', () => {
  it('prefers the browser regional tag of the same language', () => {
    expect(
      resolveSpeechLanguage({ appLocale: 'en', browserLanguages: ['en-IN', 'hi-IN'] }),
    ).toBe('en-IN');
    expect(
      resolveSpeechLanguage({ appLocale: 'hi', browserLanguages: ['en-IN', 'hi-IN'] }),
    ).toBe('hi-IN');
  });

  it('falls back to the app locale', () => {
    expect(resolveSpeechLanguage({ appLocale: 'de', browserLanguages: ['en-US'] })).toBe(
      'de',
    );
    expect(resolveSpeechLanguage({ appLocale: 'fr', browserLanguages: ['fr'] })).toBe(
      'fr',
    );
  });
});

describe('useSpeechRecognition', () => {
  it('is unsupported where the browser has no recognizer, and start does nothing', () => {
    const onFinal = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal }),
    );
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
  });

  it('listens continuously with interim results in the given language', () => {
    installRecognizer('webkitSpeechRecognition');
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en-IN', onFinal: vi.fn() }),
    );
    expect(result.current.supported).toBe(true);

    act(() => result.current.start());

    const recognition = FakeRecognition.instances[0]!;
    expect(recognition).toMatchObject({
      lang: 'en-IN',
      continuous: true,
      interimResults: true,
    });
    expect(recognition.start).toHaveBeenCalledOnce();
    expect(result.current.listening).toBe(true);
  });

  it('hands final phrases over and shows interim words live', () => {
    installRecognizer('SpeechRecognition');
    const onFinal = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;

    act(() =>
      recognition.onresult?.(
        resultEvent([
          { transcript: ' The total ', isFinal: true },
          { transcript: 'does not upd', isFinal: false },
        ]),
      ),
    );

    expect(onFinal).toHaveBeenCalledWith('The total');
    expect(result.current.interim).toBe('does not upd');
  });

  it('follows the voice activity for the animation', () => {
    installRecognizer('SpeechRecognition');
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal: vi.fn() }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;

    act(() => recognition.onspeechstart?.());
    expect(result.current.hearing).toBe(true);
    act(() => recognition.onsoundend?.());
    expect(result.current.hearing).toBe(false);
  });

  it('keeps interim words when recognition ends before finalizing them', () => {
    installRecognizer('SpeechRecognition');
    const onFinal = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    act(() =>
      recognition.onresult?.(resultEvent([{ transcript: 'it froze', isFinal: false }])),
    );

    act(() => result.current.stop());

    expect(onFinal).toHaveBeenCalledWith('it froze');
    expect(result.current.listening).toBe(false);
    expect(result.current.interim).toBe('');
  });

  it('cancel drops interim words the caller already took', () => {
    installRecognizer('SpeechRecognition');
    const onFinal = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;
    recognition.abort.mockImplementation(() => recognition.onend?.());
    act(() =>
      recognition.onresult?.(resultEvent([{ transcript: 'it froze', isFinal: false }])),
    );

    act(() => result.current.cancel());

    expect(recognition.abort).toHaveBeenCalledOnce();
    expect(onFinal).not.toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('names a refused microphone and ignores an abort', () => {
    installRecognizer('SpeechRecognition');
    const { result } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal: vi.fn() }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;

    act(() => recognition.onerror?.({ error: 'aborted' }));
    expect(result.current.problem).toBeNull();
    act(() => recognition.onerror?.({ error: 'not-allowed' }));
    expect(result.current.problem).toBe('denied');
    act(() => recognition.onerror?.({ error: 'no-speech' }));
    expect(result.current.problem).toBe('no-speech');
    act(() => recognition.onerror?.({ error: 'network' }));
    expect(result.current.problem).toBe('unavailable');
  });

  it('aborts a running recognizer when the panel unmounts', () => {
    installRecognizer('SpeechRecognition');
    const { result, unmount } = renderHook(() =>
      useSpeechRecognition({ language: 'en', onFinal: vi.fn() }),
    );
    act(() => result.current.start());
    const recognition = FakeRecognition.instances[0]!;

    unmount();

    expect(recognition.abort).toHaveBeenCalledOnce();
  });
});
