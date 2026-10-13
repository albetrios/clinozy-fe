import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';

/** The Overview reads the patient file's namespace. */
export const TIMELINE_NS = I18N_NAMESPACES.patientFile;

/**
 * The Overview's copy (KICKOFF §6.6 Overview; H:769–779, H:4840–4864,
 * H:4980–4999), verbatim — reusing the file's own words where they are the
 * same (the section names, the rail's visit words, Team notes' lines).
 */
export const TIMELINE_KEYS = {
  /** "Open Clinical" — a card's ›. */
  open: 'timeline.open',
  cards: {
    clinical: 'sectionsPopover.groups.clinical',
    visits: 'sections.visits',
    photos: 'sections.images',
    packages: 'sections.packages',
    prescriptions: 'sections.prescriptions',
    treatments: 'sections.treatments',
    billing: 'sectionsPopover.groups.billing',
    reports: 'sections.reports',
    notes: 'sections.notes',
  },
  clinical: {
    groups: {
      complaints: 'clinical.titles.complaints',
      diagnosis: 'clinical.titles.diagnosis',
      treatmentSuggestions: 'timeline.clinical.suggested',
      futureSuggestions: 'timeline.clinical.later',
    },
    smartLabel: 'timeline.clinical.smartLabel',
    /** "Smart note · type naturally, e.g. {{example}}". */
    smartPlaceholder: 'timeline.clinical.smartPlaceholder',
    /** The placeholder's example in the UI language — one the note reads (L-64). */
    smartExample: 'timeline.clinical.smartExample',
    add: 'timeline.clinical.add',
    /** "3 items added from your note" (plural). */
    added: 'timeline.clinical.added',
    nothing: 'timeline.clinical.nothing',
  },
  visits: {
    book: 'rail.book',
    reschedule: 'rail.reschedule',
    empty: 'timeline.visits.empty',
  },
  photos: {
    upload: 'timeline.photos.upload',
    empty: 'timeline.photos.empty',
    albums: {
      general: 'photos.albums.general',
      private: 'photos.albums.private',
      lhr: 'photos.albums.lhr',
    },
  },
  packages: {
    /** "1 / 7". */
    progress: 'timeline.packages.progress',
    /** The server's `used_up`. */
    done: 'timeline.packages.done',
    /** The server's `expired`. */
    expired: 'package.card.statuses.expired',
    /** "Valid till 24 Sep 2027". */
    validTill: 'package.card.validTill',
    noExpiry: 'package.card.noExpiry',
    empty: 'timeline.packages.empty',
  },
  prescriptions: {
    new: 'section.primary.prescriptions',
    /** "Rx #500". */
    title: 'timeline.prescriptions.title',
    empty: 'tables.prescriptions.empty',
  },
  treatments: {
    new: 'section.primary.treatments',
    /** "Session 2 · 24 Sep 2026 · 15:00". */
    sub: 'timeline.treatments.sub',
    empty: 'tables.treatments.empty',
  },
  billing: {
    new: 'section.primary.invoices',
    due: 'timeline.billing.due',
    paid: 'timeline.billing.paid',
    /** "₹ ••••" — an amount while the file is masked (Q-F4). */
    masked: 'timeline.activity.masked',
    show: 'timeline.billing.show',
    hide: 'timeline.billing.hide',
    /** "Clinic invoice #1042". */
    invoice: 'timeline.billing.invoice',
    /** "24 Sep · ₹ ••••". */
    sub: 'timeline.billing.sub',
    collect: 'timeline.billing.collect',
    empty: 'tables.invoices.empty',
  },
  reports: {
    new: 'section.primary.reports',
    types: {
      lab: 'report.types.lab',
      scan: 'report.types.scan',
      consent: 'report.types.consent',
      other: 'report.types.other',
    },
    /** "Lab · 20 Sep". */
    sub: 'timeline.reports.sub',
    empty: 'tables.reports.empty',
  },
  notes: {
    label: 'timeline.notes.label',
    placeholder: 'timeline.notes.placeholder',
    post: 'timeline.notes.post',
    /** "Riya S. · 15:39". */
    by: 'notes.by',
    empty: 'notes.empty',
  },
  activity: {
    title: 'fileBar.activity',
    filtersLabel: 'timeline.activity.filtersLabel',
    /** The views — the stream's own filters (§6 #2). */
    filters: {
      all: 'feedback.types.all',
      clinical: 'sectionsPopover.groups.clinical',
      money: 'sectionsPopover.groups.billing',
      notes: 'timeline.activity.notes',
    },
    /** "₹ ••••" — an amount in the server's line while the file is masked (Q-F4). */
    masked: 'timeline.activity.masked',
    loadMore: 'feedback.loadMore',
    empty: 'timeline.activity.empty',
  },
} as const;

/** One bento card — in the grid's order (H:770–778). */
export type OverviewCard =
  | 'clinical'
  | 'visits'
  | 'photos'
  | 'packages'
  | 'prescriptions'
  | 'treatments'
  | 'billing'
  | 'reports'
  | 'notes';

/** Each card's own tone — the bento's, not the tab tones (H:4989–4999). */
export const OVERVIEW_CARD_TONES: Readonly<Record<OverviewCard, Tone>> = {
  clinical: 'sage',
  visits: 'sky',
  photos: 'blush',
  packages: 'lav',
  prescriptions: 'sage',
  treatments: 'lav',
  billing: 'butter',
  reports: 'stone',
  notes: 'butter',
};

/** The Overview's test ids. */
export const TIMELINE_TEST_IDS = {
  bento: 'overview-bento',
  /** A card: `overview-card-<card>`; its parts `-open`, `-new`, `-row`, `-empty`. */
  card: (card: OverviewCard) => `overview-card-${card}`,
  smartInput: 'overview-smart-note',
  smartAdd: 'overview-smart-note-add',
  noteInput: 'overview-note-input',
  notePost: 'overview-note-post',
  activity: 'overview-activity',
  /** The filter tabs' row. */
  filters: 'overview-activity-filters',
  /** A view tab: `overview-activity-filter-<view>`. */
  filter: (view: string) => `overview-activity-filter-${view}`,
  activityRow: 'overview-activity-row',
  /** "Load more" — the next page of the timeline. */
  activityMore: 'overview-activity-more',
} as const;
