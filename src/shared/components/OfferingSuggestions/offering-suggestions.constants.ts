import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { SuggestionStatus, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** The card renders inside the org shell, so its copy lives in `clinic`. */
export const OFFERING_SUGGESTIONS_NS = I18N_NAMESPACES.clinic;

const STATUS_KEYS = (prefix: string): Readonly<Record<SuggestionStatus, string>> => ({
  planned: `${prefix}.planned`,
  accepted: `${prefix}.accepted`,
  next_time: `${prefix}.next_time`,
  declined: `${prefix}.declined`,
});

/** Key paths for the card's copy (`patient-file.md:515–517`, `appointments.md:270`). */
export const OFFERING_SUGGESTIONS_KEYS = {
  title: 'offeringSuggestions.title',
  /**
   * The header's sub line, joined with " · " — open: "<n> suggested · <n>
   * accepted · <n> past purchases"; closed: "<n> planned · <n> accepted ·
   * <n> ideas" (H:4376).
   */
  suggested: 'offeringSuggestions.suggested',
  planned: 'offeringSuggestions.planned',
  accepted: 'offeringSuggestions.accepted',
  pastPurchases: 'offeringSuggestions.pastPurchases',
  ideas: 'offeringSuggestions.ideas',
  /** The empty sub line: open, closed. */
  nothingSuggested: 'offeringSuggestions.nothingSuggested',
  noSuggestions: 'offeringSuggestions.noSuggestions',
  pricesHidden: 'offeringSuggestions.pricesHidden',
  /** "₹ ••••" while prices hide. */
  masked: 'offeringSuggestions.masked',
  /** The price box's "₹" before the figure (H:2809). */
  currency: 'offeringSuggestions.currency',
  pricesHiddenHint: 'offeringSuggestions.pricesHiddenHint',
  showPrices: 'offeringSuggestions.showPrices',
  hidePrices: 'offeringSuggestions.hidePrices',
  /** The total's line: "Saves <₹> on list · <₹> invoiced", either alone, or "At list price". */
  savesOnList: 'offeringSuggestions.savesOnList',
  invoicedAmount: 'offeringSuggestions.invoicedAmount',
  atListPrice: 'offeringSuggestions.atListPrice',
  columns: {
    suggested: 'offeringSuggestions.columns.suggested',
    qty: 'offeringSuggestions.columns.qty',
    price: 'offeringSuggestions.columns.price',
    status: 'offeringSuggestions.columns.status',
  },
  less: 'offeringSuggestions.less',
  more: 'offeringSuggestions.more',
  quantity: 'offeringSuggestions.quantity',
  finalPrice: 'offeringSuggestions.finalPrice',
  belowFloor: 'offeringSuggestions.belowFloor',
  tooMuchDiscount: 'offeringSuggestions.tooMuchDiscount',
  details: 'offeringSuggestions.details',
  statuses: STATUS_KEYS('offeringSuggestions.statuses'),
  statusHints: STATUS_KEYS('offeringSuggestions.statusHints'),
  /** "Status · <status>". */
  statusLabel: 'offeringSuggestions.statusLabel',
  invoiced: 'offeringSuggestions.invoiced',
  invoicedOf: 'offeringSuggestions.invoicedOf',
  linkInvoice: 'offeringSuggestions.linkInvoice',
  linkInvoiceHint: 'offeringSuggestions.linkInvoiceHint',
  remove: 'offeringSuggestions.remove',
  empty: 'offeringSuggestions.empty',
  whyIdea: 'offeringSuggestions.whyIdea',
  idea: 'offeringSuggestions.idea',
  add: 'offeringSuggestions.add',
  addNamed: 'offeringSuggestions.addNamed',
  addHint: 'offeringSuggestions.addHint',
  addOffering: 'offeringSuggestions.addOffering',
  purchasesTitle: 'offeringSuggestions.purchasesTitle',
  /** "<n> lines · <₹> paid so far". */
  purchasesSummary: 'offeringSuggestions.purchasesSummary',
  purchaseColumns: {
    date: 'offeringSuggestions.purchaseColumns.date',
    bought: 'offeringSuggestions.purchaseColumns.bought',
    qty: 'offeringSuggestions.purchaseColumns.qty',
    paid: 'offeringSuggestions.purchaseColumns.paid',
    sessions: 'offeringSuggestions.purchaseColumns.sessions',
    invoice: 'offeringSuggestions.purchaseColumns.invoice',
  },
  sessionsUsed: 'offeringSuggestions.sessionsUsed',
  activityTitle: 'offeringSuggestions.activityTitle',
  openChat: 'offeringSuggestions.openChat',
  activityColumns: {
    when: 'offeringSuggestions.activityColumns.when',
    channel: 'offeringSuggestions.activityColumns.channel',
    message: 'offeringSuggestions.activityColumns.message',
    status: 'offeringSuggestions.activityColumns.status',
  },
  sent: 'offeringSuggestions.sent',
  got: 'offeringSuggestions.got',
  /** Remove → the shared reason confirm (`patient-file.md:56`). */
  removeConfirm: {
    title: 'offeringSuggestions.removeConfirm.title',
    /** The grey pill under the title: "<name> from suggestions" (H:4353). */
    record: 'offeringSuggestions.removeConfirm.record',
    effect: 'offeringSuggestions.removeConfirm.effect',
    reasons: {
      addedByMistake: 'offeringSuggestions.removeConfirm.reasons.addedByMistake',
      duplicate: 'offeringSuggestions.removeConfirm.reasons.duplicate',
      planChanged: 'offeringSuggestions.removeConfirm.reasons.planChanged',
      other: 'offeringSuggestions.removeConfirm.reasons.other',
    },
  },
} as const;

/**
 * The rows' six tracks (H:2806) and their places; under 600px of card width a
 * row takes two lines — the name and the actions, then quantity · price ·
 * status · by — and the header row hides (H:420–422).
 */
export const SUGGESTION_GRID =
  'grid grid-cols-[minmax(0,1fr)_92px_112px_128px_28px_64px] items-center gap-2 px-3.5 [grid-template-areas:"n_q_p_st_by_act"] @max-[600px]:grid-cols-[auto_auto_minmax(0,1fr)_auto] @max-[600px]:gap-y-1.5 @max-[600px]:[grid-template-areas:"n_n_n_act""q_p_st_by"]';

/**
 * The card's rows size like the prototype's: a row's min-height is its
 * content's floor, with the padding and the 1px edge on top (`box-content`) —
 * a suggestion row 48 + 12 + 1 = 61px, an idea 53px, a purchase 45px, an
 * activity line 43px.
 */
export const ROW_FLOOR = 'box-content';

/** Each status's pill tone (`patient-file.md:53`): Planned sky, Accepted sage, Next time butter, Declined stone. */
export const SUGGESTION_STATUS_TONES: Readonly<Record<SuggestionStatus, Tone>> = {
  planned: 'sky',
  accepted: 'sage',
  next_time: 'butter',
  declined: 'stone',
};

/** `data-testid`s of the card. */
export const OFFERING_SUGGESTIONS_TEST_IDS = {
  card: 'offering-suggestions',
  toggle: 'offering-suggestions-toggle',
  prices: 'offering-suggestions-prices',
  row: 'offering-suggestions-row',
  idea: 'offering-suggestions-idea',
  addOffering: 'offering-suggestions-add',
  purchase: 'offering-suggestions-purchase',
  activity: 'offering-suggestions-activity',
} as const;
