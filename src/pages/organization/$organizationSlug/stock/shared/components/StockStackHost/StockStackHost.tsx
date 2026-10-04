import type { StockStack } from '../../hooks/useStockStack/index.ts';
import {
  STOCK_DRAWER_TEST_IDS,
  STOCK_STACKED_SUFFIX,
} from '../../stock-drawers.constants.ts';
import { StockNewItemDrawer } from '../StockItemDrawer/index.ts';
import { StockVendorDrawer } from '../StockVendorDrawer/index.ts';

/**
 * Clinic stock's stacked child (KICKOFF §6.8 Stacked drawers;
 * `clinic-stock.md:275–287`): the record a picker's "New clinic vendor · “q”" /
 * "New clinic item · “q”" + "full details" asked for — a vendor at 560px, an
 * item at 680px — on top of the open drawer with its own backdrop, named from
 * the picker's text. "Back", ×, the backdrop and Esc close only the child (the
 * top layer, so Esc reaches it first); its save selects the new record in the
 * field that asked.
 */
export function StockStackHost({ stack }: { stack: StockStack }) {
  const child = stack.last;
  if (!child) return null;
  const open = stack.child !== null;
  if (child.kind === 'vendor') {
    return (
      <StockVendorDrawer
        mode="create"
        open={open}
        onClose={stack.close}
        stacked
        prefill={{ name: child.query }}
        onSaved={stack.complete}
        testId={`${STOCK_DRAWER_TEST_IDS.vendor}${STOCK_STACKED_SUFFIX}`}
      />
    );
  }
  return (
    <StockNewItemDrawer
      open={open}
      onClose={stack.close}
      name={child.query}
      vendorId={child.vendorId}
      onSaved={stack.complete}
    />
  );
}
