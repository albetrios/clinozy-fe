import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  ContactActivityEntry,
  ContactActivityFilter,
  ContactActivityLinkKind,
} from '@/shared/api/clinic/contact-activities-api.ts';
import {
  type AppIcon,
  Calendar,
  Camera,
  CheckCircle,
  ClipboardList,
  FileIcon,
  MessageSquare,
  Package,
  Pill,
  Receipt,
  Sparkles,
  Star,
  Stethoscope,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * The timeline's views (§6 #2): the design's kinds (visits, Rx, treatments, invoices,
 * payments, photos, notes) kept only where the stream's own filters reach them — the record
 * events of one `group` (Clinical, Billing) or the `note` entries; "All" is both.
 */
const ACTIVITY_VIEWS = ['all', 'clinical', 'money', 'notes'] as const;

/** One view of the timeline. */
export type ActivityView = (typeof ACTIVITY_VIEWS)[number];

/** Each view's tab icon and its tone's ink while open; "All" is spelled out. */
export const ACTIVITY_VIEW_LOOKS: Readonly<
  Record<Exclude<ActivityView, 'all'>, { icon: AppIcon; tone: Tone }>
> = {
  clinical: { icon: Stethoscope, tone: 'sage' },
  money: { icon: Receipt, tone: 'butter' },
  notes: { icon: MessageSquare, tone: 'stone' },
};

/**
 * What a view asks the stream for. The person's conversation — messages and calls — is the
 * Activity column's, so the timeline reads the server's record events and the team's notes;
 * without billing view the money group stays out ("All" names the other groups — the server
 * already leaves out what the member's own codes may not read, M10, but a View-as preview
 * reads with the previewer's).
 */
export function activityViewFilter(
  view: ActivityView,
  { billing }: { billing: boolean },
): ContactActivityFilter {
  switch (view) {
    case 'clinical':
      return { group: ['clinical'] };
    case 'money':
      return { group: ['money'] };
    case 'notes':
      return { type: ['note'] };
    case 'all':
      return billing
        ? { type: ['system', 'note'] }
        : { type: ['system', 'note'], group: ['clinical', 'messages', 'tasks'] };
  }
}

/** The views a member has: Billing only with billing view. */
export function activityViews({ billing }: { billing: boolean }): ActivityView[] {
  return ACTIVITY_VIEWS.filter((view) => view !== 'money' || billing);
}

/** Each linked record's icon and tone — the row's tile (H:4844 `TLI`, H:4841). */
const LINK_LOOKS: Readonly<
  Record<ContactActivityLinkKind, { icon: AppIcon; tone: Tone }>
> = {
  appointment: { icon: Calendar, tone: 'sky' },
  prescription: { icon: Pill, tone: 'sage' },
  treatment: { icon: Sparkles, tone: 'lav' },
  clinicalNote: { icon: Stethoscope, tone: 'sage' },
  checkIn: { icon: MessageSquare, tone: 'sage' },
  review: { icon: Star, tone: 'butter' },
  image: { icon: Camera, tone: 'blush' },
  report: { icon: FileIcon, tone: 'stone' },
  invoice: { icon: Receipt, tone: 'butter' },
  payment: { icon: Wallet, tone: 'mint' },
  offering: { icon: Package, tone: 'lav' },
  task: { icon: CheckCircle, tone: 'plum' },
};

/** A row's tile: its record's look, a note's, or the plain one of an event with no record. */
export function activityLook(entry: ContactActivityEntry): { icon: AppIcon; tone: Tone } {
  if (entry.type === 'note') return ACTIVITY_VIEW_LOOKS.notes;
  return entry.link
    ? LINK_LOOKS[entry.link.kind]
    : { icon: ClipboardList, tone: 'stone' };
}

/** A rupee amount in the server's words ("₹9,794.00", "₹ 500"). */
const RUPEES = /₹ ?\d[\d,.]*/g;

/** The server's line with each rupee amount masked (Q-F4: money follows the file's mask). */
export function maskedBody(body: string, masked: string): string {
  return body.replaceAll(RUPEES, masked);
}

/** One row of the timeline: an entry and whether it starts a new day (its heading above). */
export interface ActivityRow {
  entry: ContactActivityEntry;
  day: string;
  newDay: boolean;
}

/** The rows under their days (H:4852–4862) — the read's order, newest first. */
export function activityRows(
  entries: readonly ContactActivityEntry[],
  dayOf: (instant: string) => string,
): ActivityRow[] {
  return entries.map((entry, index) => {
    const day = dayOf(entry.occurredAt);
    const previous = entries[index - 1];
    return {
      entry,
      day,
      newDay: !previous || dayOf(previous.occurredAt) !== day,
    };
  });
}
