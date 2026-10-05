/**
 * Route builders for the Clinic stock room — its tabs and their drawers (KICKOFF
 * §6.8; `S:72–83`) — `{ to, params }` for TanStack Router's typed `navigate` /
 * `Link`, like `builders.ts`. A module of their own, imported by path and never
 * through the `@/lib/routes/index.ts` barrel, which rides the entry chunk: only
 * the code that goes to these routes loads them.
 */

/** The Clinic stock room's tabs (D24), each a literal child route (`S:72–83`; Vendors Q-K1). */
const STOCK_TAB_PATHS = {
  items: '/organization/$organizationSlug/stock/items',
  purchases: '/organization/$organizationSlug/stock/purchases',
  movements: '/organization/$organizationSlug/stock/movements',
  vendors: '/organization/$organizationSlug/stock/vendors',
} as const;

/** One Clinic stock tab. */
export type StockTab = keyof typeof STOCK_TAB_PATHS;

/** A Clinic stock tab's page — the list its dialogs open over. */
export function organizationStockTab(organizationSlug: string, tab: StockTab) {
  return { to: STOCK_TAB_PATHS[tab], params: { organizationSlug } } as const;
}

/** The Clinic stock tabs with a create dialog route (`S:74, S:79, S:82`). */
const STOCK_CREATE_PATHS = {
  items: '/organization/$organizationSlug/stock/items/create',
  purchases: '/organization/$organizationSlug/stock/purchases/create',
  vendors: '/organization/$organizationSlug/stock/vendors/create',
} as const;

/** A Clinic stock tab with a create dialog route. */
export type StockCreateTab = keyof typeof STOCK_CREATE_PATHS;

/** A Clinic stock create drawer over its own tab: New item, New purchase, New clinic vendor. */
export function organizationStockCreate(organizationSlug: string, tab: StockCreateTab) {
  return { to: STOCK_CREATE_PATHS[tab], params: { organizationSlug } } as const;
}

/** Edit item over Clinic stock › Items (`S:75`). */
export function organizationStockItemEdit(organizationSlug: string, itemId: string) {
  return {
    to: '/organization/$organizationSlug/stock/items/$itemId/edit',
    params: { organizationSlug, itemId },
  } as const;
}

/** Stock check over Clinic stock › Items (`S:76`). */
export function organizationStockCheck(organizationSlug: string) {
  return {
    to: '/organization/$organizationSlug/stock/items/check',
    params: { organizationSlug },
  } as const;
}

/** Edit purchase over Clinic stock › Purchases (`S:80`). */
export function organizationStockPurchaseEdit(
  organizationSlug: string,
  purchaseId: string,
) {
  return {
    to: '/organization/$organizationSlug/stock/purchases/$purchaseId/edit',
    params: { organizationSlug, purchaseId },
  } as const;
}

/** Edit clinic vendor over Clinic stock › Vendors (`S:83`). */
export function organizationStockVendorEdit(organizationSlug: string, vendorId: string) {
  return {
    to: '/organization/$organizationSlug/stock/vendors/$vendorId/edit',
    params: { organizationSlug, vendorId },
  } as const;
}
