import type { LeadInterest, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LeadRecord,
  LeadRecordSource,
} from '@/shared/api/clinic/leads-contracts.ts';
import { LEAD_INTEREST_TONES, toneForLabel } from '@/shared/clinic/clinic-tones.ts';
import {
  type AppIcon,
  House,
  InstagramMark,
  Phone,
  RefreshCw,
  Search,
  Users,
  WhatsAppMark,
} from '@/shared/icons/index.ts';

/**
 * Each source's icon (`SRCIC` / `SRC_SK`, H:3357, H:3360): the WhatsApp and
 * Instagram marks, `Search` for Google, `Users` for Facebook and Referral,
 * `House` for Walk-in, `RefreshCw` for Re-target — and `Phone` for the plan's
 * "Phone call" (the New lead preset, H:6159; Q-L6).
 */
export const LEAD_SOURCE_ICONS: Readonly<Record<LeadRecordSource, AppIcon>> = {
  instagram: InstagramMark,
  google: Search,
  whatsapp: WhatsAppMark,
  facebook: Users,
  walk_in: House,
  referral: Users,
  retarget: RefreshCw,
  phone_call: Phone,
};

/** The source chips in the design's order (`LSRC`, H:3348) and the plan's Phone call last (Q-L6). */
export const LEAD_SOURCE_ORDER = [
  'instagram',
  'google',
  'whatsapp',
  'facebook',
  'walk_in',
  'referral',
  'retarget',
  'phone_call',
] as const satisfies readonly LeadRecordSource[];

/** The interest chips (`LINT` without "Others", H:5722). */
export const LEAD_INTEREST_CHIPS = [
  'clinical',
  'peel',
  'lhr',
  'hydrafacial',
  'prp',
] as const satisfies readonly LeadInterest[];

/** One interest as a lead shows it: a contract interest, or one typed into "Add interest". */
export interface LeadInterestView {
  /** The contract value, or the typed text itself. */
  key: string;
  label: string;
  tone: Tone;
  custom: boolean;
}

/**
 * A lead's interests in the order they show: the contract's, then the typed
 * ones (`leads.md:64`) — each in its tone (`INTK`, H:3358), a typed one in the
 * design's hash tone.
 */
export function leadInterestViews(
  lead: Pick<LeadRecord, 'interests' | 'customInterests'>,
  labelOf: (interest: LeadInterest) => string,
): LeadInterestView[] {
  return [
    ...lead.interests.map((interest) => ({
      key: interest,
      label: labelOf(interest),
      tone: LEAD_INTEREST_TONES[interest],
      custom: false,
    })),
    ...lead.customInterests.map((interest) => ({
      key: interest,
      label: interest,
      tone: toneForLabel(interest),
      custom: true,
    })),
  ];
}
