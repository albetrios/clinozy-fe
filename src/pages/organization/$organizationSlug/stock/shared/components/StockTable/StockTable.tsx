import { useTranslation } from 'react-i18next';

import type { StockTab } from '@/lib/routes/stock-builders.ts';
import { RoomTable, type RoomTableProps } from '@/shared/components/RoomTable/index.ts';
import {
  type AppIcon,
  ArrowUpDown,
  Package,
  ShoppingCart,
  Truck,
} from '@/shared/icons/index.ts';

import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../../../stock.constants.ts';

/** Exporting a stock table's rows (the bulk bar's Export) — every tab's. */
const STOCK_EXPORT_CODE = 'stock_item:export';

/** Each tab's own empty-state glyph (change-empty-states R28–R31), in the room's mint. */
const STOCK_EMPTY_ICONS: Readonly<Record<StockTab, AppIcon>> = {
  items: Package,
  purchases: ShoppingCart,
  movements: ArrowUpDown,
  vendors: Truck,
};

/** Props of {@link StockTable}: the shared room table's, named by the tab. */
export interface StockTableProps<TRow extends { id: string }> extends Omit<
  RoomTableProps<TRow>,
  'tableId' | 'label' | 'tone' | 'icon' | 'emptyHint' | 'exportCopy' | 'exportCode'
> {
  tab: StockTab;
}

/**
 * A Clinic stock tab's table (KICKOFF §6.8 Tables) — the shared room table in
 * the room's mint, the tab's own empty tile (a cart for Purchases, arrows for
 * Movements, …; change-empty-states), the tab's table id and name, the
 * room's words for the hint and Export, and Export on clinozy-be's
 * `stock_item:export`.
 */
export function StockTable<TRow extends { id: string }>({
  tab,
  ...props
}: StockTableProps<TRow>) {
  const { t } = useTranslation(STOCK_NS);
  const EmptyIcon = STOCK_EMPTY_ICONS[tab];
  return (
    <RoomTable
      {...props}
      tableId={STOCK_TABLE_IDS[tab]}
      label={t(STOCK_KEYS.tabs[tab])}
      tone="mint"
      icon={<EmptyIcon />}
      emptyHint={t(STOCK_KEYS.empty.hint)}
      exportCode={STOCK_EXPORT_CODE}
      exportCopy={{
        label: t(STOCK_KEYS.bulk.export),
        done: (count) => t(STOCK_KEYS.bulk.exported, { count }),
      }}
    />
  );
}
