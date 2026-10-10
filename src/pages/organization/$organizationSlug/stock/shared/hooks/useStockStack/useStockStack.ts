import {
  type StackedRequests,
  useStackedRequest,
} from '@/shared/hooks/useStackedDrawer/index.ts';

import type { StockItemRecord, StockVendorRecord } from '../../stock-contracts.ts';

/**
 * A picker's "New clinic vendor · “q”" / "New clinic item · “q”" + "full
 * details" (`clinic-stock.md:118, 149, 275–287`): which record opens on top,
 * named from the picker's text, and the field its save selects it in.
 */
export type StockStackRequest =
  | { kind: 'vendor'; query: string; onCreated: (record: StockVendorRecord) => void }
  | {
      kind: 'item';
      query: string;
      /** The purchase's vendor, the new item's supplier. */
      vendorId?: string | null;
      onCreated: (record: StockItemRecord) => void;
    };

/** What a stacked child saves. */
export type StockStackRecord = StockVendorRecord | StockItemRecord;

/** How a drawer asks for a stacked child; without it the pickers offer no "full details". */
export type OpenStockChild = (request: StockStackRequest) => void;

/** What {@link useStockStack} hands the page that hosts the drawers. */
export type StockStack = StackedRequests<StockStackRequest, StockStackRecord>;

/**
 * Clinic stock's stacked child (KICKOFF §6.8 Stacked drawers; `S:116` —
 * component state, no URL), on the shared {@link useStackedRequest}: one child
 * at a time over the open drawer — a clinic vendor or a clinic item — named
 * from the picker's text; its save selects the new record in the field that
 * asked.
 */
export function useStockStack(): StockStack {
  return useStackedRequest<StockStackRequest, StockStackRecord>();
}
