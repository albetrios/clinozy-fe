import { describe, expect, it } from 'vitest';

import { parseSmartNote, SMART_NOTE_WORDS } from './smart-note.ts';

const CATALOG = ['Flubolt 400', 'Clonix-B Lotion', 'Minoxidil 5% Solution'];

describe('parseSmartNote (H:4917)', () => {
  it('files the words it knows under their lists, capitalised', () => {
    expect(parseSmartNote('hair fall 2 months, suggest PRP', CATALOG)).toEqual({
      chips: [
        { field: 'complaints', text: 'Hair fall' },
        { field: 'treatmentSuggestions', text: 'Prp' },
      ],
      medicines: [],
    });
  });

  it('reads any case — a diagnosis too', () => {
    expect(parseSmartNote('MELASMA on both cheeks', []).chips).toEqual([
      { field: 'diagnosis', text: 'Melasma' },
    ]);
  });

  it('names each medicine of the catalogue whose first word the note holds', () => {
    expect(
      parseSmartNote('start flubolt and clonix-b at night', [...CATALOG, ' ']).medicines,
    ).toEqual(['Flubolt 400', 'Clonix-B Lotion']);
  });

  it('reads nothing under three letters', () => {
    expect(parseSmartNote(' ta ', CATALOG)).toEqual({ chips: [], medicines: [] });
  });

  it('never files under Later (H:4918)', () => {
    expect(Object.keys(SMART_NOTE_WORDS)).toEqual([
      'complaints',
      'diagnosis',
      'treatmentSuggestions',
    ]);
  });
});
