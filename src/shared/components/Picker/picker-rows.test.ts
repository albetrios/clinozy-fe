import { describe, expect, it } from 'vitest';

import type { PickerOption } from './picker.types.ts';
import {
  buildPickerRows,
  type BuildPickerRowsInput,
  filterPickerOptions,
  matchLabel,
  nextLabelMatch,
  type PickerOptionRow,
  pickerRowValue,
} from './picker-rows.ts';

const SERVICES: PickerOption[] = [
  { key: 'consult', label: 'Consultation', meta: '30 min', group: 'Skin' },
  { key: 'peel', label: 'Chemical peel', group: 'Skin', keywords: ['acid'] },
  { key: 'lhr', label: 'LHR full body', sub: 'Laser hair reduction', group: 'Body' },
  { key: 'prp', label: 'PRP scalp', group: 'Hair' },
  { key: 'botox', label: 'Botox', group: 'Hair', tone: 'blush' },
  { key: 'fillers', label: 'Fillers', group: 'Hair' },
  { key: 'peel-pro', label: 'Peel pro', group: 'Hair' },
  { key: 'facial', label: 'Facial', group: 'Hair', disabled: true },
];

const LABELS = { recent: 'Recent', all: 'All' };

function rows(input: Partial<BuildPickerRowsInput<unknown>>) {
  return buildPickerRows({
    options: SERVICES,
    query: '',
    recentKeys: [],
    recentEnabled: false,
    limit: Number.POSITIVE_INFINITY,
    labels: LABELS,
    ...input,
  });
}

function labels(optionRows: PickerOptionRow<unknown>[]): string[] {
  return optionRows.map((row) => row.option.label);
}

describe('matchLabel', () => {
  it('splits the label around the first case-insensitive hit', () => {
    expect(matchLabel('Chemical Peel', 'peel')).toEqual({
      before: 'Chemical ',
      hit: 'Peel',
      after: '',
    });
  });

  it('returns null without a term or a hit', () => {
    expect(matchLabel('Botox', '')).toBeNull();
    expect(matchLabel('Botox', 'zz')).toBeNull();
  });

  it('skips labels whose lower-casing changes their length', () => {
    expect(matchLabel('İstanbul clinic', 'clinic')).toBeNull();
  });
});

describe('filterPickerOptions', () => {
  it('keeps every option for an empty search', () => {
    expect(filterPickerOptions(SERVICES, '  ')).toHaveLength(SERVICES.length);
  });

  it('matches label, sub, meta, group and keywords', () => {
    expect(filterPickerOptions(SERVICES, 'laser').map((o) => o.key)).toEqual(['lhr']);
    expect(filterPickerOptions(SERVICES, '30 min').map((o) => o.key)).toEqual([
      'consult',
    ]);
    expect(filterPickerOptions(SERVICES, 'acid').map((o) => o.key)).toEqual(['peel']);
    expect(filterPickerOptions(SERVICES, 'body').map((o) => o.key)).toEqual(['lhr']);
  });

  it('puts label-prefix matches first, keeping the original order otherwise', () => {
    expect(filterPickerOptions(SERVICES, 'peel').map((o) => o.key)).toEqual([
      'peel-pro',
      'peel',
    ]);
  });
});

describe('buildPickerRows', () => {
  it('groups consecutive options under one header with a tone', () => {
    const { sections } = rows({});
    expect(sections.map((section) => section.heading)).toEqual(['Skin', 'Body', 'Hair']);
    expect(sections[0]?.tone).toBe('mint');
  });

  it('opens on Recent (newest first, enabled only) then All', () => {
    const result = rows({
      recentEnabled: true,
      recentKeys: ['botox', 'facial', 'missing', 'peel'],
      options: SERVICES.map(({ group: _group, ...option }) => option),
    });
    expect(result.sections.map((section) => section.heading)).toEqual(['Recent', 'All']);
    expect(result.sections[0]?.tone).toBe('stone');
    expect(labels(result.optionRows).slice(0, 3)).toEqual([
      'Botox',
      'Chemical peel',
      'Consultation',
    ]);
    // The same option in Recent and in its list keeps two distinct cmdk values.
    expect(result.optionRows[0]?.value).toBe(pickerRowValue('recent', 'botox'));
    expect(
      result.optionRows.find((row) => row.value === pickerRowValue('all', 'botox')),
    ).toBeTruthy();
  });

  it('keeps an option group of its own under Recent instead of "All"', () => {
    const result = rows({ recentEnabled: true, recentKeys: ['prp'] });
    expect(result.sections.map((section) => section.heading)).toEqual([
      'Recent',
      'Skin',
      'Body',
      'Hair',
    ]);
  });

  it('drops Recent while searching', () => {
    const result = rows({ recentEnabled: true, recentKeys: ['botox'], query: 'bo' });
    // "Botox" starts with the term, so it leads; "LHR full body" follows.
    expect(result.sections.map((section) => section.heading)).toEqual(['Hair', 'Body']);
  });

  it('highlights the search term, never inside a pill', () => {
    const plain = rows({ query: 'scal' });
    expect(plain.optionRows[0]?.match).toEqual({
      before: 'PRP ',
      hit: 'scal',
      after: 'p',
    });
    const pill = rows({
      options: [{ key: 'ig', label: 'Instagram', leading: { kind: 'pill' } }],
      query: 'insta',
    });
    expect(pill.optionRows[0]?.match).toBeNull();
  });

  it('separates destructive options that follow ordinary ones', () => {
    const result = rows({
      options: [
        { key: 'edit', label: 'Edit' },
        { key: 'copy', label: 'Duplicate' },
        { key: 'delete', label: 'Delete', destructive: true },
        { key: 'void', label: 'Void', destructive: true },
      ],
    });
    const kinds = result.sections[0]?.items.map((item) => item.kind);
    expect(kinds).toEqual(['option', 'option', 'separator', 'option', 'option']);
  });

  it('pages a static list and reports what is left', () => {
    const result = rows({ limit: 3 });
    expect(result.optionRows).toHaveLength(3);
    expect(result.total).toBe(SERVICES.length);
    expect(result.hasMore).toBe(true);
    expect(rows({ limit: 30 }).hasMore).toBe(false);
  });

  it('takes server results as they are', () => {
    const result = rows({ query: 'zzz', serverFiltered: true });
    expect(result.optionRows).toHaveLength(SERVICES.length);
    expect(result.optionRows[0]?.match).toBeNull();
  });

  it('uses the caller filter instead of the local search', () => {
    const result = rows({ query: 'x', filter: (options) => options.slice(0, 1) });
    expect(labels(result.optionRows)).toEqual(['Consultation']);
  });

  it('hashes a tone for an option without one, and keeps an explicit tone', () => {
    const result = rows({});
    const botox = result.optionRows.find((row) => row.option.key === 'botox');
    expect(botox?.tone).toBe('blush');
    expect(result.optionRows[0]?.tone).toMatch(/^(sky|sage|lav|butter|blush|mint)$/);
  });
});

describe('nextLabelMatch', () => {
  const list = ['Botox', 'Consultation', 'Chemical peel', 'Fillers'];

  it('finds the next label after the current one that starts with the key', () => {
    expect(nextLabelMatch(list, 1, 'c')).toBe(2);
    expect(nextLabelMatch(list, 2, 'C')).toBe(1);
  });

  it('starts from the top without a current row and wraps round', () => {
    expect(nextLabelMatch(list, -1, 'b')).toBe(0);
    expect(nextLabelMatch(list, 3, 'b')).toBe(0);
  });

  it('returns -1 when nothing starts with the key', () => {
    expect(nextLabelMatch(list, 0, 'z')).toBe(-1);
  });
});
