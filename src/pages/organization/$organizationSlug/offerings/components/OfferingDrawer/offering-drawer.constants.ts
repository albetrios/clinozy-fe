import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Offering drawer's copy lives in the room's namespace: only this room opens it. */
export const OFFERING_DRAWER_NS = I18N_NAMESPACES.offerings;

/** Key paths for the Offering drawer (`offerings.md` › Forms, Popups, Copy; verbatim). */
export const OFFERING_DRAWER_KEYS = {
  title: {
    create: 'offeringDrawer.title.create',
    edit: 'offeringDrawer.title.edit',
  },
  /** "Used in bookings, invoices and packages". */
  sub: 'offeringDrawer.sub',
  quickFill: {
    single: 'offeringDrawer.quickFill.single',
    pack: 'offeringDrawer.quickFill.pack',
    lhr: 'offeringDrawer.quickFill.lhr',
    consultation: 'offeringDrawer.quickFill.consultation',
  },
  /** The step cards' titles — two steps, or three while an offer runs on it. */
  steps: {
    main: 'offeringDrawer.steps.main',
    timeDetails: 'offeringDrawer.steps.timeDetails',
    offersTime: 'offeringDrawer.steps.offersTime',
    details: 'offeringDrawer.steps.details',
  },
  /** The 11px section labels inside the steps. */
  groups: {
    offering: 'offeringDrawer.groups.offering',
    price: 'offeringDrawer.groups.price',
    offers: 'offeringDrawer.groups.offers',
    time: 'offeringDrawer.groups.time',
    details: 'offeringDrawer.groups.details',
  },
  fields: {
    name: 'offeringDrawer.fields.name',
    namePlaceholder: 'offeringDrawer.fields.namePlaceholder',
    category: 'offeringDrawer.fields.category',
    colour: 'offeringDrawer.fields.colour',
    colourHint: 'offeringDrawer.fields.colourHint',
    availableAt: 'offeringDrawer.fields.availableAt',
    availableAtHint: 'offeringDrawer.fields.availableAtHint',
    price: 'offeringDrawer.fields.price',
    priceHint: 'offeringDrawer.fields.priceHint',
    offerPrice: 'offeringDrawer.fields.offerPrice',
    offerPriceHint: 'offeringDrawer.fields.offerPriceHint',
    /** "what you bill · 17% below list" once the offer price is under the price. */
    offerPriceBelow: 'offeringDrawer.fields.offerPriceBelow',
    sessions: 'offeringDrawer.fields.sessions',
    sessionsHint: 'offeringDrawer.fields.sessionsHint',
    gstRate: 'offeringDrawer.fields.gstRate',
    gst: 'offeringDrawer.fields.gst',
    gstInclusive: 'offeringDrawer.fields.gstInclusive',
    gstExclusive: 'offeringDrawer.fields.gstExclusive',
    floor: 'offeringDrawer.fields.floor',
    floorShown: 'offeringDrawer.fields.floorShown',
    floorHidden: 'offeringDrawer.fields.floorHidden',
    floorHint: 'offeringDrawer.fields.floorHint',
    billedToday: 'offeringDrawer.fields.billedToday',
    /** "+1 free session" (plural) — a Billed today part. */
    freeSessions: 'offeringDrawer.fields.freeSessions',
    /** "17% below list" — a Billed today part. */
    belowList: 'offeringDrawer.fields.belowList',
    duration: 'offeringDrawer.fields.duration',
    /** "45m" — a Duration quick pick. */
    durationQuick: 'offeringDrawer.fields.durationQuick',
    minutesUnit: 'offeringDrawer.fields.minutesUnit',
    validity: 'offeringDrawer.fields.validity',
    validityHint: 'offeringDrawer.fields.validityHint',
    daysUnit: 'offeringDrawer.fields.daysUnit',
    /** "120 days" (plural) — a Validity no quick pick names, in a step head. */
    days: 'offeringDrawer.fields.days',
    validityQuick: {
      none: 'offeringDrawer.fields.validityQuick.none',
      quarter: 'offeringDrawer.fields.validityQuick.quarter',
      half: 'offeringDrawer.fields.validityQuick.half',
      year: 'offeringDrawer.fields.validityQuick.year',
    },
    searchTerms: 'offeringDrawer.fields.searchTerms',
    searchTermsHint: 'offeringDrawer.fields.searchTermsHint',
    searchTermsPlaceholder: 'offeringDrawer.fields.searchTermsPlaceholder',
    description: 'offeringDrawer.fields.description',
    descriptionPlaceholder: 'offeringDrawer.fields.descriptionPlaceholder',
    status: 'offeringDrawer.fields.status',
    active: 'offeringDrawer.fields.active',
    inactive: 'offeringDrawer.fields.inactive',
  },
  /** "+1 session · Running · till 31 Oct 2026" — the end of an offer on this. */
  offerTill: 'offeringDrawer.offerTill',
  /** The footer summary's name before one is typed: "Untitled · Treatment". */
  untitled: 'offeringDrawer.untitled',
  save: {
    create: 'offeringDrawer.save.create',
    edit: 'offeringDrawer.save.edit',
    createAnother: 'offeringDrawer.save.createAnother',
  },
  /** The save's toasts (H:5507): what is missing, then the price rules. */
  toasts: {
    addName: 'offeringDrawer.toasts.addName',
    addPrice: 'offeringDrawer.toasts.addPrice',
    offerAbovePrice: 'offeringDrawer.toasts.offerAbovePrice',
    floorAboveOffer: 'offeringDrawer.toasts.floorAboveOffer',
  },
} as const;

/** The drawer's root test id; its parts derive theirs (`offering-drawer-save` …). */
export const OFFERING_DRAWER_TEST_ID = 'offering-drawer';
