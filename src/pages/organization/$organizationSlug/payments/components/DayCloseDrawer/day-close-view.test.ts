import { describe, expect, it } from 'vitest';

import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import type { LedgerPerson } from '@/shared/api/clinic/payments-contracts.ts';

import {
  countDifference,
  countNeedsReason,
  dayCloseBranchId,
  dayLog,
  dayStatus,
  differenceText,
  differenceTone,
  typedRupees,
} from './day-close-view.ts';

const rupees = (value: number) => `₹${value.toLocaleString('en-IN')}`;
const NISHA: LedgerPerson = {
  id: 'mem_yls33gz5jj66ful8q4ads',
  name: 'Nisha Shah',
  initials: 'NS',
  tone: 'sage',
};

describe('the drawer’s difference (H:5124)', () => {
  it('previews the count against the server’s expected cash, in paise', () => {
    expect(countDifference(null, 1740)).toBeNull();
    expect(countDifference(1700, null)).toBeNull();
    expect(countDifference(1700, 1740)).toBe(-40);
    expect(countDifference(0.3, 0.1 + 0.2)).toBe(0);
    expect(countDifference(0, -120)).toBe(120);
  });

  it('asks why only when the count is off', () => {
    expect(countNeedsReason(null, 300)).toBe(false);
    expect(countNeedsReason(300, 300)).toBe(false);
    expect(countNeedsReason(280, 300)).toBe(true);
  });

  it('paints none muted, a match sage and a gap blush', () => {
    expect(differenceTone(null)).toBe('none');
    expect(differenceTone(0)).toBe('match');
    expect(differenceTone(-40)).toBe('gap');
    expect(differenceTone(10)).toBe('gap');
  });

  it('writes "—", "₹0", "+₹10" and "−₹40"', () => {
    expect(differenceText(null, rupees)).toBe('—');
    expect(differenceText(0, rupees)).toBe('₹0');
    expect(differenceText(10, rupees)).toBe('+₹10');
    expect(differenceText(-40, rupees)).toBe('−₹40');
  });
});

describe('dayCloseBranchId (Q-G6)', () => {
  const branches = [
    { id: 'brn_main', isMain: true },
    { id: 'brn_vesu', isMain: false },
    { id: 'brn_adajan', isMain: false },
  ];
  it('takes the URL’s branch, else the header’s one branch', () => {
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: [],
        ownBranchIds: [],
        requested: 'brn_vesu',
      }),
    ).toBe('brn_vesu');
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: ['brn_adajan'],
        ownBranchIds: ['brn_vesu'],
        requested: 'brn_gone',
      }),
    ).toBe('brn_adajan');
  });

  it('on "All branches", the member’s own branch, else the main one', () => {
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: [],
        ownBranchIds: ['brn_gone', 'brn_vesu'],
        requested: undefined,
      }),
    ).toBe('brn_vesu');
    expect(
      dayCloseBranchId({
        branches,
        branchFilter: ['brn_vesu', 'brn_adajan'],
        ownBranchIds: [],
        requested: undefined,
      }),
    ).toBe('brn_main');
  });
});

describe('dayStatus (H:5112)', () => {
  const base = { closedBy: null, autoClosed: false, autoClosesInHours: null };
  it('names who closed it, or "Force-closed" when the worker did — sage', () => {
    expect(dayStatus({ ...base, state: 'closed', closedBy: NISHA })).toEqual({
      kind: 'closedBy',
      name: 'Nisha Shah',
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

describe('dayLog (H:5121) — the server’s events by kind', () => {
  type Event = DayCloseView['events'][number];
  const event = (id: string, kind: Event['kind'], patch: Partial<Event> = {}): Event => ({
    id,
    kind,
    text: 'English from the server',
    membershipId: NISHA.id,
    at: '2026-10-09T04:00:00.000Z',
    by: NISHA,
    ...patch,
  });
  const carried = { cash: 0, source: 'carried' as const, from: null };

  it('words the opening, a close a reopen undid, the reopen’s reason and the standing close', () => {
    const rows = dayLog({
      state: 'closed',
      opening: carried,
      events: [
        event('a', 'opened'),
        event('b', 'closed'),
        event('c', 'reopened', { text: 'Counted wrong' }),
        event('d', 'closed'),
      ],
    });
    expect(rows.map((row) => [row.id, row.kind, row.tone, row.reason])).toEqual([
      ['a', 'accepted', 'sky', null],
      ['b', 'closed', 'sage', null],
      ['c', 'reopened', 'butter', 'Counted wrong'],
      ['d', 'counted', 'sage', null],
    ]);
    expect(rows[0]?.person).toBe(NISHA);
  });

  it('reads a recounted opening as opened, then recounted', () => {
    const rows = dayLog({
      state: 'open',
      opening: { ...carried, source: 'recounted' },
      events: [event('a', 'opened'), event('b', 'recounted')],
    });
    expect(rows.map((row) => row.kind)).toEqual(['opened', 'recounted']);
  });

  it('leaves an open day’s last close without a count, and keeps the worker’s steps no one’s', () => {
    const open = dayLog({
      state: 'open',
      opening: carried,
      events: [event('a', 'opened'), event('b', 'closed'), event('c', 'reopened')],
    });
    expect(open.map((row) => row.kind)).toEqual(['accepted', 'closed', 'reopened']);

    const auto = dayLog({
      state: 'closed',
      opening: carried,
      events: [event('a', 'auto_closed', { membershipId: null, by: null })],
    });
    expect(auto).toEqual([
      expect.objectContaining({ kind: 'auto', byMember: false, person: null }),
    ]);
  });
});

describe('typedRupees', () => {
  it('reads typed rupees, nothing while empty', () => {
    expect(typedRupees('')).toBeNull();
    expect(typedRupees('  ')).toBeNull();
    expect(typedRupees('1700')).toBe(1700);
    expect(typedRupees('12.5')).toBe(12.5);
    expect(typedRupees('0.07')).toBeCloseTo(0.07, 2);
  });
});
