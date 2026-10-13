/**
 * Route builders for the Payments room — the ledger, Pending and their drawers
 * (KICKOFF §6.9; `S:84–91`) — `{ to, params }` for TanStack Router's typed
 * `navigate` / `Link`, like `builders.ts`. A module of their own, imported by path
 * and never through the `@/lib/routes/index.ts` barrel, which rides the entry
 * chunk: only the code that goes to these routes loads them.
 */

/** The Payments room — the ledger itself (`S:84`, D24); its drawers open over it. */
export function organizationPayments(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments',
    params: { organizationSlug },
  } as const;
}

/** Receive payment over the ledger; `?patient=&invoice=&from=` prefill it (`S:85`). */
export function organizationPaymentReceive(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments/receive',
    params: { organizationSlug },
  } as const;
}

/** Send payment over the ledger; `?bill=md:<poId>|is:<purchaseId>` opens it on a bill (`S:86`). */
export function organizationPaymentPay(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments/pay',
    params: { organizationSlug },
  } as const;
}

/** An open-day entry's drawer over the ledger (`S:87`). */
export function organizationPaymentEdit(organizationSlug: string, paymentId: string) {
  return {
    to: '/organization/$organizationSlug/payments/$paymentId/edit',
    params: { organizationSlug, paymentId },
  } as const;
}

/** Day close over the ledger; `?date=YYYY-MM-DD&branch=` pick the day (`S:91`). */
export function organizationDayClose(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments/day-close',
    params: { organizationSlug },
  } as const;
}

/** Payments › Pending — the credits still to give back or take (`S:88`). */
export function organizationPaymentsPending(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments/pending',
    params: { organizationSlug },
  } as const;
}

/** Add pending over Pending; `?direction=give|take` picks Which way (`S:89`). */
export function organizationPendingCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/payments/pending/create',
    params: { organizationSlug },
  } as const;
}

/** An open credit's drawer over Pending (`S:90`). */
export function organizationPendingEdit(organizationSlug: string, creditId: string) {
  return {
    to: '/organization/$organizationSlug/payments/pending/$creditId/edit',
    params: { organizationSlug, creditId },
  } as const;
}
