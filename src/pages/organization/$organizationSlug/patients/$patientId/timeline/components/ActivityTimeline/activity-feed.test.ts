import { describe, expect, it, vi } from 'vitest';

import { activityCounts, type ActivityEntry, activityRows } from './activity-feed.ts';

/** A record at `at` (UTC) on its UTC day. */
function entry(id: string, kind: ActivityEntry['kind'], at: string): ActivityEntry {
  return {
    id,
    kind,
    day: at.slice(0, 10),
    at,
    time: null,
    title: id,
    sub: '',
    badge: null,
    by: null,
    open: vi.fn(),
  };
}

const ENTRIES = [
  entry('note', 'note', '2026-10-02T10:10:00.000Z'),
  entry('photo-a', 'photo', '2026-10-02T06:30:00.000Z'),
  entry('visit', 'visit', '2026-10-03T05:00:00.000Z'),
  entry('photo-b', 'photo', '2026-10-02T06:30:00.000Z'),
  entry('rx', 'rx', '2026-10-02T03:30:00.000Z'),
  entry('photo-c', 'photo', '2026-10-02T02:00:00.000Z'),
  entry('photo-d', 'photo', '2026-10-01T06:30:00.000Z'),
];

const shape = (filter: Parameters<typeof activityRows>[1]) =>
  activityRows(ENTRIES, filter).map((row) => ({
    id: row.id,
    entries: row.entries.map((one) => one.id),
    newDay: row.newDay,
  }));

describe('activityRows (H:4852–4862)', () => {
  it('lists the newest first; a photo joins the row of the photo right before it that day', () => {
    expect(shape('all')).toEqual([
      { id: 'visit', entries: ['visit'], newDay: true },
      { id: 'note', entries: ['note'], newDay: true },
      { id: 'photo-a', entries: ['photo-a', 'photo-b'], newDay: false },
      { id: 'rx', entries: ['rx'], newDay: false },
      { id: 'photo-c', entries: ['photo-c'], newDay: false },
      { id: 'photo-d', entries: ['photo-d'], newDay: true },
    ]);
  });

  it('keeps the chip’s kind only — a day’s photos then follow each other', () => {
    expect(shape('photo')).toEqual([
      { id: 'photo-a', entries: ['photo-a', 'photo-b', 'photo-c'], newDay: true },
      { id: 'photo-d', entries: ['photo-d'], newDay: true },
    ]);
  });
});

describe('activityCounts (H:4864)', () => {
  it('counts each chip’s records — All every one', () => {
    expect(activityCounts(ENTRIES)).toEqual({
      all: 7,
      visit: 1,
      rx: 1,
      treat: 0,
      inv: 0,
      pay: 0,
      photo: 4,
      note: 1,
    });
  });
});
