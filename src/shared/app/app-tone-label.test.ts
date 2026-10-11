import { describe, expect, it } from 'vitest';

import { TONE_VALUES } from '@/shared/api/app/app-schema.ts';

import { SERVED_TONES, servedTone, toneForLabel } from './app-tone-label.ts';

describe('SERVED_TONES', () => {
  it('is the contract’s tone enum, value for value', () => {
    expect([...SERVED_TONES]).toEqual([...TONE_VALUES]);
  });
});

describe('toneForLabel', () => {
  it('reproduces the design hash (H:3875) for labels the prototype draws', () => {
    expect(toneForLabel('Today')).toBe('mint');
    expect(toneForLabel('Coming up')).toBe('lav');
    expect(toneForLabel('View')).toBe('mint');
    expect(toneForLabel('Branches')).toBe('blush');
    expect(toneForLabel('Consultation')).toBe('butter');
  });

  it('ignores case and surrounding space, so a label keeps its colour', () => {
    expect(toneForLabel('  coming UP ')).toBe(toneForLabel('Coming up'));
  });

  it('only ever lands on the six hashed tones', () => {
    const tones = new Set(
      ['a', 'bb', 'ccc', 'Dr. Mavani', 'Riya Sharma', 'हिन्दी', '患者'].map(toneForLabel),
    );
    for (const tone of tones) {
      expect(['sky', 'sage', 'lav', 'butter', 'blush', 'mint']).toContain(tone);
    }
  });
});

describe('servedTone', () => {
  it('keeps a tone the palette has, and hashes the label for one it lacks', () => {
    expect(servedTone('plum', 'Marketing')).toBe('plum');
    expect(servedTone('teal', 'Marketing')).toBe(toneForLabel('Marketing'));
    expect(servedTone('', 'Ada')).toBe(toneForLabel('Ada'));
  });
});
