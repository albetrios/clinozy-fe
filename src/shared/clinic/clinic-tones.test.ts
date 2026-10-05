import { describe, expect, it } from 'vitest';

import {
  LEAD_INTEREST_VALUES,
  LEAD_STATUS_VALUES,
  ROLE_VALUES,
  SECTION_VALUES,
  TONE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import { LEAD_RECORD_SOURCE_VALUES } from '@/shared/api/clinic/leads-contracts.ts';

import {
  APPOINTMENT_STATUS_TONES,
  GENDER_TONES,
  IMAGE_ALBUM_TONES,
  LEAD_INTEREST_TONES,
  LEAD_SOURCE_TONES,
  LEAD_STATUS_TONES,
  OFFERING_CATEGORY_TONES,
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

  it('paints offering categories and photo albums as the prototype does', () => {
    // OF_CATS (H:3546), the visit photos' album tags (H:4526).
    expect(OFFERING_CATEGORY_TONES).toEqual({
      consultation: 'sky',
      treatment: 'sage',
      package: 'lav',
      lhr: 'blush',
      product: 'butter',
    });
    expect(IMAGE_ALBUM_TONES).toEqual({ general: 'stone', private: 'lav', lhr: 'blush' });
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

  it('paints each lead status, source and interest as the prototype does', () => {
    // LSTAT (H:3346), LSRC / SRC_SK (H:3348, H:3360) + Phone call (Q-L6), INTK (H:3358).
    expect(LEAD_STATUS_TONES).toEqual({
      new: 'sky',
      contacted: 'lav',
      follow_up: 'butter',
      clinic_visited: 'sage',
      no_response: 'stone',
      not_interested: 'blush',
      invalid: 'stone',
      lost: 'blush',
    });
    for (const status of LEAD_STATUS_VALUES)
      expect(TONE_VALUES).toContain(LEAD_STATUS_TONES[status]);
    for (const source of LEAD_RECORD_SOURCE_VALUES)
      expect(TONE_VALUES).toContain(LEAD_SOURCE_TONES[source]);
    expect(LEAD_SOURCE_TONES.retarget).toBe('mint');
    expect(LEAD_SOURCE_TONES.phone_call).toBe('sky');
    for (const interest of LEAD_INTEREST_VALUES)
      expect(TONE_VALUES).toContain(LEAD_INTEREST_TONES[interest]);
    expect(LEAD_INTEREST_TONES.lhr).toBe('lav');
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

  it('draws a row’s inline-start status edge in the tone’s ink (preset.md:192), or its dot', () => {
    for (const tone of TONE_VALUES) {
      expect(TONE_CLASSES[tone].edge).toBe(`border-s-tone-${tone}-foreground`);
      expect(TONE_CLASSES[tone].edgeDot).toBe(`border-s-tone-${tone}-dot`);
    }
  });
});
