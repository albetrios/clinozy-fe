import { describe, expect, it } from 'vitest';

import {
  ROLE_VALUES,
  SECTION_VALUES,
  TONE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';

import {
  APPOINTMENT_STATUS_TONES,
  GENDER_TONES,
  PATIENT_CONVERSION_TONES,
  PATIENT_STATUS_TONES,
  PATIENT_TYPE_TONES,
  ROLE_TONES,
  SECTION_TONES,
  TONE_CLASSES,
  toneForLabel,
} from './clinic-tones.ts';

describe('clinic tones', () => {
  it('gives every section its own tone', () => {
    const tones = SECTION_VALUES.map((section) => SECTION_TONES[section]);
    expect(new Set(tones).size).toBe(SECTION_VALUES.length);
    expect(tones).not.toContain('stone');
  });

  it('gives every role a tone', () => {
    for (const role of ROLE_VALUES) expect(TONE_VALUES).toContain(ROLE_TONES[role]);
  });

  it('paints each appointment status as the prototype does (AP_ST, H:3420)', () => {
    expect(APPOINTMENT_STATUS_TONES).toEqual({
      scheduled: 'butter',
      confirmed: 'sky',
      checked_in: 'lav',
      completed: 'sage',
      cancelled: 'stone',
      no_show: 'blush',
    });
  });

  it('paints the patient enums as the prototype does (PT_TYPES, PT_STAT, PT_CONV, H:3655)', () => {
    expect(PATIENT_TYPE_TONES).toEqual({
      aesthetic: 'lav',
      clinical: 'sky',
      lhr: 'blush',
      dental: 'mint',
      physio: 'sage',
      gynac: 'butter',
    });
    expect(PATIENT_STATUS_TONES).toEqual({
      new: 'sky',
      regular: 'lav',
      vip: 'butter',
      inactive: 'stone',
    });
    expect(PATIENT_CONVERSION_TONES).toEqual({
      converted: 'sage',
      not_converted: 'stone',
    });
    expect(GENDER_TONES).toEqual({ female: 'blush', male: 'sky', other: 'stone' });
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
