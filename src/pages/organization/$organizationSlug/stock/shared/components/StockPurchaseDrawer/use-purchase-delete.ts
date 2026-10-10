import { notify } from '@/shared/notify/index.ts';

import type { StockPurchaseRecord } from '../../stock-contracts.ts';
import {
  purchaseDeleteBlock,
  useStockDeleteBlockText,
} from '../StockDeleteConfirm/index.ts';

/**
 * A purchase's red Delete — the row's and the drawer's: only an unpaid
 * purchase goes (`409 purchase_paid`), so one with money paid on it says why
 * instead of asking; an unpaid one asks for the reason (`ask`).
 */
export function usePurchaseDelete<T extends Pick<StockPurchaseRecord, 'paid'>>(
  ask: (purchase: T) => void,
): (purchase: T) => void {
  const blockText = useStockDeleteBlockText();
  return (purchase) => {
    const block = purchaseDeleteBlock(purchase);
    if (block) notify.info(blockText(block));
    else ask(purchase);
  };
}
