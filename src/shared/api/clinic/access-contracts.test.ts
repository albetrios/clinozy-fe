import { describe, expect, it } from 'vitest';

import {
  CUSTOM_ROLE_TONES,
  PRESET_ROLE_NAMES,
  presetOfRole,
} from './access-contracts.ts';
import { ROLE_VALUES } from './clinic-schema.ts';

describe('the access contracts', () => {
  it('names every preset the way clinozy-be does, each name once', () => {
    expect(Object.keys(PRESET_ROLE_NAMES).sort()).toEqual([...ROLE_VALUES].sort());
    const names = Object.values(PRESET_ROLE_NAMES);
    expect(new Set(names).size).toBe(names.length);
  });

  it('knows a preset by its system flag and exact name — never a custom role of the same name', () => {
    expect(presetOfRole({ name: 'Front desk', isSystem: true })).toBe('front_desk');
    expect(presetOfRole({ name: 'Owner', isSystem: true })).toBe('owner');
    expect(presetOfRole({ name: 'Doctor', isSystem: false })).toBeNull();
    expect(presetOfRole({ name: 'doctor', isSystem: true })).toBeNull();
    expect(presetOfRole({ name: 'Floor manager', isSystem: true })).toBeNull();
  });

  it('cycles six custom tones', () => {
    expect(CUSTOM_ROLE_TONES).toEqual(['plum', 'lime', 'mint', 'sky', 'peach', 'lav']);
  });
});
