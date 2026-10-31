import type {
  LeadInterest,
  LeadSource,
  LeadStatus,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import { LEAD_INTEREST_TONES } from '@/shared/app/app-tones.ts';
import {
  type AppIcon,
  House,
  InstagramMark,
  RefreshCw,
  Search,
  Users,
  WhatsAppMark,
} from '@/shared/icons/index.ts';

/**
 * Each source's icon (`SRCIC` / `SRC_SK`, H:3357, H:3360): the WhatsApp and
 * Instagram marks, `Search` for Google, `Users` for Facebook and Referral,
 * `House` for Walk-in, `RefreshCw` for Re-target. The design's "Phone call"
 * went with the backend (route map §4).
 */
export const LEAD_SOURCE_ICONS: Readonly<Record<LeadSource, AppIcon>> = {
  instagram: InstagramMark,
  google: Search,
  whatsapp: WhatsAppMark,
  facebook: Users,
  walk_in: House,
  referral: Users,
  retarget: RefreshCw,
};

/**
 * The progress track's steps, in order (H:1810): Booked is the person's bookings'
 * step (clinozy-be L11), Clinic visited the check-in's.
 */
export const LEAD_TRACK_STATUSES = [
  'new',
  'contacted',
  'follow_up',
  'appointment_scheduled',
  'clinic_visited',
] as const satisfies readonly LeadStatus[];

/**
 * Every status in the pipeline's order (the Status filter): the track's steps, then No response
 * and the closes (H:1811).
 */
export const LEAD_STATUS_ORDER = [
  ...LEAD_TRACK_STATUSES,
  'no_response',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadStatus[];

/** The source chips in the design's order (`LSRC`, H:3348). */
export const LEAD_SOURCE_ORDER = [
  'instagram',
  'google',
  'whatsapp',
  'facebook',
  'walk_in',
  'referral',
  'retarget',
] as const satisfies readonly LeadSource[];

/**
 * The interest chips (`LINT`, H:5722) — "Others" last, where the design's "Add interest" stood:
 * the API keeps no typed interest (route map §4).
 */
export const LEAD_INTEREST_CHIPS = [
  'clinical',
  'peel',
  'lhr',
  'hydrafacial',
  'prp',
  'others',
] as const satisfies readonly LeadInterest[];

/** One interest as a lead shows it. */
export interface LeadInterestView {
  key: LeadInterest;
  label: string;
  tone: Tone;
}

/**
 * A lead's interests in the order they show, each in its tone (`INTK`, H:3358). The design's
 * typed interests went with the backend (route map §4): "Others" stands for them.
 */
export function leadInterestViews(
  interests: readonly LeadInterest[],
  labelOf: (interest: LeadInterest) => string,
): LeadInterestView[] {
  return interests.map((interest) => ({
    key: interest,
    label: labelOf(interest),
    tone: LEAD_INTEREST_TONES[interest],
  }));
}
