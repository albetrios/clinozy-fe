import { describe, expect, it } from 'vitest';

import type { TodayFloorRow } from '@/shared/api/clinic/today-contracts.ts';

import { enquiry, floorRow, publicId } from './__tests__/integration/today-fixtures.ts';
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

  it('marks an arriving booking confirmed or not', () => {
    expect(todayCardFlags(cardOf(floorRow({ status: 'scheduled' })), NOW)).toEqual([
      { id: 'unconfirmed' },
    ]);
    expect(todayCardFlags(cardOf(floorRow({ status: 'confirmed' })), NOW)).toEqual([
      { id: 'confirmed' },
    ]);
  });

  it('counts the minutes waiting and in the room from the stage, else from the check-in', () => {
    const waiting = cardOf(
      floorRow({ status: 'checked_in', checkedInAt: '2026-10-03T05:06:00.000Z' }),
    );
    expect(todayCardFlags(waiting, NOW)).toEqual([{ id: 'waiting', minutes: 6 }]);
    const stamped = cardOf(
      floorRow({
        status: 'checked_in',
        checkedInAt: '2026-10-03T04:00:00.000Z',
        visitStage: 'waiting',
        visitStageChangedAt: '2026-10-03T05:10:00.000Z',
      }),
    );
    expect(todayCardFlags(stamped, NOW)).toEqual([{ id: 'waiting', minutes: 2 }]);
    const sana = cardOf(
      floorRow({
        status: 'checked_in',
        visitStage: 'with_doctor',
        visitStageChangedAt: '2026-10-03T05:03:00.000Z',
      }),
    );
    expect(todayCardFlags(sana, NOW)).toEqual([{ id: 'inRoom', minutes: 9 }]);
    // Moved a moment ago, before the clock: never below zero.
    const fresh = cardOf(
      floorRow({ status: 'checked_in', checkedInAt: '2026-10-03T06:00:00.000Z' }),
    );
    expect(todayCardFlags(fresh, NOW)).toEqual([{ id: 'waiting', minutes: 0 }]);
  });

  it('names the approved Rx at the pharmacy; Treatment and Checkout carry none', () => {
    const atStage = (visitStage: TodayFloorRow['visitStage']) =>
      cardOf(floorRow({ status: 'checked_in', visitStage }));
    expect(todayCardFlags(atStage('treatment'), NOW)).toEqual([]);
    expect(todayCardFlags(atStage('checkout'), NOW)).toEqual([]);
    expect(todayCardFlags(atStage('pharmacy'), NOW)).toEqual([]);
    const pharmacy = cardOf(
      floorRow({
        status: 'checked_in',
        visitStage: 'pharmacy',
        prescription: {
          id: publicId('rx', 8),
          patientId: publicId('pat', 2),
          approvedAt: '2026-10-03T04:35:00.000Z',
          items: 3,
        },
      }),
    );
    expect(todayCardFlags(pharmacy, NOW)).toEqual([{ id: 'rxApproved', time: '10:05' }]);
  });

  it('paints every flag in a tone', () => {
    expect(TODAY_FLAG_TONES).toEqual({
      channel: 'lav',
      newLead: 'lav',
      confirmed: 'sage',
      unconfirmed: 'blush',
      waiting: 'butter',
      inRoom: 'blush',
      rxApproved: 'mint',
    });
  });
});
