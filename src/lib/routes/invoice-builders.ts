/**
 * Route builders for the shared Invoice drawer's routes (KICKOFF §6.9, §4;
 * `S:92–94`) — `{ to, params }` for TanStack Router's typed `navigate` /
 * `Link`, like `builders.ts`. A module of their own, imported by path and never
 * through the `@/lib/routes/index.ts` barrel, which rides the entry chunk:
 * only the rooms that open an invoice and ⌘K go to these routes.
 */

/** New invoice; `?type=clinic|consultation|medical&patient=&from=` prefill it (`S:92`). */
export function organizationInvoiceCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/invoices/create',
    params: { organizationSlug },
  } as const;
}

/** An invoice's preview, with Print (`S:93`); `?from=` keeps the room that opened it. */
export function organizationInvoice(organizationSlug: string, invoiceId: string) {
  return {
    to: '/organization/$organizationSlug/invoices/$invoiceId',
    params: { organizationSlug, invoiceId },
  } as const;
}

/** Edit invoice (`S:94`); `?from=` keeps the room that opened it. */
export function organizationInvoiceEdit(organizationSlug: string, invoiceId: string) {
  return {
    to: '/organization/$organizationSlug/invoices/$invoiceId/edit',
    params: { organizationSlug, invoiceId },
  } as const;
}
