import { describe, expect, it } from 'vitest';

import type { LedgerPerson } from '@/shared/api/clinic/payments-contracts.ts';

import {
  cashDifference,
  dayCloseBranchId,
  dayLog,
  dayStatus,
  differenceText,
  differenceTone,
  netText,
  typedPaise,
} from './day-close-view.ts';

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const RIYA: LedgerPerson = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Riya Shah',
  initials: 'RS',
  tone: 'blush',
};

describe('the drawer’s difference (H:5124)', () => {
  it('is none before a count, else counted less expected', () => {
    expect(cashDifference(null, 174_000)).toBeNull();
    expect(cashDifference(170_000, 174_000)).toBe(-4000);
  });

  it('paints none muted, a match sage and a gap blush', () => {
    expect(differenceTone(null)).toBe('none');
    expect(differenceTone(0)).toBe('match');
    expect(differenceTone(-4000)).toBe('gap');
    expect(differenceTone(1000)).toBe('gap');
  });

  it('writes "—", "₹0", "+₹10" and "−₹40"', () => {
    expect(differenceText(null, rupees)).toBe('—');
    expect(differenceText(0, rupees)).toBe('₹0');
    expect(differenceText(1000, rupees)).toBe('+₹10');
    expect(differenceText(-4000, rupees)).toBe('−₹40');
  });

  it('nets a mode with a minus only (H:5110)', () => {
    expect(netText(-26_000, rupees)).toBe('−₹260');
    expect(netText(60_000, rupees)).toBe('₹600');
    expect(netText(0, rupees)).toBe('₹0');
  });
});

describe('dayCloseBranchId (Q-G6)', () => {
  const branches = [
    { id: 'main', isMain: true },
    { id: 'vesu', isMain: false },
    { id: 'adajan', isMain: false },
  ];
  it('takes the URL’s open branch, else the header’s one branch', () => {
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: [],
        ownBranchIds: [],
        requested: 'vesu',
      }),
    ).toBe('vesu');
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: ['adajan'],
        ownBranchIds: ['vesu'],
        requested: 'closed-branch',
      }),
    ).toBe('adajan');
  });

  it('on "All branches", the member’s own branch, else the main one', () => {
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: [],
        ownBranchIds: ['gone', 'vesu'],
        requested: undefined,
      }),
    ).toBe('vesu');
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: ['vesu', 'adajan'],
        ownBranchIds: [],
        requested: undefined,
      }),
    ).toBe('main');
  });
});

describe('dayStatus (H:5112)', () => {
  const base = { closedBy: null, autoClosed: false, autoClosesInHours: null };
  it('names who closed it, or "Force-closed" when the job did — sage', () => {
    expect(dayStatus({ ...base, state: 'closed', closedBy: RIYA })).toEqual({
      kind: 'closedBy',
      name: 'Riya Shah',
      tone: 'sage',
    });
    expect(dayStatus({ ...base, state: 'closed', autoClosed: true })).toEqual({
      kind: 'forceClosed',
      tone: 'sage',
    });
    expect(dayStatus({ ...base, state: 'closed' })).toEqual({
      kind: 'closed',
      tone: 'sage',
    });
  });

  it('reads today "Open" (sky), a past day "Open · auto-closes in N h" (butter)', () => {
    expect(dayStatus({ ...base, state: 'open' })).toEqual({ kind: 'open', tone: 'sky' });
    expect(dayStatus({ ...base, state: 'gate', autoClosesInHours: 14 })).toEqual({
      kind: 'openAuto',
      hours: 14,
      tone: 'butter',
    });
  });
});

describe('dayLog (H:5121)', () => {
  const closed = {
    openingAcceptedAt: '2026-10-03T03:42:00.000Z',
    acceptedBy: RIYA,
    checkedIds: ['a', 'b'],
    countedCash: 170_000,
    closedAt: '2026-10-03T14:12:00.000Z',
    closedBy: RIYA,
    autoClosed: false,
  };
  it('runs accepted → reviewed → counted → closed', () => {
    expect(dayLog(closed).map((row) => [row.id, row.tone, row.at])).toEqual([
      ['accepted', 'sky', closed.openingAcceptedAt],
      ['reviewed', 'lav', null],
      ['counted', 'butter', closed.closedAt],
      ['closed', 'sage', closed.closedAt],
    ]);
  });

  it('for a day the job closed, only the close — no count of its own', () => {
    const auto = dayLog({
      ...closed,
      openingAcceptedAt: null,
      acceptedBy: null,
      checkedIds: [],
      closedBy: null,
      autoClosed: true,
    });
    expect(auto.map((row) => row.id)).toEqual(['closed']);
    expect(auto[0]?.person).toBeNull();
  });
});

describe('typedPaise', () => {
  it('reads typed rupees as paise, nothing while empty', () => {
    expect(typedPaise('')).toBeNull();
    expect(typedPaise('  ')).toBeNull();
    expect(typedPaise('1700')).toBe(170_000);
    expect(typedPaise('12.5')).toBe(1250);
  });
});
