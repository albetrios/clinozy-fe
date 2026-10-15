import { describe, expect, it } from 'vitest';

import { TODAY_LANES, type TodayLane } from '@/shared/api/app/today-contracts.ts';

import { enquiry, floorRow, publicId } from './__tests__/integration/today-fixtures.ts';
import {
  todayAttention,
  todayAttentionItem,
  todayLaneAlerts,
} from './today.attention.ts';
import { groupTodayLanes, type TodayCard, todayFocus } from './today.lanes.ts';

/** 10:42 in the clinic (IST) on the seed day. */
const NOW = new Date('2026-10-03T05:12:00.000Z');

/** An instant `minutes` before NOW. */
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const id = (n: number) => publicId('appt', n);

/** A floor where every lane has someone, some of them past a mark. */
const LANES = groupTodayLanes(
  [
    // Arriving: 18 minutes late (hot), 7 late (warm), due in 6 (soon), due at 13:00 (nothing).
    floorRow({ id: id(1), name: 'Rahul Mehta', startTime: '10:24' }),
    floorRow({ id: id(2), name: 'Kavya Rao', startTime: '10:35' }),
    floorRow({ id: id(3), name: 'Ishaan Sen', startTime: '10:48' }),
    floorRow({ id: id(4), name: 'Tara Iyer', startTime: '13:00' }),
    // Waiting: 32 min (hot), 16 (warm), 4 (nothing).
    floorRow({
      id: id(5),
      name: 'Ananya Rao',
      status: 'checked_in',
      checkedInAt: ago(32),
    }),
    floorRow({
      id: id(6),
      name: 'Dev Kapoor',
      status: 'checked_in',
      checkedInAt: ago(16),
    }),
    floorRow({ id: id(7), name: 'Neha Shah', status: 'checked_in', checkedInAt: ago(4) }),
    // With doctor: 50 min (hot) and 10 (nothing).
    floorRow({
      id: id(8),
      name: 'Om Prakash',
      status: 'checked_in',
      visitStage: 'with_doctor',
      visitStageChangedAt: ago(50),
    }),
    floorRow({
      id: id(9),
      name: 'Zoya Ali',
      status: 'checked_in',
      visitStage: 'with_doctor',
      visitStageChangedAt: ago(10),
    }),
    // Treatment never needs anyone from here.
    floorRow({
      id: id(10),
      name: 'Arjun Das',
      status: 'checked_in',
      visitStage: 'treatment',
      visitStageChangedAt: ago(90),
    }),
    // Checkout 8 min; Pharmacy with an Rx approved 12 min ago, and one without.
    floorRow({
      id: id(11),
      name: 'Priya Shah',
      contactId: publicId('con', 11),
      status: 'checked_in',
      visitStage: 'checkout',
      visitStageChangedAt: ago(9),
    }),
    floorRow({
      id: id(12),
      name: 'Sara Khan',
      status: 'checked_in',
      visitStage: 'pharmacy',
      visitStageChangedAt: ago(3),
      prescription: {
        id: publicId('rx', 12),
        patientId: publicId('pat', 12),
        approvedAt: ago(12),
        items: 2,
      },
    }),
    floorRow({
      id: id(13),
      name: 'Vikram Rao',
      status: 'checked_in',
      visitStage: 'pharmacy',
    }),
  ],
  [
    // No reply for 2.5 h (hot), 40 min (warm), 10 min (nothing).
    enquiry({ id: publicId('lead', 1), name: 'Anaya Desai', lastActivityAt: ago(150) }),
    enquiry({ id: publicId('lead', 2), name: 'Kabir Bose', lastActivityAt: ago(40) }),
    enquiry({ id: publicId('lead', 3), name: 'Mira Nair', lastActivityAt: ago(10) }),
  ],
);

const ALL = new Set<TodayLane>();
const names = (cards: readonly { card: TodayCard }[]) =>
  cards.map(({ card }) => card.name);

describe('todayAttention (change-today-command-center — Needs you now)', () => {
  it('ranks hot, then warm, then soon; furthest along its own clock first, nearest start first', () => {
    const items = todayAttention({
      lanes: LANES,
      now: NOW,
      dues: new Map([[publicId('con', 11), 1500]]),
      focus: ALL,
      visible: TODAY_LANES,
    });
    // Minutes over each kind's hot mark: reply 150/120, late 18/15, in room 50/45, waiting 32/30;
    // Rx 12/15, checkout 9/15, waiting 16/30, late 7/15, reply 40/120.
    expect(
      items.map(({ card, kind, tier, minutes }) => [card.name, kind, tier, minutes]),
    ).toEqual([
      ['Anaya Desai', 'reply', 'hot', 150],
      ['Rahul Mehta', 'late', 'hot', 18],
      ['Om Prakash', 'inRoom', 'hot', 50],
      ['Ananya Rao', 'waiting', 'hot', 32],
      ['Sara Khan', 'rx', 'warm', 12],
      ['Priya Shah', 'checkout', 'warm', 9],
      ['Dev Kapoor', 'waiting', 'warm', 16],
      ['Kavya Rao', 'late', 'warm', 7],
      ['Kabir Bose', 'reply', 'warm', 40],
      ['Ishaan Sen', 'due', 'soon', 6],
    ]);
    expect(items.find((item) => item.kind === 'checkout')?.rupees).toBe(1500);
  });

  it('lists only the member’s focus lanes, among the lanes they read', () => {
    const frontDesk = todayAttention({
      lanes: LANES,
      now: NOW,
      focus: todayFocus(['front_desk']),
      visible: TODAY_LANES,
    });
    expect(new Set(frontDesk.map(({ card }) => card.lane))).toEqual(
      new Set(['enquiries', 'arriving', 'waiting', 'checkout']),
    );
    // No bills read: the checkout item says no amount.
    expect(frontDesk.find((item) => item.kind === 'checkout')?.rupees).toBeNull();

    const marketing = todayAttention({
      lanes: LANES,
      now: NOW,
      focus: ALL,
      visible: ['enquiries'],
    });
    expect(names(marketing)).toEqual(['Anaya Desai', 'Kabir Bose']);
  });

  it('puts someone waiting in the clinic before an older unanswered message', () => {
    const lanes = groupTodayLanes(
      [
        floorRow({
          id: id(1),
          name: 'Bhamini Talwar',
          status: 'checked_in',
          checkedInAt: ago(53),
        }),
      ],
      [
        enquiry({
          id: publicId('lead', 2),
          name: 'Agrata Kakkar',
          lastActivityAt: ago(150),
        }),
      ],
    );
    expect(
      names(todayAttention({ lanes, now: NOW, focus: ALL, visible: TODAY_LANES })),
    ).toEqual(['Bhamini Talwar', 'Agrata Kakkar']);
  });

  it('is empty on a calm floor', () => {
    const calm = groupTodayLanes(
      [
        floorRow({ startTime: '12:00' }),
        floorRow({ id: id(2), status: 'checked_in', checkedInAt: ago(2) }),
      ],
      [enquiry({ lastActivityAt: ago(5) })],
    );
    expect(
      todayAttention({ lanes: calm, now: NOW, focus: ALL, visible: TODAY_LANES }),
    ).toEqual([]);
  });

  it('reads due as 0 at the start, and never a minute below zero', () => {
    const [onTime] = groupTodayLanes([floorRow({ startTime: '10:40' })], []).arriving;
    if (!onTime) throw new Error('no card');
    expect(todayAttentionItem(onTime, NOW)).toMatchObject({ kind: 'due', minutes: 0 });
  });
});

describe('todayLaneAlerts (the journey strip’s badges)', () => {
  it('counts the late, long-waiting, long-in-room and unanswered people — hot when any is', () => {
    expect(todayLaneAlerts(LANES, NOW)).toEqual({
      enquiries: { kind: 'reply', count: 2, hot: true },
      arriving: { kind: 'late', count: 2, hot: true },
      waiting: { kind: 'waiting', count: 2, hot: true },
      with_doctor: { kind: 'inRoom', count: 1, hot: true },
    });
  });

  it('never badges a due arrival, checkout or an Rx; warm alone is not hot', () => {
    const lanes = groupTodayLanes(
      [
        floorRow({ startTime: '10:35' }),
        floorRow({ id: id(2), startTime: '10:48' }),
        floorRow({
          id: id(3),
          status: 'checked_in',
          visitStage: 'checkout',
          visitStageChangedAt: ago(40),
        }),
      ],
      [],
    );
    expect(todayLaneAlerts(lanes, NOW)).toEqual({
      arriving: { kind: 'late', count: 1, hot: false },
    });
  });
});
