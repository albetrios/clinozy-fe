/**
 * Route builders for the Offerings room — its two tabs and their drawers (KICKOFF
 * §6.11; `S:98–103`) — `{ to, params }` for TanStack Router's typed `navigate` /
 * `Link`, like `builders.ts`. A module of their own, imported by path and never
 * through the `@/lib/routes/index.ts` barrel, which rides the entry chunk: only
 * the code that goes to these routes loads them.
 */

/** The Offerings room's Offerings tab — the list the Offering drawer opens over. */
export function organizationOfferings(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings',
    params: { organizationSlug },
  } as const;
}

/** The New offering drawer over the list; `?name=` prefills it (`S:99`). */
export function organizationOfferingCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/create',
    params: { organizationSlug },
  } as const;
}

/** One offering's drawer over the list — Edit offering, view only without Edit (`S:100`). */
export function organizationOfferingEdit(organizationSlug: string, offeringId: string) {
  return {
    to: '/organization/$organizationSlug/offerings/$offeringId/edit',
    params: { organizationSlug, offeringId },
  } as const;
}

/** The Offerings room's Offers tab — a page of its own beside the Offerings tab (`S:101`). */
export function organizationOffers(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers',
    params: { organizationSlug },
  } as const;
}

/** The New offer drawer over the Offers tab (`S:102`). */
export function organizationOfferCreate(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers/create',
    params: { organizationSlug },
  } as const;
}

/** One offer's drawer over the Offers tab — Edit offer, view only without Edit (`S:103`). */
export function organizationOfferEdit(organizationSlug: string, offerId: string) {
  return {
    to: '/organization/$organizationSlug/offerings/offers/$offerId/edit',
    params: { organizationSlug, offerId },
  } as const;
}
