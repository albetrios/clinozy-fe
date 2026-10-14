import { describe, expect, it } from 'vitest';

import { markMatch, quickAddDraftOf, railName } from './contact-quick-pick-query.ts';

describe('quickAddDraftOf — the quick add’s start from the search', () => {
  it.each([
    ['Meera Iyer', { name: 'Meera Iyer', phone: '' }],
    ['  meera   iyer ', { name: 'meera iyer', phone: '' }],
    ['9825011241', { name: '', phone: '9825011241' }],
    ['+91 98250-11241', { name: '', phone: '9825011241' }],
    ['919825011241', { name: '', phone: '9825011241' }],
    ['09825011241', { name: '', phone: '9825011241' }],
    ['Meera 98250 11241', { name: 'Meera', phone: '9825011241' }],
    ['98250 11241 Meera Iyer', { name: 'Meera Iyer', phone: '9825011241' }],
    ['9825', { name: '', phone: '9825' }],
  ])('"%s" → %o', (typed, draft) => {
    expect(quickAddDraftOf(typed)).toEqual(draft);
  });

  it.each(['', '   ', 'C-12345', 'c12345', '#2371', 'PT-0412'])(
    'fills nothing from "%s" — empty, or a record’s number',
    (typed) => {
      expect(quickAddDraftOf(typed)).toEqual({ name: '', phone: '' });
    },
  );

  it('keeps a short number in the name and never a name without a letter', () => {
    expect(quickAddDraftOf('Room 12 Asha')).toEqual({ name: 'Room 12 Asha', phone: '' });
    expect(quickAddDraftOf('(98250)')).toEqual({ name: '', phone: '98250' });
  });

  it('cuts the name at 60 characters and the mobile at ten digits', () => {
    expect(quickAddDraftOf('a'.repeat(80)).name).toHaveLength(60);
    expect(quickAddDraftOf('98250112419999').phone).toBe('9825011241');
  });

  it('reads names in any script', () => {
    expect(quickAddDraftOf('أحمد 9825011241')).toEqual({
      name: 'أحمد',
      phone: '9825011241',
    });
  });
});

describe('markMatch — the hit’s highlight', () => {
  it('cuts the name around the typed words, case-insensitively', () => {
    expect(markMatch('Asha Patel', 'pat')).toEqual({
      before: 'Asha ',
      match: 'Pat',
      after: 'el',
    });
    expect(markMatch('Asha Patel', 'ASHA')).toEqual({
      before: '',
      match: 'Asha',
      after: ' Patel',
    });
  });

  it('marks the words of a mixed search, not its number', () => {
    expect(markMatch('Asha Patel', 'asha 98250')).toEqual({
      before: '',
      match: 'Asha',
      after: ' Patel',
    });
  });

  it('marks nothing for a number, a record number or words not in the name', () => {
    expect(markMatch('Asha Patel', '98250')).toBeNull();
    expect(markMatch('Asha Patel', 'C-12345')).toBeNull();
    expect(markMatch('Asha Patel', 'asha.p@example.test')).toBeNull();
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
