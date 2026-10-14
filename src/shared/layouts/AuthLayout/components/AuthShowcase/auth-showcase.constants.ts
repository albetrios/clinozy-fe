import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type AppIcon,
  Bell,
  Calendar,
  Clock,
  House,
  Palette,
  Phone,
  Receipt,
  Sparkles,
  SquareCheck,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * The showcase's namespace — `auth` — read from the registry: importing
 * `AUTH_NS` would pull the first-paint auth constants into this lazy chunk's
 * graph and re-split them.
 */
export const AUTH_SHOWCASE_NS = I18N_NAMESPACES.auth;

/**
 * The showcase's keys in the `auth` namespace (`showcase.*`). Kept here, not in
 * `AUTH_KEYS`: that table rides the first-paint chunk, and these belong to the
 * lazily loaded auth layout (the bundle budget's ratchet).
 */
export const AUTH_SHOWCASE_KEYS = {
  regionLabel: 'showcase.regionLabel',
  eyebrow: 'showcase.eyebrow',
  headline: 'showcase.headline',
  lead: 'showcase.lead',
  journey: {
    title: 'showcase.journey.title',
    live: 'showcase.journey.live',
    label: 'showcase.journey.label',
    stops: {
      enquiry: 'showcase.journey.stops.enquiry',
      booked: 'showcase.journey.stops.booked',
      waiting: 'showcase.journey.stops.waiting',
      withDoctor: 'showcase.journey.stops.withDoctor',
      treatment: 'showcase.journey.stops.treatment',
      checkout: 'showcase.journey.stops.checkout',
      followUp: 'showcase.journey.stops.followUp',
    },
  },
  moments: {
    label: 'showcase.moments.label',
    checkIn: {
      title: 'showcase.moments.checkIn.title',
      meta: 'showcase.moments.checkIn.meta',
    },
    followUp: {
      title: 'showcase.moments.followUp.title',
      meta: 'showcase.moments.followUp.meta',
    },
    invoice: {
      title: 'showcase.moments.invoice.title',
      meta: 'showcase.moments.invoice.meta',
    },
  },
  values: {
    label: 'showcase.values.label',
    inStep: {
      title: 'showcase.values.inStep.title',
      body: 'showcase.values.inStep.body',
    },
    nothingSlips: {
      title: 'showcase.values.nothingSlips.title',
      body: 'showcase.values.nothingSlips.body',
    },
    calm: { title: 'showcase.values.calm.title', body: 'showcase.values.calm.body' },
  },
  privacy: 'showcase.privacy',
} as const;

type ShowcaseKeys = typeof AUTH_SHOWCASE_KEYS;

/** The showcase's test ids (KICKOFF §6.4 of change-shell-polish-and-sign-in). */
export const AUTH_SHOWCASE_TEST_IDS = {
  hero: 'auth-showcase-hero',
  board: 'auth-showcase',
  journey: 'auth-showcase-journey',
  moments: 'auth-showcase-moments',
  values: 'auth-showcase-values',
  privacy: 'auth-showcase-privacy',
} as const;

/** One stop of the patient journey: its room's tone and icon. */
export interface JourneyStop {
  id: keyof ShowcaseKeys['journey']['stops'];
  tone: Tone;
  icon: AppIcon;
}

/**
 * The seven stops, each in the tone of the room that owns it (`SECTION_TONES`
 * and the Today lanes): Enquiry lav (Leads) · Booked sky (Appointments) ·
 * Waiting butter · With doctor blush · Treatment sage · Checkout peach
 * (Payments) · Follow-up plum (Tasks). Clockwise from the top of the dial, in
 * this order — `auth-showcase.css` places and times each by its `data-stop`
 * (AuthShowcase.test.tsx pins the two together).
 */
export const JOURNEY_STOPS: readonly JourneyStop[] = [
  { id: 'enquiry', tone: 'lav', icon: UserPlus },
  { id: 'booked', tone: 'sky', icon: Calendar },
  { id: 'waiting', tone: 'butter', icon: Clock },
  { id: 'withDoctor', tone: 'blush', icon: Stethoscope },
  { id: 'treatment', tone: 'sage', icon: Sparkles },
  { id: 'checkout', tone: 'peach', icon: Wallet },
  { id: 'followUp', tone: 'plum', icon: SquareCheck },
];

/** One "moment" card — an anonymous event from a clinic day (no names, no numbers: D11). */
export interface ShowcaseMoment {
  id: 'checkIn' | 'followUp' | 'invoice';
  tone: Tone;
  icon: AppIcon;
  /**
   * The stop that raises it: the card lifts and glows as the thread reaches
   * that stop (`auth-showcase.css` gives it the stop's `--stop`).
   */
  stop: JourneyStop['id'];
}

/**
 * An arrival (Today, sky) as the patient waits, a follow-up set (Tasks, plum)
 * at the last stop, an invoice settled (Payments, peach) at checkout.
 */
export const SHOWCASE_MOMENTS: readonly ShowcaseMoment[] = [
  { id: 'checkIn', tone: 'sky', icon: House, stop: 'waiting' },
  { id: 'followUp', tone: 'plum', icon: Phone, stop: 'followUp' },
  { id: 'invoice', tone: 'peach', icon: Receipt, stop: 'checkout' },
];

/** One value line: its tone, icon and copy. */
export interface ShowcaseValue {
  id: keyof Omit<ShowcaseKeys['values'], 'label'>;
  tone: Tone;
  icon: AppIcon;
}

/** Every room in step (lav) · nothing slips through (butter) · calm by design (sage). */
export const SHOWCASE_VALUES: readonly ShowcaseValue[] = [
  { id: 'inStep', tone: 'lav', icon: Users },
  { id: 'nothingSlips', tone: 'butter', icon: Bell },
  { id: 'calm', tone: 'sage', icon: Palette },
];
