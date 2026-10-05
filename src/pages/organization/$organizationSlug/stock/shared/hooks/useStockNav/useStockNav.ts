import { useNavigate, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';

import {
  organizationStockCheck,
  organizationStockCreate,
  organizationStockItemEdit,
  organizationStockPurchaseEdit,
  organizationStockTab,
  organizationStockVendorEdit,
  type StockCreateTab,
  type StockTab,
} from '@/lib/routes/stock-builders.ts';

import { type StockCreateSearch, validateStockSearch } from '../../../stock.search.ts';

/** The list params a dialog route keeps from its tab: the search, filters and sort. */
const listSearch = (current: Record<string, unknown>) => validateStockSearch(current);

/**
 * The Clinic stock family's navigation (KICKOFF §4, D24): each create and edit
 * dialog route over its own tab, and Stock check over Items — keeping the
 * tab's list params — and the close back onto a tab with nothing of the
 * drawer's.
 */
export function useStockNav() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });

  return useMemo(() => {
    const slug = organizationSlug;
    return {
      organizationSlug: slug,
      /** Back to a tab's list, keeping its search, filters and sort. */
      close: (tab: StockTab) =>
        void navigate({
          ...organizationStockTab(slug, tab),
          search: listSearch,
          hash: true,
          replace: true,
        }),
      /** A create drawer over its own tab, with its prefill. */
      create: (tab: StockCreateTab, search: StockCreateSearch = {}) =>
        void navigate({ ...organizationStockCreate(slug, tab), search }),
      itemEdit: (itemId: string) =>
        void navigate({ ...organizationStockItemEdit(slug, itemId), search: listSearch }),
      check: () => void navigate({ ...organizationStockCheck(slug), search: listSearch }),
      purchaseEdit: (purchaseId: string) =>
        void navigate({
          ...organizationStockPurchaseEdit(slug, purchaseId),
          search: listSearch,
        }),
      vendorEdit: (vendorId: string) =>
        void navigate({
          ...organizationStockVendorEdit(slug, vendorId),
          search: listSearch,
        }),
    };
  }, [navigate, organizationSlug]);
}
