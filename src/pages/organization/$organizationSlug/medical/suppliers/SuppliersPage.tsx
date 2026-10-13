import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  automaticSection,
  roomFiltersOf,
  singlePickSection,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { usePayBill } from '@/shared/hooks/usePayBill/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Package, PenLine, Trash, Wallet } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { SUPPLIER_PAYABLE_FILTERS, validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from '../shared/components/MedicalDeleteConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { SupplierDrawer } from '../shared/components/SupplierDrawer/index.ts';
import { useMedicalDialogRoute } from '../shared/hooks/useMedicalDialogRoute/index.ts';
import {
  useManufacturerCatalogue,
  useMedicalSummary,
  useSupplierList,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { useMedicalStack } from '../shared/hooks/useMedicalStack/index.ts';
import {
  fetchOldestOpenPurchaseOrder,
  fetchSupplier,
  medicalQueryKeys,
} from '../shared/medical-api.ts';
import type { SupplierListParams, SupplierRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { supplierAgeingTone } from '../shared/medical-tones.ts';
import { useSupplierColumns } from './hooks/useSupplierColumns/index.ts';
import {
  supplierFilterKey,
  supplierParamsOf,
  supplierSummaryParamsOf,
} from './suppliers.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.suppliers;

/**
 * The Suppliers Filters (`medical.md:87`): the automatic Manufacturers section —
 * one maker at a time, as the API filters by one — Payable (All · Owed
 * something, where "Pay all received" lands) and Created.
 */
function useSupplierFilters() {
  const { t } = useTranslation(MEDICAL_NS);
  const makers = useManufacturerCatalogue().data ?? [];
  const keys = MEDICAL_KEYS.filters;
  return roomFiltersOf({
    manufacturer: singlePickSection(automaticSection(t(keys.manufacturers), makers)),
    payable: {
      field: { kind: 'options', values: SUPPLIER_PAYABLE_FILTERS, single: true },
      copy: {
        label: t(keys.payable),
        anyLabel: t(keys.all),
        options: { owed: { label: t(keys.owed), tone: 'blush' } },
      },
    },
  });
}

/**
 * Read the suppliers again — every list and footer, and one supplier's record
 * and Account when named: after "Pay ₹X" finds them paid up, and after a
 * delete confirm closes (a refusal means an order owes them since the list
 * was read).
 */
function useRefreshSuppliers() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  return (supplierId?: string) => {
    const room = medicalQueryKeys.organization(organizationId);
    const keys = [
      [...room, 'suppliers'],
      [...room, 'summary', 'suppliers'],
      ...(supplierId
        ? [
            medicalQueryKeys.supplier(organizationId, supplierId),
            medicalQueryKeys.supplierAccount(organizationId, supplierId),
          ]
        : []),
    ];
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };
}

/** Whether "Pay ₹X" shows, and what it does. */
interface SupplierPay {
  canPay: boolean;
  payOldest: (supplier: SupplierRow) => void;
}

/**
 * "Pay ₹X" on a supplier, as Clinic stock's Vendors do: one read on the click
 * — their oldest received order still due (`fetchOldestOpenPurchaseOrder`),
 * never a read per row — then Payments › Send payment on it (`?bill=mpo_…`).
 * A supplier paid up meanwhile says so and the suppliers are read again; a
 * failed read says why.
 */
function useSupplierPay(): SupplierPay {
  const { t } = useTranslation(MEDICAL_NS);
  const { canPay, pay } = usePayBill();
  const refresh = useRefreshSuppliers();
  const payOldest = (supplier: SupplierRow) => {
    fetchOldestOpenPurchaseOrder(supplier.id)
      .then((order) => {
        if (order) {
          pay({ kind: 'medical_po', purchaseId: order.id });
          return;
        }
        notify.info(t(MEDICAL_KEYS.suppliers.paidUp, { name: supplier.name }));
        refresh(supplier.id);
      })
      .catch((error: unknown) => notifyError(error));
  };
  return { canPay, payOldest };
}

/**
 * A row's actions (`medical.md:80`): "Pay ₹X" while they are owed something
 * (`payment:create` + `payment:read`), "New purchase order" (Create), Edit, and
 * Delete while nothing is owed — an open credit or an order still to receive
 * is the server's refusal (`409 supplier_has_dues`). A confirm that closes
 * without deleting reads the suppliers again.
 */
function useSupplierActions({ canPay, payOldest }: SupplierPay) {
  const { t } = useTranslation(MEDICAL_NS);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const formatRupees = useRupeeFormat();
  const refresh = useRefreshSuppliers();
  const [deleting, setDeleting] = useState<MedicalDeleteTarget | null>(null);
  const canCreate = access.isResolved && access.can('medical', 'create');
  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.suppliers.rowActions;

  const rowActions = (supplier: SupplierRow): DataTableRowAction[] => [
    ...(canPay && supplier.payable > 0
      ? [
          {
            id: 'pay',
            label: t(keys.pay, { amount: formatRupees(supplier.payable) }),
            icon: Wallet,
            onSelect: () => payOldest(supplier),
          },
        ]
      : []),
    ...(canCreate
      ? [
          {
            id: 'new-order',
            label: t(keys.newOrder),
            icon: Package,
            onSelect: () => nav.create('purchases', { supplier: supplier.id }),
          },
        ]
      : []),
    {
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.supplierEdit(supplier.id),
    },
    ...(canDelete && supplier.payable === 0
      ? [
          {
            id: 'delete',
            label: t(keys.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({ kind: 'supplier', id: supplier.id, name: supplier.name }),
          },
        ]
      : []),
  ];

  const confirm = (
    <MedicalDeleteConfirm
      target={deleting}
      onClose={() => {
        setDeleting(null);
        refresh();
      }}
    />
  );
  return { rowActions, confirm };
}

/**
 * The footer: "4 suppliers · ₹6,563 payable" — how many suppliers the filters
 * match and what they are owed over every page (`meta.payable_total`), one read
 * of a single row keyed by the filters alone: a sort changes neither figure.
 */
function useSupplierCount(params: SupplierListParams): string | undefined {
  const { t } = useTranslation(MEDICAL_NS);
  const formatRupees = useRupeeFormat();
  const summary = useMedicalSummary('suppliers', supplierSummaryParamsOf(params)).data;
  if (!summary) return undefined;
  return t(MEDICAL_KEYS.suppliers.count, {
    count: summary.total,
    payable: formatRupees(summary.payable),
  });
}

/**
 * Medical › Suppliers (KICKOFF §6.7; `medical.md:73–87`) on clinozy-be (`GET
 * /app/suppliers`): the Medical toolbar over the suppliers — the makers each
 * distributes, its live orders, what it is owed and for how long, the
 * server's figures; sort by Supplier or Payable. A row opens Edit supplier;
 * "Pay ₹X", while something is owed, opens Payments › Send payment on its
 * oldest received order still due — one read on the click, as Clinic stock's
 * Vendors (the supplier-level payment route is not used); "New purchase
 * order" opens one on that supplier; Delete, with nothing owed, asks for a
 * reason. The footer counts the suppliers and what they are owed; the row
 * edge shows how long while money is due. This page opens the Supplier
 * drawer for the `create/` and `$supplierId/edit/` routes. A first read that
 * fails shows in place with Retry.
 */
export function SuppliersPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = supplierParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const { fields, copy } = useSupplierFilters();
  const filters = useRoomFilters(fields);
  const stack = useMedicalStack();
  const { canPay, payOldest } = useSupplierPay();
  const { rowActions, confirm } = useSupplierActions({ canPay, payOldest });
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'suppliers',
    param: 'supplierId',
    queryKey: medicalQueryKeys.supplier,
    fetchRecord: fetchSupplier,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.supplier),
  });

  const list = useSupplierList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, supplierFilterKey(params));
  const countLabel = useSupplierCount(params);
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useSupplierColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });
  const failed = list.isError && rows.length === 0 && !loading;
  const canCreate = access.isResolved && access.can('medical', 'create');
  const keys = MEDICAL_KEYS.suppliers;

  return (
    <section
      data-testid="medical-suppliers-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar tab="suppliers" table={table} filters={{ fields, copy }} />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
        <MedicalTable
          tab="suppliers"
          table={table}
          list={list}
          loading={loading}
          filtered={filters.count > 0}
          onClearFilters={() => filters.apply({})}
          emptyTitle={t(keys.empty)}
          emptyAction={
            canCreate
              ? {
                  label: t(MEDICAL_KEYS.create.supplier),
                  onSelect: () => nav.create('suppliers'),
                }
              : undefined
          }
          recordsLabel={t(keys.records)}
          countLabel={countLabel}
          minWidth={980}
          onRowClick={(supplier) => nav.supplierEdit(supplier.id)}
          rowTone={(supplier) =>
            supplier.ageingDays === null
              ? undefined
              : supplierAgeingTone(supplier.ageingDays)
          }
          rowActions={rowActions}
          exportName="suppliers.csv"
          avatar
        />
      )}
      <SupplierDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, supplier: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
        openChild={stack.open}
        onNewOrder={(supplierId) => nav.create('purchases', { supplier: supplierId })}
        onPay={canPay ? payOldest : undefined}
      />
      <MedicalStackHost stack={stack} />
      {confirm}
      <Outlet />
    </section>
  );
}
