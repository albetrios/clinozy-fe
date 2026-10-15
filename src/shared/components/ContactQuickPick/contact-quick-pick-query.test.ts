import { describe, expect, it } from 'vitest';

import { markWords, quickAddDraftOf, railName } from './contact-quick-pick-query.ts';

describe('quickAddDraftOf — the quick add’s start from the search', () => {
  it.each([
    ['Meera Iyer', { name: 'Meera Iyer', phone: '', instagram: '' }],
    ['  meera   iyer ', { name: 'meera iyer', phone: '', instagram: '' }],
    ['9825011241', { name: '', phone: '9825011241', instagram: '' }],
    ['+91 98250-11241', { name: '', phone: '9825011241', instagram: '' }],
    ['919825011241', { name: '', phone: '9825011241', instagram: '' }],
    ['09825011241', { name: '', phone: '9825011241', instagram: '' }],
    ['Meera 98250 11241', { name: 'Meera', phone: '9825011241', instagram: '' }],
    [
      '98250 11241 Meera Iyer',
      { name: 'Meera Iyer', phone: '9825011241', instagram: '' },
    ],
    ['9825', { name: '', phone: '9825', instagram: '' }],
  ])('"%s" → %o', (typed, draft) => {
    expect(quickAddDraftOf(typed)).toEqual(draft);
  });

  it.each(['', '   ', 'C-12345', 'c12345', '#2371', 'PT-0412'])(
    'fills nothing from "%s" — empty, or a record’s number',
    (typed) => {
      expect(quickAddDraftOf(typed)).toEqual({ name: '', phone: '', instagram: '' });
    },
  );

  it('keeps a short number in the name and never a name without a letter', () => {
    expect(quickAddDraftOf('Room 12 Asha')).toEqual({
      name: 'Room 12 Asha',
      phone: '',
      instagram: '',
    });
    expect(quickAddDraftOf('(98250)')).toEqual({
      name: '',
      phone: '98250',
      instagram: '',
    });
  });

  it('cuts the name at 60 characters and the mobile at ten digits', () => {
    expect(quickAddDraftOf('a'.repeat(80)).name).toHaveLength(60);
    expect(quickAddDraftOf('98250112419999').phone).toBe('9825011241');
  });

  it('reads names in any script', () => {
    expect(quickAddDraftOf('أحمد 9825011241')).toEqual({
      name: 'أحمد',
      phone: '9825011241',
      instagram: '',
    });
  });

  it('puts each typed value in the field it belongs to (change-natural-contact-search D4)', () => {
    expect(quickAddDraftOf('Meera Iyer 98250 11241 @Meera.Iyer')).toEqual({
      name: 'Meera Iyer',
      phone: '9825011241',
      instagram: '@meera.iyer',
    });
    expect(quickAddDraftOf('instagram.com/meera_iyer/ Meera')).toEqual({
      name: 'Meera',
      phone: '',
      instagram: '@meera_iyer',
    });
    expect(quickAddDraftOf('https://www.instagram.com/meera.iyer')).toEqual({
      name: '',
      phone: '',
      instagram: '@meera.iyer',
    });
  });

  it('never takes an email for a name (D5)', () => {
    expect(quickAddDraftOf('meera@example.com')).toEqual({
      name: '',
      phone: '',
      instagram: '',
    });
    expect(quickAddDraftOf('Meera meera@example.com 9825011241')).toEqual({
      name: 'Meera',
      phone: '9825011241',
      instagram: '',
    });
  });
});

/** The marked pieces of a name, as text: marked words in [brackets]. */
function marked(name: string, typed: string): string | null {
  const pieces = markWords(name, typed);
  return (
    pieces?.map((piece) => (piece.marked ? `[${piece.text}]` : piece.text)).join('') ??
    null
  );
}

describe('markWords — every typed word marked (change-natural-contact-search D9)', () => {
  it('marks the typed word wherever it is, case-insensitively', () => {
    expect(marked('Asha Patel', 'pat')).toBe('Asha [Pat]el');
    expect(marked('Asha Patel', 'ASHA')).toBe('[Asha] Patel');
  });

  it('marks every word, in any order', () => {
    expect(marked('Meera Iyer', 'iyer meera')).toBe('[Meera] [Iyer]');
    expect(marked('Meera Iyer', 'mee iy')).toBe('[Mee]ra [Iy]er');
    expect(marked('Dayaananda Namboothiri', 'ana')).toBe('Daya[ana]nda Namboothiri');
  });

  it('merges overlapping marks', () => {
    expect(marked('Meera Iyer', 'mee meer')).toBe('[Meer]a Iyer');
  });

  it('marks the words of a mixed search, not its number or handle', () => {
    expect(marked('Asha Patel', 'asha 98250')).toBe('[Asha] Patel');
    expect(marked('Asha Patel', 'asha @asha.p')).toBe('[Asha] Patel');
  });

  it('marks nothing for a number, a record number, an email or words not in the name', () => {
    expect(markWords('Asha Patel', '98250')).toBeNull();
    expect(markWords('Asha Patel', 'C-12345')).toBeNull();
    expect(markWords('Asha Patel', 'asha.p@example.test')).toBeNull();
    expect(markWords('Asha Patel', 'kavya')).toBeNull();
  });
});

describe('railName — a Recent chip’s short name', () => {
  it.each([
    ['Kavya Shah', 'Kavya S.'],
    ['Dayaananda Namboothiri', 'Dayaananda N.'],
    ['  Asha   Rani  Patel ', 'Asha P.'],
    ['Meera', 'Meera'],
    ['meera iyer', 'meera I.'],
    ['', ''],
  ])('"%s" → "%s"', (name, short) => {
    expect(railName(name)).toBe(short);
  });
});
