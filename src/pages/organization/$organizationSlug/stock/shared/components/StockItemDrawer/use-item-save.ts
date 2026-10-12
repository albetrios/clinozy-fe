import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { notify } from '@/shared/notify/index.ts';

import { fetchStockItem, stockQueryKeys } from '../../stock-api.ts';
import type { StockItemRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import type { StockItemFormValues } from './stock-item-form.ts';

/*
 * What the item drawers do with clinozy-be's answers to a save: a field the
 * API names goes on the field the form calls it, a name already taken goes on
 * Name, and a save over someone else's (`409 record_changed`) reads the item
 * again.
 */

/**
 * The API's item fields (as the shared mapper camel-cases them) by the form's
 * names: `size_per_unit` is "Contents per …", `opening_quantity` — and an
 * edit's Adjust `quantity` — is In stock.
 */
export const ITEM_SERVER_FIELDS: Readonly<Record<string, keyof StockItemFormValues>> = {
  sizePerUnit: 'contents',
  measureUnit: 'measure',
  minQuantity: 'minQty',
  maxQuantity: 'maxQty',
  usagePerWeek: 'usage',
  stockVendorId: 'vendorId',
  openingQuantity: 'inStock',
  quantity: 'inStock',
};

/**
 * A refused item save (`409`): a name another item has (`record_already_exists`,
 * any case) goes on Name with the room's words; any other refusal is the
 * server's.
 */
export function useItemConflict(
  form: UseFormReturn<StockItemFormValues>,
  openNameStep: () => void,
) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (error: HttpError) => {
    if (apiErrorReason(error) !== 'record_already_exists') {
      notifyError(error);
      return;
    }
    const message = t(STOCK_DRAWER_KEYS.item.nameTaken);
    form.setError('name', { type: 'server', message });
    openNameStep();
    notify.error(message);
  };
}

/**
 * The item an Edit item drawer saves against, read again — a save refused as stale (`409
 * record_changed`, the toast's "Reload") starts the form over on what was saved.
 */
export const readStockItem = (item: StockItemRow, organizationId: string | null) => ({
  queryKey: stockQueryKeys.item(organizationId, item.id),
  queryFn: () => fetchStockItem(item.id),
});
