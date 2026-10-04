import { describe, expect, it } from 'vitest';

import type { TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';

import { enquiry, floorRow, uuid } from './__tests__/integration/today-fixtures.ts';
import { TODAY_FLAG_TONES, todayCardFlags } from './today.flags.ts';
import { groupTodayLanes, type TodayCard } from './today.lanes.ts';

/** 10:42 in the clinic (IST) on the seed day. */
const NOW = new Date('2026-10-03T05:12:00.000Z');

/** The one card a single row makes. */
function cardOf(row: TodayFloorRow): TodayCard {
  const card = Object.values(groupTodayLanes([row], [])).flat()[0];
  if (!card) throw new Error('the row is off the floor');
  return card;
}

describe('todayCardFlags (today.md:59 — derived, never stored)', () => {
  it('marks an enquiry’s channel and a new lead', () => {
    const [anaya] = groupTodayLanes([], [enquiry()]).enquiries;
    const [kabir] = groupTodayLanes(
      [],
      [enquiry({ source: 'instagram', status: 'contacted' })],
    ).enquiries;
    const [google] = groupTodayLanes([], [enquiry({ source: 'google' })]).enquiries;
    if (!(anaya && kabir && google)) throw new Error('no enquiry card');
    expect(todayCardFlags(anaya, NOW)).toEqual([
      { id: 'channel', channel: 'whatsapp' },
      { id: 'newLead' },
    ]);
    expect(todayCardFlags(kabir, NOW)).toEqual([{ id: 'channel', channel: 'instagram' }]);
    expect(todayCardFlags(google, NOW)).toEqual([{ id: 'newLead' }]);
  });

  it('gives an arriving booking its person’s flags, then confirmed or not', () => {
    const priti = cardOf(
      floorRow({
        status: 'scheduled',
        firstVisit: true,
        pack: { used: 4, total: 6 },
        dueTotal: 120_000,
        allergies: ['Sulfa'],
      }),
    );
    expect(todayCardFlags(priti, NOW)).toEqual([
      { id: 'firstVisit' },
      { id: 'packLeft', left: 2 },
      { id: 'due', paise: 120_000 },
      { id: 'allergy', name: 'Sulfa' },
      { id: 'unconfirmed' },
    ]);
    expect(todayCardFlags(cardOf(floorRow({ status: 'confirmed' })), NOW)).toEqual([
      { id: 'confirmed' },
    ]);
  });

  it('counts the minutes waiting from the check-in, and in the room from the stage', () => {
    const waiting = cardOf(
      floorRow({ status: 'checked_in', checkedInAt: '2026-10-03T05:06:00.000Z' }),
    );
    expect(todayCardFlags(waiting, NOW)).toEqual([{ id: 'waiting', minutes: 6 }]);
    const moved = cardOf(
      floorRow({
        status: 'checked_in',
        checkedInAt: '2026-10-03T04:00:00.000Z',
        visit: { id: uuid(9), stage: 'waiting', stageAt: '2026-10-03T05:10:00.000Z' },
      }),
    );
    expect(todayCardFlags(moved, NOW)).toEqual([{ id: 'waiting', minutes: 2 }]);
    const sana = cardOf(
      floorRow({
        status: 'checked_in',
        allergies: ['Sulfa'],
        visit: { id: uuid(9), stage: 'with_doctor', stageAt: '2026-10-03T05:03:00.000Z' },
      }),
    );
    expect(todayCardFlags(sana, NOW)).toEqual([
      { id: 'allergy', name: 'Sulfa' },
      { id: 'inRoom', minutes: 9 },
    ]);
    // Moved a moment ago, before the clock: never below zero.
    const fresh = cardOf(
      floorRow({ status: 'checked_in', checkedInAt: '2026-10-03T06:00:00.000Z' }),
    );
    expect(todayCardFlags(fresh, NOW)).toEqual([{ id: 'waiting', minutes: 0 }]);
  });

  it('names the session, the bill and the approved Rx', () => {
    const inSession = (pack: TodayFloorRow['pack']) =>
      cardOf(
        floorRow({
          status: 'checked_in',
          pack,
          visit: { id: uuid(9), stage: 'treatment', stageAt: '2026-10-03T04:55:00.000Z' },
        }),
      );
    expect(todayCardFlags(inSession({ used: 3, total: 6 }), NOW)).toEqual([
      { id: 'session', number: 4, total: 6 },
    ]);
    expect(todayCardFlags(inSession(null), NOW)).toEqual([]);
    const checkout = (toPay: number) =>
      cardOf(
        floorRow({
          status: 'checked_in',
          toPay,
          visit: { id: uuid(9), stage: 'checkout', stageAt: '2026-10-03T05:00:00.000Z' },
        }),
      );
    expect(todayCardFlags(checkout(371_700), NOW)).toEqual([
      { id: 'toPay', paise: 371_700 },
    ]);
    expect(todayCardFlags(checkout(0), NOW)).toEqual([]);
    const pharmacy = cardOf(
      floorRow({
        status: 'completed',
        prescription: { id: uuid(8), approvedAt: '2026-10-03T04:35:00.000Z', items: 3 },
      }),
    );
    expect(todayCardFlags(pharmacy, NOW)).toEqual([{ id: 'rxApproved', time: '10:05' }]);
  });

  it('paints every flag in a tone', () => {
    expect(TODAY_FLAG_TONES).toMatchObject({
      channel: 'lav',
      confirmed: 'sage',
      unconfirmed: 'blush',
      firstVisit: 'sky',
      due: 'butter',
      rxApproved: 'mint',
    });
  });
});
