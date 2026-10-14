import { Outlet, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationMedicalTab } from '@/lib/routes/medical-builders.ts';
import {
  organizationPendingCreate,
  organizationPendingEdit,
} from '@/lib/routes/payments-builders.ts';
import type { CreditListParams, CreditRow } from '@/shared/api/app/credits-contracts.ts';
import { CREDIT_DIRECTION_TONES, CREDIT_STATUS_TONES } from '@/shared/app/app-tones.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SettleCreditDrawer } from '@/shared/components/SettleCreditDrawer/index.ts';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group.tsx';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Trash, Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import {
  CUSTOMER_CREDIT_STATES,
  CUSTOMER_CREDIT_WAYS,
  MEDICAL_CREDIT_SIDES,
  type MedicalCreditsSearch,
  SUPPLIER_CREDIT_STATES,
  validateMedicalCreditsSearch,
} from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import {
  useMedicalSummary,
  useStoreCreditCount,
  useStoreCreditList,
  useSupplierCreditList,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import type {
  SupplierCreditListParams,
  SupplierCreditRow,
} from '../shared/medical-contracts.ts';
import { SupplierCreditVoidConfirm } from './components/SupplierCreditVoidConfirm/index.ts';
import { useCustomerCreditColumns } from './hooks/useCustomerCreditColumns/index.ts';
import {
  SUPPLIER_CREDIT_STATE_TONES,
  useSupplierCreditColumns,
} from './hooks/useSupplierCreditColumns/index.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.credits;
const K = MEDICAL_KEYS.credits;

/** A side of the tab. */
type CreditSide = (typeof MEDICAL_CREDIT_SIDES)[number];

/** "From suppliers": the State, one at a time. */
const SUPPLIER_FILTER_FIELDS = {
  state: { kind: 'options', values: SUPPLIER_CREDIT_STATES, single: true },
} as const satisfies RoomFilterFields;

/** "With customers": Which way, State, Created — Pending's filters. */
const CUSTOMER_FILTER_FIELDS = {
  direction: { kind: 'options', values: CUSTOMER_CREDIT_WAYS },
  status: { kind: 'options', values: CUSTOMER_CREDIT_STATES },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/** The rows' widest layout. */
const MIN_WIDTH = 980;

/**
 * The tab's two sides as a segmented switch in the toolbar: From suppliers · With customers.
 * Changing side starts its list afresh — the other side's filters mean nothing here.
 */
function CreditSideSwitch({ side }: { side: CreditSide }) {
  const { t } = useTranslation(MEDICAL_NS);
  const navigate = useNavigate();
  const nav = useMedicalNav();
  return (
    <ToggleGroup
      type="single"
      aria-label={t(K.sides.label)}
      value={side}
      onValueChange={(value) => {
        if (value !== 'suppliers' && value !== 'customers') return;
        void navigate({
          ...organizationMedicalTab(nav.organizationSlug, 'credits'),
          search: value === 'customers' ? { side: value } : {},
          hash: true,
        });
      }}
      className="bg-muted border-muted h-9 gap-0.5 rounded-lg border p-0.75"
      data-testid={`${TABLE_ID}-side`}
    >
      {MEDICAL_CREDIT_SIDES.map((value) => (
        <ToggleGroupItem
          key={value}
          value={value}
          data-testid={`${TABLE_ID}-side-${value}`}
          className="text-detail data-[state=on]:bg-background data-[state=on]:ring-border h-7 rounded-md px-3 font-medium whitespace-nowrap data-[state=on]:shadow-(--elevation-control) data-[state=on]:ring-1"
        >
          {t(K.sides[value])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * "From suppliers" (clinozy-be MD34): every supplier credit for returned stock, newest first —
 * a row opens its supplier (the Account lists it); Void, for members with Medical Delete, puts
 * its packs back and the supplier's dues up, with Undo. The footer counts them for the State.
 */
function SupplierCredits({ search }: { search: MedicalCreditsSearch }) {
  const { t } = useTranslation(MEDICAL_NS);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(SUPPLIER_FILTER_FIELDS);
  const [voiding, setVoiding] = useState<SupplierCreditRow | null>(null);
  const params: SupplierCreditListParams = { status: search.state };
  const list = useSupplierCreditList(params);
  const summary = useMedicalSummary('supplierCredits', params).data;
  const { rows, loading } = useRoomList(
    list,
    TABLE_ID,
    `suppliers:${search.state ?? ''}`,
  );
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useSupplierCreditColumns(),
    rows: loading ? [] : rows,
    sort: undefined,
    onSortChange: () => undefined,
  });
  const copy: Record<string, RoomFilterCopy> = {
    state: {
      label: t(K.filters.state),
      anyLabel: t(MEDICAL_KEYS.filters.all),
      options: Object.fromEntries(
        SUPPLIER_CREDIT_STATES.map((state) => [
          state,
          { label: t(K.states[state]), tone: SUPPLIER_CREDIT_STATE_TONES[state] },
        ]),
      ),
    },
  };
  const canVoid = access.isResolved && access.can('medical', 'delete');
  const rowActions = (credit: SupplierCreditRow): DataTableRowAction[] =>
    canVoid
      ? [
          {
            id: 'void',
            label: t(K.rowActions.void),
            icon: Trash,
            destructive: true,
            onSelect: () => setVoiding(credit),
          },
        ]
      : [];
  return (
    <>
      <MedicalToolbar
        tab="credits"
        table={table}
        filters={{ fields: SUPPLIER_FILTER_FIELDS, copy }}
        viewAction={<CreditSideSwitch side="suppliers" />}
        searchable={false}
      />
      <MedicalTable
        tab="credits"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(K.empty.suppliers)}
        recordsLabel={t(K.records)}
        countLabel={summary ? t(K.count, { count: summary.total }) : undefined}
        minWidth={MIN_WIDTH}
        onRowClick={(credit) => nav.supplierEdit(credit.supplierId)}
        rowTone={(credit) => SUPPLIER_CREDIT_STATE_TONES[credit.status]}
        rowActions={rowActions}
        exportName="medical-supplier-credits.csv"
      />
      <SupplierCreditVoidConfirm credit={voiding} onClose={() => setVoiding(null)} />
    </>
  );
}

/** The customers' list read for the URL. */
const customerParamsOf = (search: MedicalCreditsSearch): CreditListParams => ({
  direction: search.direction,
  status: search.status,
  created: search.created,
  q: search.q,
});

/**
 * "With customers" (clinozy-be MD32, MD33): the store's credits on its sales — a return kept as
 * store credit, money owed either way — as the Payments room's Pending holds them, newest first.
 * A row opens it in Pending (Edit, Use on next bill); Give back and Got it back settle an open
 * one here, by the member's `payment:*` codes; Add credit opens Pending's. The footer counts them
 * for the filters and search.
 */
function CustomerCredits({ search }: { search: MedicalCreditsSearch }) {
  const { t } = useTranslation(MEDICAL_NS);
  const navigate = useNavigate();
  const nav = useMedicalNav();
  const access = usePaymentAccess();
  const filters = useRoomFilters(CUSTOMER_FILTER_FIELDS);
  const [settling, setSettling] = useState<CreditRow | null>(null);
  const params = customerParamsOf(search);
  const list = useStoreCreditList(params);
  const count = useStoreCreditCount(params).data ?? null;
  const { rows, loading } = useRoomList(
    list,
    TABLE_ID,
    JSON.stringify(['customers', params]),
  );
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useCustomerCreditColumns(),
    rows: loading ? [] : rows,
    sort: undefined,
    onSortChange: () => undefined,
  });
  const copy: Record<string, RoomFilterCopy> = {
    direction: {
      label: t(K.filters.way),
      options: Object.fromEntries(
        CUSTOMER_CREDIT_WAYS.map((way) => [
          way,
          { label: t(K.ways[way]), tone: CREDIT_DIRECTION_TONES[way] },
        ]),
      ),
    },
    status: {
      label: t(K.filters.state),
      options: Object.fromEntries(
        CUSTOMER_CREDIT_STATES.map((status) => [
          status,
          { label: t(K.customerStates[status]), tone: CREDIT_STATUS_TONES[status] },
        ]),
      ),
    },
  };
  const rowActions = (credit: CreditRow): DataTableRowAction[] => {
    if (credit.status !== 'open') return [];
    const givesBack = credit.direction === 'give';
    if (!(givesBack ? access.canGiveBack : access.canCreate)) return [];
    return [
      {
        id: 'settle',
        label: t(givesBack ? K.rowActions.giveBack : K.rowActions.gotBack),
        icon: Wallet,
        onSelect: () => setSettling(credit),
      },
    ];
  };
  return (
    <>
      <MedicalToolbar
        tab="credits"
        table={table}
        filters={{ fields: CUSTOMER_FILTER_FIELDS, copy }}
        viewAction={<CreditSideSwitch side="customers" />}
      />
      <MedicalTable
        tab="credits"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0 || Boolean(search.q)}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(K.empty.customers)}
        emptyAction={
          access.canCreate
            ? {
                label: t(K.addCredit),
                onSelect: () =>
                  void navigate({
                    ...organizationPendingCreate(nav.organizationSlug),
                    search: {},
                  }),
              }
            : undefined
        }
        recordsLabel={t(K.records)}
        countLabel={count === null ? undefined : t(K.count, { count })}
        minWidth={MIN_WIDTH}
        onRowClick={
          access.canRead
            ? (credit) =>
                void navigate({
                  ...organizationPendingEdit(nav.organizationSlug, credit.id),
                  search: {},
                })
            : undefined
        }
        rowTone={(credit) => CREDIT_STATUS_TONES[credit.status]}
        rowActions={rowActions}
        exportName="medical-customer-credits.csv"
        avatar
      />
      <SettleCreditDrawer credit={settling} onClose={() => setSettling(null)} />
    </>
  );
}

/**
 * Medical › Credits (clinozy-be D90 — beyond the design, a standing deviation): the store's
 * credits in one tab beside its Payments, in "More"'s Money group — "From suppliers", the credits
 * returned stock earns against a supplier's dues (Return expiring stock on Medicines adds one),
 * and "With customers", the credits on its sales (a return kept as store credit among them). The
 * side and each side's filters live in the URL; "From suppliers" is the default and has no search
 * (the API reads supplier credits by supplier and state only).
 */
export function MedicalCreditsPage() {
  const search = validateMedicalCreditsSearch(useSearch({ strict: false }));
  const side: CreditSide = search.side ?? 'suppliers';
  return (
    <section data-testid="medical-credits-page" className="flex min-h-0 flex-1 flex-col">
      {side === 'customers' ? (
        <CustomerCredits search={search} />
      ) : (
        <SupplierCredits search={search} />
      )}
      <Outlet />
    </section>
  );
}
