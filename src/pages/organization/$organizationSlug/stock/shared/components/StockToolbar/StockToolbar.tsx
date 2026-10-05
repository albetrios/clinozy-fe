'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve it
// stale answers (see `DataTable.tsx`).

import type { ReactTable, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { organizationStockTab, type StockTab } from '@/lib/routes/stock-builders.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  RoomTabs,
  RoomToolbar,
  type RoomToolbarFilters,
  RoomViewAction,
} from '@/shared/components/RoomToolbar/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  type AppIcon,
  ClipboardList,
  Package,
  Receipt,
  RefreshCw,
  Users,
} from '@/shared/icons/index.ts';

import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../../../stock.constants.ts';
import { useStockAccess } from '../../hooks/useStockAccess/index.ts';
import { useStockNav } from '../../hooks/useStockNav/index.ts';

/** The four tabs in the prototype's order (H:5280), Vendors last (Q-K1). */
const STOCK_TABS: readonly { id: StockTab; icon: AppIcon }[] = [
  { id: 'items', icon: Package },
  { id: 'purchases', icon: Receipt },
  { id: 'movements', icon: RefreshCw },
  { id: 'vendors', icon: Users },
];

/** Each tab's "+ New …" (H:5305); Movements has none. */
const PRIMARY_CREATE = {
  items: STOCK_KEYS.create.item,
  purchases: STOCK_KEYS.create.purchase,
  vendors: STOCK_KEYS.create.vendor,
} as const;

/** Props of {@link StockToolbar}. */
export interface StockToolbarProps<TRow extends RowData> {
  /** The tab on screen. */
  tab: StockTab;
  /** The tab's table — the Columns chooser drives its column visibility. */
  table?: ReactTable<DataTableFeatures, TRow>;
  /** The tab's Filters. */
  filters?: RoomToolbarFilters;
}

/**
 * The Clinic stock toolbar (KICKOFF §6.8 Toolbar; `clinic-stock.md:17`) on the
 * shared room toolbar: h1 "Clinic stock" · the four tabs, every one kept — the
 * track scrolls sideways when short (H:93) · search · saved views · Filters ·
 * Columns · "Stock check" on Items · the tab's "+ New …" — the floating pill
 * on a phone, where "Stock check" joins the tabs' row. Keeping the stock
 * (Create with Edit) shows the creates and Stock check.
 */
export function StockToolbar<TRow extends RowData>({
  tab,
  table,
  filters,
}: StockToolbarProps<TRow>) {
  const { t } = useTranslation(STOCK_NS);
  const phone = useViewportTier() === 'phone';
  const access = useStockAccess();
  const nav = useStockNav();
  const tableId = STOCK_TABLE_IDS[tab];

  const tabs = STOCK_TABS.map((entry) => ({
    id: entry.id,
    label: t(STOCK_KEYS.tabs[entry.id]),
    icon: entry.icon,
    ...organizationStockTab(nav.organizationSlug, entry.id),
  }));
  const check =
    tab === 'items' && access.canManage ? (
      <RoomViewAction
        actionId="check"
        tableId={tableId}
        icon={ClipboardList}
        label={t(STOCK_KEYS.check)}
        collapse={false}
        iconClassName="size-3.75 text-muted-foreground-strong"
        onClick={nav.check}
      />
    ) : null;
  const createTab = tab === 'movements' ? null : tab;

  return (
    <RoomToolbar
      title={t(STOCK_KEYS.manifest.title)}
      tableId={tableId}
      tabs={
        <div className="flex w-full min-w-0 items-center gap-2">
          <RoomTabs label={t(STOCK_KEYS.tabs.label)} tabs={tabs} testIdPrefix={tableId} />
          {phone ? check : null}
        </div>
      }
      search={{
        placeholder: t(STOCK_KEYS.search.placeholder),
        label: t(STOCK_KEYS.search.label),
      }}
      filters={filters}
      columns={
        table ? <DataTableColumnChooser table={table} tableId={tableId} /> : undefined
      }
      actions={phone ? undefined : check}
      primary={
        createTab && access.canManage
          ? {
              action: {
                id: 'new',
                label: t(PRIMARY_CREATE[createTab]),
                onSelect: () => nav.create(createTab),
              },
            }
          : undefined
      }
    />
  );
}
