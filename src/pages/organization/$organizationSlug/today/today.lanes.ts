/**
 * What Today derives from the floor (KICKOFF §6.2; `today.md:7, 19–46`): the
 * lanes and their cards, the role focus, the default lane, each tile's faces
 * and hint, and the pulse. Pure, so each rule is tested apart from React.
 */
import type { Role, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicClockTime } from '@/shared/api/clinic/clinic-time.ts';
import {
  TODAY_LANES,
  type TodayEnquiry,
  type TodayFloorRow,
  type TodayLane,
  todayLaneOf,
} from '@/shared/api/clinic/today-contracts.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';

import type { TodayCardAction } from './today.constants.ts';

/** The tones the lanes paint in. */
export type TodayLaneTone = Extract<
  Tone,
  'lav' | 'sky' | 'butter' | 'blush' | 'sage' | 'mint'
>;

/** A lane's tone and its cards' action (`today.md:38–46`); null — no action. */
export interface TodayLaneMeta {
  tone: TodayLaneTone;
  action: TodayCardAction | null;
}

/**
 * Each lane's tone and card action: Enquiries lav "Book" · Arriving sky
 * "Check in" · Waiting butter "Send in" · With doctor blush, no action (the
 * consult is the patient page's, L-64) · Treatment sage "Open session" ·
 * Checkout butter "Checkout" · Pharmacy mint "Dispense".
 */
export const TODAY_LANE_META: Readonly<Record<TodayLane, TodayLaneMeta>> = {
  enquiries: { tone: 'lav', action: 'book' },
  arriving: { tone: 'sky', action: 'checkIn' },
  waiting: { tone: 'butter', action: 'sendIn' },
  with_doctor: { tone: 'blush', action: null },
  treatment: { tone: 'sage', action: 'openSession' },
  checkout: { tone: 'butter', action: 'checkout' },
  pharmacy: { tone: 'mint', action: 'dispense' },
};

/**
 * A tile's own paint beyond the tone's (`TONE_CLASSES`), as full literals so
 * Tailwind sees each: the pressed border in the lane's ink, hover inking the
 * border at once (no transition, `today.md:35`), and a face's ring in the
 * lane's fill. Out of the member's focus the fill, its border and the faces'
 * ring take the design's 60% (`dimFill`, `dimBorder`, `dimFace`) — the
 * surface only; the text recedes on AA-safe steps instead (`LaneTiles`).
 */
export const LANE_TILE_TONES: Readonly<
  Record<
    TodayLaneTone,
    {
      ink: string;
      hover: string;
      face: string;
      dimFill: string;
      dimBorder: string;
      dimFace: string;
    }
  >
> = {
  lav: {
    ink: 'border-tone-lav-foreground',
    hover: 'hover:border-tone-lav-foreground',
    face: 'border-tone-lav',
    dimFill: 'bg-tone-lav/60',
    dimBorder: 'border-tone-lav-border/60',
    dimFace: 'border-tone-lav/60',
  },
  sky: {
    ink: 'border-tone-sky-foreground',
    hover: 'hover:border-tone-sky-foreground',
    face: 'border-tone-sky',
    dimFill: 'bg-tone-sky/60',
    dimBorder: 'border-tone-sky-border/60',
    dimFace: 'border-tone-sky/60',
  },
  butter: {
    ink: 'border-tone-butter-foreground',
    hover: 'hover:border-tone-butter-foreground',
    face: 'border-tone-butter',
    dimFill: 'bg-tone-butter/60',
    dimBorder: 'border-tone-butter-border/60',
    dimFace: 'border-tone-butter/60',
  },
  blush: {
    ink: 'border-tone-blush-foreground',
    hover: 'hover:border-tone-blush-foreground',
    face: 'border-tone-blush',
    dimFill: 'bg-tone-blush/60',
    dimBorder: 'border-tone-blush-border/60',
    dimFace: 'border-tone-blush/60',
  },
  sage: {
    ink: 'border-tone-sage-foreground',
    hover: 'hover:border-tone-sage-foreground',
    face: 'border-tone-sage',
    dimFill: 'bg-tone-sage/60',
    dimBorder: 'border-tone-sage-border/60',
    dimFace: 'border-tone-sage/60',
  },
  mint: {
    ink: 'border-tone-mint-foreground',
    hover: 'hover:border-tone-mint-foreground',
    face: 'border-tone-mint',
    dimFill: 'bg-tone-mint/60',
    dimBorder: 'border-tone-mint-border/60',
    dimFace: 'border-tone-mint/60',
  },
};

/**
 * The lanes each clinic role keeps an eye on (`today.md:7`; H:2981–2989): Front
 * desk the door to the till, Doctor the waiting room and the consult, Therapist
 * the session, Counsellor the consult and checkout, Pharmacist the pharmacy,
 * Accountant checkout, Marketing the enquiries — Owner and Admin none, so
 * nothing dims for them.
 */
export const TODAY_ROLE_FOCUS: Readonly<Record<Role, readonly TodayLane[]>> = {
  front_desk: ['enquiries', 'arriving', 'waiting', 'checkout'],
  doctor: ['waiting', 'with_doctor'],
  therapist: ['treatment'],
  counsellor: ['with_doctor', 'checkout'],
  pharmacist: ['pharmacy'],
  accountant: ['checkout'],
  marketing: ['enquiries'],
  owner: [],
  admin: [],
};

/**
 * The member's focus: the union of their clinic roles' lanes (roles add up) —
 * the View-as role alone while previewing. Empty means nothing is dimmed.
 */
export function todayFocus(roles: readonly Role[]): ReadonlySet<TodayLane> {
  return new Set(roles.flatMap((role) => TODAY_ROLE_FOCUS[role]));
}

/** Whether a lane sits at full strength — every lane does when the focus is empty. */
export function isLaneInFocus(lane: TodayLane, focus: ReadonlySet<TodayLane>): boolean {
  return focus.size === 0 || focus.has(lane);
}

/** One card on the floor: a booking (its row) or an open enquiry. */
export type TodayCard =
  | {
      kind: 'booking';
      id: string;
      lane: TodayLane;
      name: string;
      /** Clinic-local `HH:mm` — the booking's start. */
      time: string;
      row: TodayFloorRow;
    }
  | {
      kind: 'enquiry';
      id: string;
      lane: 'enquiries';
      name: string;
      /** Clinic-local `HH:mm` — when they last wrote. */
      time: string;
      enquiry: TodayEnquiry;
    };

/** The floor as lanes: every lane (empty ones too), each lane's cards by time. */
export type TodayLanes = Readonly<Record<TodayLane, readonly TodayCard[]>>;

const byTime = (a: TodayCard, b: TodayCard) =>
  a.time.localeCompare(b.time) || a.name.localeCompare(b.name);

/**
 * Group the floor (`listTodayFloor`, by start time) and today's enquiries into
 * the seven lanes. A booking off the floor is dropped (D20: no Done lane).
 */
export function groupTodayLanes(
  rows: readonly TodayFloorRow[],
  enquiries: readonly TodayEnquiry[],
): TodayLanes {
  const lanes = Object.fromEntries(
    TODAY_LANES.map((lane) => [lane, [] as TodayCard[]]),
  ) as Record<TodayLane, TodayCard[]>;
  for (const enquiry of enquiries) {
    lanes.enquiries.push({
      kind: 'enquiry',
      id: enquiry.id,
      lane: 'enquiries',
      name: enquiry.name,
      time: clinicClockTime(new Date(enquiry.askedAt)),
      enquiry,
    });
  }
  for (const row of rows) {
    const lane = todayLaneOf(row);
    if (!lane || lane === 'enquiries') continue;
    lanes[lane].push({
      kind: 'booking',
      id: row.id,
      lane,
      name: row.person.name,
      time: row.startTime,
      row,
    });
  }
  for (const lane of TODAY_LANES) lanes[lane].sort(byTime);
  return lanes;
}

/**
 * The lane the panel shows when the member picked none (`today.md:35`): the
 * first lane in their focus that has people, else the first lane with people,
 * else Enquiries.
 */
export function defaultTodayLane(
  lanes: TodayLanes,
  focus: ReadonlySet<TodayLane>,
): TodayLane {
  return (
    TODAY_LANES.find((lane) => focus.has(lane) && lanes[lane].length > 0) ??
    TODAY_LANES.find((lane) => lanes[lane].length > 0) ??
    'enquiries'
  );
}

/** A tile's hint: what kind, and the earliest card's clinic-local time. */
export interface TodayLaneHint {
  kind: 'oldest' | 'next' | 'since';
  time: string;
}

/**
 * A tile's hint (`today.md:33`): Enquiries "oldest HH:mm", Arriving "next
 * HH:mm", every other lane "since HH:mm" — the earliest card's time; none for
 * an empty lane ("—").
 */
export function laneHint(
  lane: TodayLane,
  cards: readonly TodayCard[],
): TodayLaneHint | null {
  const earliest = cards.map((card) => card.time).sort()[0];
  if (earliest === undefined) return null;
  if (lane === 'enquiries') return { kind: 'oldest', time: earliest };
  if (lane === 'arriving') return { kind: 'next', time: earliest };
  return { kind: 'since', time: earliest };
}

/** A tile's faces: up to four initials discs, then how many more. */
const LANE_FACES_MAX = 4;

/** The faces row (`today.md:32`): the first four cards' initials, and "+N" for the rest. */
export function laneFaces(cards: readonly TodayCard[]): {
  faces: { id: string; initials: string }[];
  more: number;
} {
  return {
    faces: cards
      .slice(0, LANE_FACES_MAX)
      .map((card) => ({ id: card.id, initials: personInitials(card.name) })),
    more: Math.max(0, cards.length - LANE_FACES_MAX),
  };
}

/** The lanes "in clinic" counts: everyone checked in and not yet gone (`today.md:220`). */
const IN_CLINIC: readonly TodayLane[] = [
  'waiting',
  'with_doctor',
  'treatment',
  'checkout',
  'pharmacy',
];

/** The pulse's counts — in clinic, waiting, arriving (`todayPulse`, S:1578, derived). */
export function todayPulse(lanes: TodayLanes): {
  inClinic: number;
  waiting: number;
  arriving: number;
} {
  return {
    inClinic: IN_CLINIC.reduce((sum, lane) => sum + lanes[lane].length, 0),
    waiting: lanes.waiting.length,
    arriving: lanes.arriving.length,
  };
}
