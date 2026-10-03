import { describe, expect, it } from 'vitest';

import { ROLE_VALUES, SECTION_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import { ROLE_TONES, SECTION_TONES, TONE_CLASSES, TONES } from './clinic-tones.ts';

describe('clinic tones', () => {
  it('gives every section its own tone', () => {
    const tones = SECTION_VALUES.map((section) => SECTION_TONES[section]);
    expect(new Set(tones).size).toBe(SECTION_VALUES.length);
    expect(tones).not.toContain('stone');
  });

  it('gives every role a tone', () => {
    for (const role of ROLE_VALUES) expect(TONES).toContain(ROLE_TONES[role]);
  });

  it('spells every class as a literal for its own tone', () => {
    for (const tone of TONES) {
      for (const value of Object.values(TONE_CLASSES[tone])) {
        expect(value).toContain(`tone-${tone}`);
        expect(value).not.toContain('${');
      }
    }
  });
});
