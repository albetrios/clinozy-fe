import { describe, expect, it } from 'vitest';

import type { ContactActivityEntry } from '@/shared/api/clinic/contact-activities-api.ts';
import { Camera, ClipboardList, MessageSquare, Pill } from '@/shared/icons/index.ts';

import {
  activityLook,
  activityRows,
  activityViewFilter,
  activityViews,
  maskedBody,
} from './activity-timeline.ts';

const entry = (
  id: string,
  occurredAt: string,
  more: Partial<ContactActivityEntry> = {},
): ContactActivityEntry => ({
  id,
  type: 'system',
  group: 'clinical',
  body: id,
  occurredAt,
  authorId: null,
  link: null,
  ...more,
});

describe('activityViewFilter (§6 #2)', () => {
  it('asks the stream for its own groups and the notes — never the conversation', () => {
    expect(activityViewFilter('clinical', { billing: true })).toEqual({
      group: ['clinical'],
    });
    expect(activityViewFilter('money', { billing: true })).toEqual({ group: ['money'] });
    expect(activityViewFilter('notes', { billing: true })).toEqual({ type: ['note'] });
    expect(activityViewFilter('all', { billing: true })).toEqual({
      type: ['system', 'note'],
    });
  });

  it('leaves the money group out of "All" without billing view, and its tab', () => {
    expect(activityViewFilter('all', { billing: false })).toEqual({
      type: ['system', 'note'],
      group: ['clinical', 'messages', 'tasks'],
    });
    expect(activityViews({ billing: false })).toEqual(['all', 'clinical', 'notes']);
    expect(activityViews({ billing: true })).toEqual([
      'all',
      'clinical',
      'money',
      'notes',
    ]);
  });
});

describe('activityLook', () => {
  it('draws a row by its record, a note as a note, an event with no record plainly', () => {
    expect(
      activityLook(entry('rx', '', { link: { kind: 'prescription', id: 'rx_one' } })),
    ).toEqual({ icon: Pill, tone: 'sage' });
    expect(
      activityLook(entry('photo', '', { link: { kind: 'image', id: 'pimg_one' } })),
    ).toEqual({ icon: Camera, tone: 'blush' });
    expect(activityLook(entry('note', '', { type: 'note', group: 'messages' }))).toEqual({
      icon: MessageSquare,
      tone: 'stone',
    });
    expect(activityLook(entry('event', ''))).toEqual({
      icon: ClipboardList,
      tone: 'stone',
    });
  });
});

describe('maskedBody (Q-F4)', () => {
  it('masks each rupee amount of the server’s line, and only those', () => {
    expect(maskedBody('Invoice 2026-27/0002 billed: ₹9,794.00', '₹ ••••')).toBe(
      'Invoice 2026-27/0002 billed: ₹ ••••',
    );
    expect(maskedBody('Refund ₹ 500 · then ₹1,200', '₹ ••••')).toBe(
      'Refund ₹ •••• · then ₹ ••••',
    );
    expect(maskedBody('Check-in logged: Better, score 7/10', '₹ ••••')).toBe(
      'Check-in logged: Better, score 7/10',
    );
  });
});

describe('activityRows', () => {
  it('keeps the read’s order and marks where each day starts', () => {
    const dayOf = (instant: string) => instant.slice(0, 10);
    const rows = activityRows(
      [
        entry('late', '2026-10-10T09:00:00.000Z'),
        entry('early', '2026-10-10T08:00:00.000Z'),
        entry('before', '2026-10-08T08:00:00.000Z'),
      ],
      dayOf,
    );
    expect(rows.map((row) => [row.entry.id, row.day, row.newDay])).toEqual([
      ['late', '2026-10-10', true],
      ['early', '2026-10-10', false],
      ['before', '2026-10-08', true],
    ]);
  });
});
