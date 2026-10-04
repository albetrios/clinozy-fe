'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve it
// stale answers (see `DataTable.tsx`).

import type { ReactTable, RowData } from '@tanstack/react-table';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { type MedicalTab, organizationMedicalTab } from '@/lib/routes/index.ts';
import { cn } from '@/lib/utils.ts';
import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  type RoomAction,
  RoomTabs,
  RoomToolbar,
  type RoomToolbarFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import {
  type AppIcon,
  Package,
  Pill,
  Receipt,
  Users,
  Wallet,
} from '@/shared/icons/index.ts';

import {
  MEDICAL_KEYS,
  MEDICAL_NS,
  MEDICAL_TABLE_IDS,
} from '../../../medical.constants.ts';
import { type MedicalCreateTab, useMedicalNav } from '../../hooks/useMedicalNav/index.ts';

/** A tab's group in "More" and the Create menu (H:5433). */
type MedicalGroup = keyof typeof MEDICAL_KEYS.tabs.groups;

/** The seven tabs in the prototype's order (H:5433), each with its icon and group. */
const MEDICAL_TABS: readonly { id: MedicalTab; icon: AppIcon; group: MedicalGroup }[] = [
  { id: 'sales', icon: Receipt, group: 'selling' },
  { id: 'medicines', icon: Pill, group: 'stock' },
  { id: 'purchases', icon: Package, group: 'buying' },
  { id: 'suppliers', icon: Users, group: 'buying' },
  { id: 'manufacturers', icon: Package, group: 'buying' },
  { id: 'mrs', icon: Users, group: 'buying' },
  { id: 'payments', icon: Wallet, group: 'money' },
];

/** One create action: the tab whose create route it opens. */
interface MedicalCreate {
  id: keyof typeof CREATE_LABELS;
  tab: MedicalCreateTab;
  icon: AppIcon;
  group: MedicalGroup;
}

const CREATE_LABELS = {
  sale: MEDICAL_KEYS.create.sale,
  medicine: MEDICAL_KEYS.create.medicine,
  purchaseOrder: MEDICAL_KEYS.create.purchaseOrder,
  supplier: MEDICAL_KEYS.create.supplier,
  mr: MEDICAL_KEYS.create.mr,
  manufacturer: MEDICAL_KEYS.create.manufacturer,
} as const;

/** Every create in the Create menu's order (`medical.md:385`). */
const MEDICAL_CREATES: readonly MedicalCreate[] = [
  { id: 'sale', tab: 'sales', icon: Receipt, group: 'selling' },
  { id: 'medicine', tab: 'medicines', icon: Pill, group: 'stock' },
  { id: 'purchaseOrder', tab: 'purchases', icon: Package, group: 'buying' },
  { id: 'supplier', tab: 'suppliers', icon: Users, group: 'buying' },
  { id: 'mr', tab: 'mrs', icon: Users, group: 'buying' },
  { id: 'manufacturer', tab: 'manufacturers', icon: Package, group: 'buying' },
];

/** The split primary per tab (H:5431); Payments' is "New sale". */
const PRIMARY_CREATE: Readonly<Record<MedicalTab, MedicalCreate['id']>> = {
  sales: 'sale',
  medicines: 'medicine',
  purchases: 'purchaseOrder',
  suppliers: 'supplier',
  manufacturers: 'manufacturer',
  mrs: 'mr',
  payments: 'sale',
};

/** Props of {@link MedicalViewAction}. */
export interface MedicalViewActionProps extends ComponentProps<'button'> {
  /** Stable id — the test id (`<table id>-view-action-<id>`). */
  actionId: string;
  icon: AppIcon;
  label: string;
  /** The tab's table id — the test-id prefix. */
  tableId: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A tab's view action (`medical.md:17`; H:5438–5443): a 36px outline button,
 * its 14px icon and label from `xl`, the icon alone (named by its tooltip and
 * accessible name) where the toolbar is short.
 */
export function MedicalViewAction({
  actionId,
  icon: Icon,
  label,
  tableId,
  className,
  ...props
}: MedicalViewActionProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            data-testid={`${tableId}-view-action-${actionId}`}
            {...props}
            className={cn(
              'text-body text-foreground bg-background hover:bg-muted border-border flex h-9 flex-none items-center justify-center gap-1.5 rounded-lg border leading-none font-medium transition-colors duration-120 max-xl:w-9 xl:ps-2.5 xl:pe-3',
              className,
            )}
          >
            <Icon aria-hidden="true" className="size-3.5 flex-none" />
            <span className="max-xl:sr-only">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="xl:hidden">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Props of {@link MedicalToolbar}. */
export interface MedicalToolbarProps<TRow extends RowData> {
  /** The tab on screen. */
  tab: MedicalTab;
  /** The tab's table — the Columns chooser drives its column visibility. */
  table?: ReactTable<DataTableFeatures, TRow>;
  /** The tab's Filters. */
  filters?: RoomToolbarFilters;
  /** The tab's view action for its filter state (`MedicalViewAction`), if any. */
  viewAction?: ReactNode;
}

/**
 * The Medical toolbar (KICKOFF §6.7 Toolbar; `medical.md:17`) on the shared
 * room toolbar: h1 "Medical" · the seven tabs folding into "More ⌄" when the
 * measured space runs out (on a phone the current tab alone) · search ·
 * saved views · Filters · Columns · the tab's view action · the split
 * "+ New <thing>" with its "⌄" Create menu (every other create, grouped
 * Selling · Stock · Buying) — two floating pills on a phone. Without Create
 * the primary hides.
 */
export function MedicalToolbar<TRow extends RowData>({
  tab,
  table,
  filters,
  viewAction,
}: MedicalToolbarProps<TRow>) {
  const { t } = useTranslation(MEDICAL_NS);
  const phone = useViewportTier() === 'phone';
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const tableId = MEDICAL_TABLE_IDS[tab];
  const canCreate = access.isResolved && access.can('medical', 'create');

  const tabs = MEDICAL_TABS.map((entry) => ({
    id: entry.id,
    label: t(MEDICAL_KEYS.tabs[entry.id]),
    icon: entry.icon,
    group: t(MEDICAL_KEYS.tabs.groups[entry.group]),
    ...organizationMedicalTab(nav.organizationSlug, entry.id),
  }));
  const actionOf = (create: MedicalCreate): RoomAction => ({
    id: `new-${create.tab}`,
    label: t(CREATE_LABELS[create.id]),
    icon: create.icon,
    group: t(MEDICAL_KEYS.tabs.groups[create.group]),
    onSelect: () => nav.create(create.tab),
  });
  const primaryId = PRIMARY_CREATE[tab];
  const primary = MEDICAL_CREATES.find((create) => create.id === primaryId);

  return (
    <RoomToolbar
      title={t(MEDICAL_KEYS.manifest.title)}
      tableId={tableId}
      tabs={
        <div className="flex w-full min-w-0 items-center gap-2">
          <RoomTabs
            label={t(MEDICAL_KEYS.tabs.label)}
            tabs={tabs}
            overflow="fold"
            testIdPrefix={tableId}
          />
          {phone ? viewAction : null}
        </div>
      }
      search={{
        placeholder: t(MEDICAL_KEYS.search.placeholder),
        label: t(MEDICAL_KEYS.search.label),
      }}
      filters={filters}
      columns={
        table ? <DataTableColumnChooser table={table} tableId={tableId} /> : undefined
      }
      actions={phone ? undefined : viewAction}
      primary={
        canCreate && primary
          ? {
              action: { ...actionOf(primary), id: 'new', icon: undefined },
              menu: {
                label: t(MEDICAL_KEYS.create.menu),
                minWidth: 220,
                actions: MEDICAL_CREATES.filter((create) => create !== primary).map(
                  actionOf,
                ),
              },
            }
          : undefined
      }
    />
  );
}
