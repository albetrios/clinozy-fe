import { describe, expect, it } from 'vitest';

import { VOICE_INPUT_KEYS } from './voice-input.constants.ts';
import { voiceStatusKey } from './voice-status.ts';

describe('voiceStatusKey', () => {
  it('names a problem first, then hearing or listening, else nothing', () => {
    expect(voiceStatusKey({ problem: 'denied', listening: true, hearing: true })).toBe(
      VOICE_INPUT_KEYS.denied,
    );
    expect(
      voiceStatusKey({ problem: 'no-speech', listening: false, hearing: false }),
    ).toBe(VOICE_INPUT_KEYS.noSpeech);
    expect(
      voiceStatusKey({ problem: 'unavailable', listening: false, hearing: false }),
    ).toBe(VOICE_INPUT_KEYS.unavailable);
    expect(voiceStatusKey({ problem: null, listening: true, hearing: true })).toBe(
      VOICE_INPUT_KEYS.hearing,
    );
    expect(voiceStatusKey({ problem: null, listening: true, hearing: false })).toBe(
      VOICE_INPUT_KEYS.listening,
    );
    expect(
      voiceStatusKey({ problem: null, listening: false, hearing: false }),
    ).toBeNull();
  });
});
