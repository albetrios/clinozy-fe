import { describe, expect, it } from 'vitest';

import { TONE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import { PICKER_TONE_CLASSES, toneForLabel } from './picker-tone.ts';

describe('toneForLabel', () => {
  it('reproduces the design hash (H:3875) for labels the prototype draws', () => {
    expect(toneForLabel('Today')).toBe('mint');
    expect(toneForLabel('Coming up')).toBe('lav');
    expect(toneForLabel('View')).toBe('mint');
    expect(toneForLabel('Branches')).toBe('blush');
    expect(toneForLabel('Consultation')).toBe('butter');
  });

  it('ignores case and surrounding space, so an option keeps its colour', () => {
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

describe('PICKER_TONE_CLASSES', () => {
  it('covers every contract tone with literal, tone-named utilities', () => {
    expect(Object.keys(PICKER_TONE_CLASSES).sort()).toEqual([...TONE_VALUES].sort());
    for (const tone of TONE_VALUES) {
      const classes = PICKER_TONE_CLASSES[tone];
      expect(classes.dot).toBe(`bg-tone-${tone}-dot`);
      expect(classes.halo).toBe(`ring-tone-${tone}-dot/18`);
      expect(classes.active).toBe(`data-[selected=true]:bg-tone-${tone}/55`);
      expect(classes.picked).toBe(`bg-tone-${tone}/70`);
      expect(classes.soft).toBe(`bg-tone-${tone} text-tone-${tone}-foreground`);
    }
  });
});
