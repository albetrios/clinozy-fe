import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The Payment received view lives in `app`: Payments, the patient file, Invoices and Pending
 * credits all open a drawer that ends in it (`feat-payment-celebration` D2, D9).
 */
export const PAYMENT_RECEIVED_NS = I18N_NAMESPACES.app;

/** Key paths for the view and its review ask. */
export const PAYMENT_RECEIVED_KEYS = {
  /** The drawer's title once the money is in: "Payment received". */
  title: 'paymentReceived.title',
  /** "₹2,000 received". */
  amount: 'paymentReceived.amount',
  /** "from Bhooshan Patel". */
  from: 'paymentReceived.from',
  /** "Cash + UPI · PAY-5512". */
  meta: 'paymentReceived.meta',
  /** What the money did: an invoice paid in full, part of it, an advance, a credit. */
  outcome: {
    paid: 'paymentReceived.outcome.paid',
    due: 'paymentReceived.outcome.due',
    advance: 'paymentReceived.outcome.advance',
    creditSettled: 'paymentReceived.outcome.creditSettled',
    creditLeft: 'paymentReceived.outcome.creditLeft',
  },
  /** The footer: "Saved to Payments" and the primary "Done". */
  summary: 'paymentReceived.summary',
  done: 'paymentReceived.done',
  reviews: {
    /** "Ask Bhooshan for a Google review". */
    askTitle: 'paymentReceived.reviews.askTitle',
    /** Why now: "The visit is fresh — the best moment to ask." */
    askBody: 'paymentReceived.reviews.askBody',
    send: 'paymentReceived.reviews.send',
    sending: 'paymentReceived.reviews.sending',
    /** "Queued in Bhooshan's chat" — the outbox, never "sent" (D12). */
    queued: 'paymentReceived.reviews.queued',
    /** The queue refused it: the button stays, the line says so. */
    failed: 'paymentReceived.reviews.failed',
    log: 'paymentReceived.reviews.log',
    /** The branch has no Google review link: for those who can add it, and for the rest. */
    noLink: 'paymentReceived.reviews.noLink',
    addLink: 'paymentReceived.reviews.addLink',
    askAdmin: 'paymentReceived.reviews.askAdmin',
    /** "Reviewed on Google · 5★ · 3 Oct" (and without a rating). */
    thanked: 'paymentReceived.reviews.thanked',
    thankedNoRating: 'paymentReceived.reviews.thankedNoRating',
    previous: 'paymentReceived.reviews.previous',
    /** "All 7 reviews". */
    all: 'paymentReceived.reviews.all',
    needsCall: 'paymentReceived.reviews.needsCall',
    /** The stars' name for a screen reader: "Rated 4 of 5". */
    rated: 'paymentReceived.reviews.rated',
  },
} as const;

/** Test ids: the view, its parts and the review ask. */
export const PAYMENT_RECEIVED_TEST_IDS = {
  view: 'payment-received',
  animation: 'payment-received-animation',
  amount: 'payment-received-amount',
  outcome: 'payment-received-outcome',
  reviews: 'payment-received-reviews',
  ask: 'payment-received-ask',
  send: 'payment-received-send',
  log: 'payment-received-log',
  addLink: 'payment-received-add-link',
  thanked: 'payment-received-thanked',
  review: 'payment-received-review',
  all: 'payment-received-all-reviews',
} as const;

/** How many previous reviews the view lists before "All N reviews". */
export const PAYMENT_RECEIVED_REVIEW_LIMIT = 3;
