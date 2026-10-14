import { describe, expect, it } from 'vitest';

import { BUG_REPORT_KEYS } from './bug-report.constants.ts';
import { appendPhrase, inputMethodOf, voiceStatusKey } from './bug-report-text.ts';

describe('bug-report-text', () => {
  it('joins a dictated phrase with one space and caps the length', () => {
    expect(appendPhrase('', 'It froze')).toBe('It froze');
    expect(appendPhrase('The total  ', 'is wrong')).toBe('The total is wrong');
    expect(appendPhrase('a'.repeat(4999), 'bc')).toHaveLength(5000);
  });

  it('names how the report was written', () => {
    expect(inputMethodOf({ usedVoice: false, typed: true })).toBe('typed');
    expect(inputMethodOf({ usedVoice: false, typed: false })).toBe('typed');
    expect(inputMethodOf({ usedVoice: true, typed: false })).toBe('voice');
    expect(inputMethodOf({ usedVoice: true, typed: true })).toBe('mixed');
  });

  it('puts a problem first, then the listening state, else nothing', () => {
    expect(voiceStatusKey({ problem: 'denied', listening: true, hearing: true })).toBe(
      BUG_REPORT_KEYS.voiceDenied,
    );
    expect(
      voiceStatusKey({ problem: 'no-speech', listening: false, hearing: false }),
    ).toBe(BUG_REPORT_KEYS.voiceNoSpeech);
    expect(
      voiceStatusKey({ problem: 'unavailable', listening: false, hearing: false }),
    ).toBe(BUG_REPORT_KEYS.voiceUnavailable);
    expect(voiceStatusKey({ problem: null, listening: true, hearing: true })).toBe(
      BUG_REPORT_KEYS.voiceHearing,
    );
    expect(voiceStatusKey({ problem: null, listening: true, hearing: false })).toBe(
      BUG_REPORT_KEYS.voiceListening,
    );
    expect(
      voiceStatusKey({ problem: null, listening: false, hearing: false }),
    ).toBeNull();
  });
});
