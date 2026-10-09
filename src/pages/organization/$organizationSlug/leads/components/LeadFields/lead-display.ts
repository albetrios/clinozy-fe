import type {
  LeadInterest,
  LeadSource,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import { LEAD_INTEREST_TONES } from '@/shared/clinic/clinic-tones.ts';
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
