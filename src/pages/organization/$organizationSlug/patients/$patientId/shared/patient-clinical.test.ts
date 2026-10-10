import { describe, expect, it } from 'vitest';

import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/clinic/clinical-notes-contracts.ts';

import {
  CLINICAL_LISTS,
  clinicalKindOf,
  clinicalNotesByField,
} from './patient-clinical.ts';

/** A note of `kind` reading `text`. */
const note = (kind: ClinicalNoteKind, text: string): ClinicalNote => ({
  id: `pcn_${text.toLowerCase().replaceAll(' ', '')}`,
  patientId: 'pat_priya0000000000000000',
  kind,
  text,
  appointmentId: null,
  diagnosisId: null,
  addedAt: '2026-10-01T05:00:00.000Z',
});

describe('the clinical lists (api-integration §5.4)', () => {
  it('holds one note kind per card, in the design’s order and tones', () => {
    expect(CLINICAL_LISTS.map(({ field, tone }) => [field, tone])).toEqual([
      ['complaints', 'blush'],
      ['diagnosis', 'lav'],
      ['treatmentSuggestions', 'sage'],
      ['futureSuggestions', 'sky'],
    ]);
    expect(CLINICAL_LISTS.map(({ field }) => clinicalKindOf(field))).toEqual([
      'complaint',
      'diagnosis',
      'treatment_suggestion',
      'future_suggestion',
    ]);
  });

  it('files each note under its card, in order — a finding or a safety check under none', () => {
    const lists = clinicalNotesByField([
      note('complaint', 'Tanning on face'),
      note('finding', 'Dry skin on cheeks'),
      note('future_suggestion', 'Hydrafacial after 4 weeks'),
      note('complaint', 'Uneven skin tone'),
      note('safety_check', 'No isotretinoin'),
    ]);
    expect(Object.keys(lists)).toEqual([
      'complaints',
      'diagnosis',
      'treatmentSuggestions',
      'futureSuggestions',
    ]);
    expect(lists.complaints.map(({ text }) => text)).toEqual([
      'Tanning on face',
      'Uneven skin tone',
    ]);
    expect(lists.diagnosis).toEqual([]);
    expect(lists.treatmentSuggestions).toEqual([]);
    expect(lists.futureSuggestions.map(({ text }) => text)).toEqual([
      'Hydrafacial after 4 weeks',
    ]);
  });
});
