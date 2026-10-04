import { describe, expect, it } from 'vitest';

import { automaticSection, roomFiltersOf } from './room-filter-sections.ts';

const MAKERS = [
  { id: 'a', name: 'ALVI', tone: 'lav' as const },
  { id: 'b', name: 'DERM', tone: 'sky' as const },
];

describe('room filter sections', () => {
  it('shows an automatic section for 2 to 10 values, then Created', () => {
    expect(automaticSection('Manufacturer', MAKERS.slice(0, 1))).toBeNull();
    const section = automaticSection('Manufacturer', MAKERS);
    expect(section?.field).toEqual({ kind: 'options', values: ['a', 'b'] });
    expect(section?.copy.options.a).toEqual({ label: 'ALVI', tone: 'lav' });
    const { fields, copy } = roomFiltersOf({ manufacturer: section, mrs: null });
    expect(Object.keys(fields)).toEqual(['manufacturer', 'created']);
    expect(fields.created).toEqual({ kind: 'date', presets: 'created' });
    expect(Object.keys(copy)).toEqual(['manufacturer']);
  });

  it('drops a section with as many values as the list has rows', () => {
    expect(automaticSection('Category', MAKERS, 2)).toBeNull();
    expect(automaticSection('Category', MAKERS, 3)).not.toBeNull();
  });
});
