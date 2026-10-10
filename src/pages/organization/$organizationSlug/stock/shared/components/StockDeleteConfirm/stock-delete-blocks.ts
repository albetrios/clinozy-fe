import { useTranslation } from 'react-i18next';

import type {
  StockItemRecord,
  StockPurchaseRecord,
  StockVendorRecord,
} from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';

/*
 * Why clinozy-be refuses a Clinic stock delete (its `409` reasons): an item
 * with stock left, a purchase with money paid, a vendor still owed, or a
 * purchase whose received stock was used since. The first three are known
 * before asking — a row or drawer shows Delete only when it can go, or says
 * why — the last only from the refusal.
 */

/** Why clinozy-be refuses a delete — its `409` reasons. */
export type StockDeleteBlock =
  'item_has_stock' | 'purchase_paid' | 'vendor_has_dues' | 'not_enough_stock';

const K = STOCK_DRAWER_KEYS.confirm.blocked;

/** Each refusal's words. */
const BLOCK_KEYS: Readonly<Record<StockDeleteBlock, string>> = {
  item_has_stock: K.itemHasStock,
  purchase_paid: K.purchasePaid,
  vendor_has_dues: K.vendorHasDues,
  not_enough_stock: K.stockUsed,
};

/** Whether an API error reason is a delete refusal the room words itself. */
export const isStockDeleteBlock = (
  reason: string | undefined,
): reason is StockDeleteBlock =>
  reason !== undefined && Object.hasOwn(BLOCK_KEYS, reason);

/** An item's Delete is refused while anything is in stock — "Write it off first" (Adjust to 0). */
export const itemDeleteBlock = (
  item: Pick<StockItemRecord, 'qtyMilli'>,
): StockDeleteBlock | null => (item.qtyMilli > 0 ? 'item_has_stock' : null);

/** A purchase's Delete is refused once anything is paid on it. */
export const purchaseDeleteBlock = (
  purchase: Pick<StockPurchaseRecord, 'paid'>,
): StockDeleteBlock | null => (purchase.paid > 0 ? 'purchase_paid' : null);

/** A vendor's Delete is refused while a purchase still owes them. */
export const vendorDeleteBlock = (
  vendor: Pick<StockVendorRecord, 'payable'>,
): StockDeleteBlock | null => (vendor.payable > 0 ? 'vendor_has_dues' : null);

/**
 * The words for why a delete cannot go (`clinic-stock.md:34, 123`): "Only an
 * item with nothing in stock can be deleted — adjust it to 0 first", "Settle
 * this vendor’s purchases first" — for a disabled Delete's hint or the refusal.
 */
export function useStockDeleteBlockText(): (block: StockDeleteBlock) => string {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (block) => t(BLOCK_KEYS[block]);
}
