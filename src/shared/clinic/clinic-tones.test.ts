import { describe, expect, it } from 'vitest';

import {
  ROLE_VALUES,
  SECTION_VALUES,
  TONE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';

import { ROLE_TONES, SECTION_TONES, TONE_CLASSES, toneForLabel } from './clinic-tones.ts';

describe('clinic tones', () => {
  it('gives every section its own tone', () => {
    const tones = SECTION_VALUES.map((section) => SECTION_TONES[section]);
    expect(new Set(tones).size).toBe(SECTION_VALUES.length);
    expect(tones).not.toContain('stone');
  });

  it('gives every role a tone', () => {
    for (const role of ROLE_VALUES) expect(TONE_VALUES).toContain(ROLE_TONES[role]);
  });

  it('spells every class as a literal for its own tone', () => {
    for (const tone of TONE_VALUES) {
      for (const value of Object.values(TONE_CLASSES[tone])) {
        expect(value).toContain(`tone-${tone}`);
        expect(value).not.toContain('${');
      }
    }
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

describe('list-row states', () => {
  it('tints the active row at 55% and a picked row at 70%', () => {
    for (const tone of TONE_VALUES) {
      expect(TONE_CLASSES[tone].active).toBe(`data-[selected=true]:bg-tone-${tone}/55`);
      expect(TONE_CLASSES[tone].picked).toBe(`bg-tone-${tone}/70`);
    }
  });
});
