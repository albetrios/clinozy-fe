import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Offerings room's namespace, as its Offers tab reads it. */
export const OFFERS_NS = I18N_NAMESPACES.offerings;

/**
 * The Offers tab's copy, verbatim from `offerings.md` › Copy (KICKOFF §6.11
 * Offers tab). Kinds and states are the shared clinic vocabulary.
 */
export const OFFERS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** "Offer" — the record a stale link names: "Offer not found · it may have been deleted". */
  record: 'offers.record',
  columns: {
    offer: 'offers.columns.offer',
    type: 'offers.columns.type',
    appliesTo: 'offers.columns.appliesTo',
    branches: 'offers.columns.branches',
    valid: 'offers.columns.valid',
    status: 'offers.columns.status',
    updated: 'offers.columns.updated',
  },
  table: {
    /** "All offers loaded". */
    records: 'offers.table.records',
  },
  cells: {
    /** " +1" — the offerings past the first two. */
    more: 'offers.cells.more',
    /** "22 Sep 2026 – 2 Oct 2026". */
    range: 'offers.cells.range',
    /** A blank start. */
    now: 'offers.cells.now',
    /** A blank end. */
    noEnd: 'offers.cells.noEnd',
    endsToday: 'offers.cells.endsToday',
    endsTomorrow: 'offers.cells.endsTomorrow',
    /** "Ends in 28 days" (plural). */
    endsIn: 'offers.cells.endsIn',
    /** "Starts 1 Nov 2026". */
    startsOn: 'offers.cells.startsOn',
    /** An ended offer. */
    over: 'offers.cells.over',
    /** Applies to once every offering it named was deleted (OFFERINGS-M4). */
    noOfferings: 'offers.cells.noOfferings',
  },
  rowActions: {
    edit: 'offers.rowActions.edit',
    pause: 'offers.rowActions.pause',
    resume: 'offers.rowActions.resume',
    delete: 'offers.rowActions.delete',
  },
  bulk: {
    export: 'offers.bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'offers.bulk.exported',
  },
  empty: {
    title: 'offers.empty.title',
    description: 'offers.empty.description',
    /** The empty list's action. */
    newOffer: 'offers.empty.newOffer',
  },
} as const;

/** The Offers table's id: the test-id prefix and the device prefs' key. */
export const OFFERS_TABLE_ID = 'offers';

/**
 * The clinozy-be permission code each offer action needs (research §7; `/app/offers` routes):
 * offers share the offerings' codes (O2) — reading them is `organization:read`, the room's gate.
 */
export const OFFER_PERMISSIONS = {
  /** New offer. */
  create: 'offering:create',
  /** Edit, Pause and Resume. */
  update: 'offering:update',
  /** Delete, and the toast's Undo (restore). */
  delete: 'offering:delete',
  /** Export the selected rows — no offers export route; the offerings' code (research §7). */
  export: 'offering:export',
} as const satisfies Readonly<Record<string, OrganizationPermission>>;
