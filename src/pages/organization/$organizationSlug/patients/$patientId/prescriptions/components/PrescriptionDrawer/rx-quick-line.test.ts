import { describe, expect, it } from 'vitest';

import type { RxCatalogMedicine } from '@/shared/api/clinic/prescriptions-api.ts';
import {
  nameNumbers,
  QUICK_LINE_MATCH_LIMIT,
} from '@/shared/components/QuickLine/index.ts';

import {
  browseRxMedicines,
  dosesPerDay,
  matchRxMedicines,
  parseRxLine,
  typedRxName,
} from './rx-quick-line.ts';

function medicine(
  name: string,
  fields: Partial<RxCatalogMedicine> = {},
): RxCatalogMedicine {
  return {
    name,
    medicineId: null,
    composition: null,
    mrp: null,
    stock: null,
    form: /lotion|shampoo|cream|gel|sunscreen/i.test(name) ? 'topical' : 'oral',
    last: null,
    ...fields,
  };
}

const CATALOG = [
  medicine('Clonix-B Lotion', { composition: 'Clobetasol + Salicylic acid' }),
  medicine('Densyl-AD Shampoo'),
  medicine('Flubolt 400', { composition: 'Fluconazole' }),
  medicine('Sunscreen SPF 50'),
  medicine('Tranexa 500', { composition: 'Tranexamic acid' }),
];
const NUMBERS = nameNumbers(CATALOG.map((row) => row.name));

describe('parseRxLine — the shorthand (H:3864)', () => {
  it('reads the design’s example: flu 0-0-1 af 10d', () => {
    expect(parseRxLine('flu 0-0-1 af 10d', NUMBERS)).toEqual({
      words: ['flu'],
      values: {
        dose: [0, 0, 1],
        when: { kind: 'meal', meal: 'after' },
        days: 10,
        qty: 10,
      },
    });
  });

  it('turns od · bd · tds · hs · sos into doses', () => {
    expect(parseRxLine('a od').values.dose).toEqual([1, 0, 0]);
    expect(parseRxLine('a bd').values.dose).toEqual([1, 0, 1]);
    expect(parseRxLine('a tds').values.dose).toEqual([1, 1, 1]);
    expect(parseRxLine('a sos').values.dose).toBe('sos');
  });

  it('makes hs a night dose taken at night, unless a timing is set', () => {
    expect(parseRxLine('a hs').values).toEqual({
      dose: [0, 0, 1],
      when: { kind: 'timing', timing: 'night' },
    });
    expect(parseRxLine('a af hs').values.when).toEqual({ kind: 'meal', meal: 'after' });
  });

  it('reads meals and timings in short and long words', () => {
    expect(parseRxLine('a bf').values.when).toEqual({ kind: 'meal', meal: 'before' });
    expect(parseRxLine('a before').values.when).toEqual({ kind: 'meal', meal: 'before' });
    expect(parseRxLine('a am').values.when).toEqual({
      kind: 'timing',
      timing: 'morning',
    });
    expect(parseRxLine('a pm').values.when).toEqual({ kind: 'timing', timing: 'night' });
  });

  it('reads the places it knows', () => {
    for (const place of ['face', 'scalp', 'body', 'hair', 'underarm'] as const) {
      expect(parseRxLine(`cream ${place}`).values.where).toBe(place);
    }
  });

  it('reads days and weeks, and multiplies them into a quantity', () => {
    expect(parseRxLine('a 1-0-1 5d').values).toMatchObject({ days: 5, qty: 10 });
    expect(parseRxLine('a 1-1-1 2w').values).toMatchObject({ days: 14, qty: 42 });
  });

  it('keeps a quantity typed with the days', () => {
    expect(parseRxLine('a 1-0-1 5d x3').values).toMatchObject({ days: 5, qty: 3 });
  });

  it('sets no quantity from days without a tap dose', () => {
    expect(parseRxLine('a sos 5d').values).toEqual({ dose: 'sos', days: 5 });
  });

  it('takes x8 or a bare number after the name as the quantity', () => {
    expect(parseRxLine('epriva x8').values.qty).toBe(8);
    expect(parseRxLine('epriva 8').values.qty).toBe(8);
  });

  it('keeps a number the catalogue’s names carry in the name', () => {
    expect(parseRxLine('flubolt 400', NUMBERS)).toEqual({
      words: ['flubolt', '400'],
      values: {},
    });
    expect(parseRxLine('flubolt 400 x2', NUMBERS).values.qty).toBe(2);
  });

  it('reads no quantity before a name word', () => {
    expect(parseRxLine('8 epriva')).toEqual({ words: ['8', 'epriva'], values: {} });
  });

  it('ignores case and spacing', () => {
    expect(parseRxLine('  Flu   0-0-1  AF ')).toEqual(parseRxLine('flu 0-0-1 af'));
  });

  it('counts doses a day, none for SOS', () => {
    expect(dosesPerDay([1, 1, 1])).toBe(3);
    expect(dosesPerDay('sos')).toBe(0);
    expect(dosesPerDay(undefined)).toBe(0);
  });
});

describe('matchRxMedicines — the quick line’s matches', () => {
  it('finds by the name’s start, a word’s start, anywhere, then letters in order', () => {
    expect(matchRxMedicines(CATALOG, ['flu']).map((row) => row.name)).toEqual([
      'Flubolt 400',
    ]);
    expect(matchRxMedicines(CATALOG, ['tranexamic']).map((row) => row.name)).toEqual([
      'Tranexa 500',
    ]);
    expect(matchRxMedicines(CATALOG, ['spf']).map((row) => row.name)).toEqual([
      'Sunscreen SPF 50',
    ]);
    expect(matchRxMedicines(CATALOG, ['dnsl']).map((row) => row.name)).toEqual([
      'Densyl-AD Shampoo',
    ]);
  });

  it('needs every word to match, and ranks the closer matches first', () => {
    expect(
      matchRxMedicines(CATALOG, ['lotion', 'clonix']).map((row) => row.name),
    ).toEqual(['Clonix-B Lotion']);
    const ranked = matchRxMedicines(
      [medicine('Acnelak Soap'), medicine('Soap Free Wash')],
      ['soap'],
    );
    expect(ranked.map((row) => row.name)).toEqual(['Soap Free Wash', 'Acnelak Soap']);
  });

  it('lists the often prescribed first while nothing is typed', () => {
    expect(
      matchRxMedicines(CATALOG, [], ['Tranexa 500', 'Flubolt 400']).map(
        (row) => row.name,
      ),
    ).toEqual([
      'Tranexa 500',
      'Flubolt 400',
      'Clonix-B Lotion',
      'Densyl-AD Shampoo',
      'Sunscreen SPF 50',
    ]);
  });

  it('lists at most eight', () => {
    const many = Array.from({ length: 12 }, (_, index) => medicine(`Cream ${index}`));
    expect(matchRxMedicines(many, ['cream'])).toHaveLength(QUICK_LINE_MATCH_LIMIT);
  });

  it('finds nothing for a word no medicine has', () => {
    expect(matchRxMedicines(CATALOG, ['zzz'])).toEqual([]);
  });
});

describe('typedRxName — “Not in the list · add as typed”', () => {
  it('capitalises each word of an unlisted name', () => {
    expect(typedRxName(CATALOG, ['minoxin', '5%'])).toBe('Minoxin 5%');
  });

  it('offers nothing for a listed name or an empty line', () => {
    expect(typedRxName(CATALOG, ['flubolt', '400'])).toBeNull();
    expect(typedRxName(CATALOG, [])).toBeNull();
  });
});

describe('browseRxMedicines — Browse’s tiles', () => {
  it('splits Oral and Topical, and shows the often prescribed', () => {
    expect(browseRxMedicines(CATALOG, 'oral', []).map((row) => row.name)).toEqual([
      'Flubolt 400',
      'Tranexa 500',
    ]);
    expect(browseRxMedicines(CATALOG, 'topical', [])).toHaveLength(3);
    expect(
      browseRxMedicines(CATALOG, 'often', [], ['Flubolt 400']).map((row) => row.name),
    ).toEqual(['Flubolt 400']);
  });

  it('narrows to the medicines holding every typed word', () => {
    expect(browseRxMedicines(CATALOG, 'all', ['acid']).map((row) => row.name)).toEqual([
      'Clonix-B Lotion',
      'Tranexa 500',
    ]);
  });
});
