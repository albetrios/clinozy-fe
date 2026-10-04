import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * Give back / Got it back live in `clinic`: Payments › Pending opens the
 * drawer, and so does the patient file's "₹500 to return" (KICKOFF §6.9).
 */
export const SETTLE_CREDIT_NS = I18N_NAMESPACES.clinic;

/** Key paths for the drawer (`payments.md:170–180, 254–266`; verbatim), by the credit's way. */
export const SETTLE_CREDIT_KEYS = {
  /** "Give back" / "Got it back". */
  title: { give: 'settleCredit.title.give', take: 'settleCredit.title.take' },
  /** "To Tanvi Shah · Charged twice · adds an Out entry to Payments" / "From … · adds an In entry …". */
  sub: { give: 'settleCredit.sub.give', take: 'settleCredit.sub.take' },
  /** "How it goes back" / "How it came in". */
  section: { give: 'settleCredit.section.give', take: 'settleCredit.section.take' },
  /** "Paid back by" / "Received as". */
  rows: { give: 'settleCredit.rows.give', take: 'settleCredit.rows.take' },
  /** "Add another mode" — the rows draw the "+". */
  add: 'settleCredit.add',
  /** "Total ₹500 · of ₹500". */
  total: 'settleCredit.total',
  /** "Return ₹500" / "Record ₹800". */
  save: { give: 'settleCredit.save.give', take: 'settleCredit.save.take' },
  /** "Enter the amount". */
  enterAmount: 'settleCredit.enterAmount',
  /** "More than the ₹500 owed". */
  moreThanOwed: 'settleCredit.moreThanOwed',
  /** "₹500 given back to Tanvi Shah · Out entry added" / "₹800 got back from … · In entry added". */
  done: { give: 'settleCredit.done.give', take: 'settleCredit.done.take' },
} as const;

/** The drawer's base test id; its parts derive theirs (`-save`, `-splits-row` …). */
export const SETTLE_CREDIT_TEST_ID = 'settle-credit-drawer';
