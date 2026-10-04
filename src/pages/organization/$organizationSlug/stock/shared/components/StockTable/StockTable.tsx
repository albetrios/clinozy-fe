import { useTranslation } from 'react-i18next';

import type { StockTab } from '@/lib/routes/index.ts';
import { RoomTable, type RoomTableProps } from '@/shared/components/RoomTable/index.ts';
import { Package } from '@/shared/icons/index.ts';

import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../../../stock.constants.ts';

/** Props of {@link StockTable}: the shared room table's, named by the tab. */
export interface StockTableProps<TRow extends { id: string }> extends Omit<
  RoomTableProps<TRow>,
  'tableId' | 'label' | 'tone' | 'icon' | 'emptyHint' | 'exportCopy'
> {
  tab: StockTab;
}

/**
 * A Clinic stock tab's table (KICKOFF §6.8 Tables) — the shared room table in
 * the room's mint, its `Package` empty tile, the tab's table id and name, and
 * the room's words for the hint and Export.
 */
export function StockTable<TRow extends { id: string }>({
  tab,
  ...props
}: StockTableProps<TRow>) {
  const { t } = useTranslation(STOCK_NS);
  return (
    <RoomTable
      {...props}
      tableId={STOCK_TABLE_IDS[tab]}
      label={t(STOCK_KEYS.tabs[tab])}
      tone="mint"
      icon={<Package />}
      emptyHint={t(STOCK_KEYS.empty.hint)}
      exportCopy={{
        label: t(STOCK_KEYS.bulk.export),
        done: (count) => t(STOCK_KEYS.bulk.exported, { count }),
      }}
    />
  );
}
