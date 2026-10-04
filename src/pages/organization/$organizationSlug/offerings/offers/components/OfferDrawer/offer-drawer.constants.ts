import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Offer drawer's copy lives in the room's namespace: only the Offers tab opens it. */
export const OFFER_DRAWER_NS = I18N_NAMESPACES.offerings;

/** Key paths for the Offer drawer (`offerings.md` › Forms, Popups, Copy; verbatim). */
export const OFFER_DRAWER_KEYS = {
  title: {
    create: 'offerDrawer.title.create',
    edit: 'offerDrawer.title.edit',
  },
  /** "A limited-time price on one or more offerings · applies by itself". */
  sub: 'offerDrawer.sub',
  /** The badge and the footer's name before one is typed. */
  untitled: 'offerDrawer.untitled',
  steps: {
    offer: 'offerDrawer.steps.offer',
    where: 'offerDrawer.steps.where',
    notes: 'offerDrawer.steps.notes',
  },
  fields: {
    name: 'offerDrawer.fields.name',
    namePlaceholder: 'offerDrawer.fields.namePlaceholder',
    code: 'offerDrawer.fields.code',
    codeHint: 'offerDrawer.fields.codeHint',
    codePlaceholder: 'offerDrawer.fields.codePlaceholder',
    type: 'offerDrawer.fields.type',
    /** The value field's label per kind: Discount · Amount off · Offer price · Free sessions. */
    value: {
      percent: 'offerDrawer.fields.value.percent',
      amount: 'offerDrawer.fields.value.amount',
      fixed: 'offerDrawer.fields.value.fixed',
      extra: 'offerDrawer.fields.value.extra',
    },
    /** "20%" — a Discount quick pick. */
    percentQuick: 'offerDrawer.fields.percentQuick',
    /** The Free sessions stepper's unit. */
    sessionsUnit: 'offerDrawer.fields.sessionsUnit',
    colour: 'offerDrawer.fields.colour',
    colourHint: 'offerDrawer.fields.colourHint',
    offerings: 'offerDrawer.fields.offerings',
    offeringsHint: 'offerDrawer.fields.offeringsHint',
    offeringsSearch: 'offerDrawer.fields.offeringsSearch',
    branches: 'offerDrawer.fields.branches',
    branchesHint: 'offerDrawer.fields.branchesHint',
    starts: 'offerDrawer.fields.starts',
    ends: 'offerDrawer.fields.ends',
    /** "₹1,200 → ₹1,080" — a preview of the offer on one offering. */
    previewPrice: 'offerDrawer.fields.previewPrice',
    /** "2 → 3 sessions" (plural on the after count). */
    previewSessions: 'offerDrawer.fields.previewSessions',
    note: 'offerDrawer.fields.note',
    notePlaceholder: 'offerDrawer.fields.notePlaceholder',
    status: 'offerDrawer.fields.status',
    live: 'offerDrawer.fields.live',
    paused: 'offerDrawer.fields.paused',
  },
  /** "3 offerings" in the footer summary (plural). */
  offeringCount: 'offerDrawer.offeringCount',
  save: {
    create: 'offerDrawer.save.create',
    edit: 'offerDrawer.save.edit',
  },
  /** The save's toasts (H:5521). */
  toasts: {
    name: 'offerDrawer.toasts.name',
    offerings: 'offerDrawer.toasts.offerings',
    value: {
      percent: 'offerDrawer.toasts.value.percent',
      amount: 'offerDrawer.toasts.value.amount',
      fixed: 'offerDrawer.toasts.value.fixed',
      extra: 'offerDrawer.toasts.value.extra',
    },
    endsBeforeStart: 'offerDrawer.toasts.endsBeforeStart',
  },
} as const;

/** The drawer's root test id; its parts derive theirs (`offer-drawer-save` …). */
export const OFFER_DRAWER_TEST_ID = 'offer-drawer';
