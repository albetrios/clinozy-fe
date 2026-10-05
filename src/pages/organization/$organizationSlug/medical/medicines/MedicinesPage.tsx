import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  MEDICINE_STOCK_TONES,
  medicineStockLevel,
} from '@/shared/api/clinic/medicine-stock.ts';
import { fetchMedicine, medicineQueryKeys } from '@/shared/api/clinic/medicines-api.ts';
import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
  roomFiltersOf,
  RoomViewAction,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import {
  useMedicineList,
  useSetNearExpiryDiscount,
} from '@/shared/hooks/useMedicines/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Package, PenLine, RefreshCw, Tag, Trash } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import {
  MEDICINE_EXPIRY_FILTERS,
  MEDICINE_STOCK_FILTERS,
  validateMedicalSearch,
} from '../medical.search.ts';
import {
  MedicalDeleteConfirm,
  type MedicalDeleteTarget,
} from '../shared/components/MedicalDeleteConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { MedicineDrawer } from '../shared/components/MedicineDrawer/index.ts';
import { useMedicalDialogRoute } from '../shared/hooks/useMedicalDialogRoute/index.ts';
import { useManufacturerCatalogue } from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import { useMedicalStack } from '../shared/hooks/useMedicalStack/index.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { ExpiringReturnDrawer } from './components/ExpiringReturnDrawer/index.ts';
import { useMedicineColumns } from './hooks/useMedicineColumns/index.ts';
import { medicineFilterKey, medicineParamsOf } from './medicines.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.medicines;

/** A batch within this many days of expiry gets the row's return and discount actions. */
const EXPIRY_ACTIONS_WITHIN = 90;

/** The near-expiry discount the store offers (Q-M3). */
const NEAR_EXPIRY_PCT = 20;

/**
 * The Medicines Filters (`medical.md:55`): Stock (All · Low stock) · Nearest
 * expiry (Any · Within 30 / 60 / 90 days) · the automatic Manufacturer
 * section · Created.
 */
function useMedicineFilters() {
  const { t } = useTranslation(MEDICAL_NS);
  const makers = useManufacturerCatalogue().data ?? [];
  const keys = MEDICAL_KEYS.filters;
  return roomFiltersOf({
    stock: {
      field: { kind: 'options', values: MEDICINE_STOCK_FILTERS, single: true },
      copy: {
        label: t(keys.stock),
        anyLabel: t(keys.all),
        options: { low: { label: t(keys.lowStock), tone: 'butter' } },
      },
    },
    expiry: {
      field: { kind: 'options', values: MEDICINE_EXPIRY_FILTERS, single: true },
      copy: {
        label: t(keys.expiry),
        anyLabel: t(keys.any),
        options: {
          30: { label: t(keys.within30), tone: 'blush' },
          60: { label: t(keys.within60), tone: 'butter' },
          90: { label: t(keys.within90), tone: 'sky' },
        },
      },
    },
    manufacturer: automaticSection(t(keys.manufacturer), makers),
  });
}

/**
 * The near-expiry discount, on or off, with its toast and Undo (Q-M3): one
 * medicine from its row, or every expiring one from "Sell all at 20% off".
 */
function useDiscountToggle() {
  const { t } = useTranslation(MEDICAL_NS);
  const discount = useSetNearExpiryDiscount();
  return (rows: readonly MedicineRow[], on: boolean) => {
    const ids = rows.map((row) => row.id);
    const before = rows.map((row) => ({ id: row.id, pct: row.nearExpiryDiscountPct }));
    let message = t(MEDICAL_KEYS.toasts.discountOff);
    if (on) {
      message =
        rows.length === 1 && rows[0]
          ? t(MEDICAL_KEYS.toasts.discountOnOne, { name: rows[0].name })
          : t(MEDICAL_KEYS.toasts.discountOn);
    }
    discount.mutate(
      { ids, pct: on ? NEAR_EXPIRY_PCT : 0 },
      {
        onSuccess: () =>
          notify.undo(message, {
            onUndo: () => {
              for (const row of before) discount.mutate({ ids: [row.id], pct: row.pct });
            },
          }),
      },
    );
  };
}

/**
 * Medical › Medicines (KICKOFF §6.7; `medical.md:41–55`): the Medical
 * toolbar — "Reorder low stock" with Low stock on, "Sell all at 20% off" /
 * "Remove near-expiry discount" with a Nearest expiry window — over the
 * medicines table. A row opens Edit medicine; a batch expiring within 90 days
 * adds "Return expiring stock to supplier" (its drawer, no URL) and the
 * discount toggle; Delete asks for a reason. The search, filters and
 * sort live in the URL. The dialog routes render nothing: this page opens the
 * Medicine drawer for `create/` (`?name=`) and `$medicineId/edit/`, with any
 * child stacked on it.
 */
export function MedicinesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = medicineParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useClinicAccess();
  const nav = useMedicalNav();
  const { fields, copy } = useMedicineFilters();
  const filters = useRoomFilters(fields);
  const toggleDiscount = useDiscountToggle();
  const stack = useMedicalStack();
  const [deleting, setDeleting] = useState<MedicalDeleteTarget | null>(null);
  const [returning, setReturning] = useState<MedicineRow | null>(null);
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'medicines',
    param: 'medicineId',
    queryKey: medicineQueryKeys.detail,
    fetchRecord: fetchMedicine,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.medicine),
  });

  const list = useMedicineList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, medicineFilterKey(params));
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useMedicineColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canCreate = access.isResolved && access.can('medical', 'create');
  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.medicines.rowActions;

  const rowActions = (row: MedicineRow): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [];
    const expiring =
      row.nearest !== null && row.nearest.daysLeft <= EXPIRY_ACTIONS_WITHIN;
    if (canEdit && expiring && row.stock > 0 && row.supplierRates.length > 0) {
      actions.push({
        id: 'return-expiring',
        label: t(keys.returnExpiring),
        icon: RefreshCw,
        onSelect: () => setReturning(row),
      });
    }
    if (canEdit && expiring) {
      const on = row.nearExpiryDiscountPct === 0;
      actions.push({
        id: 'discount',
        label: t(on ? keys.discount : keys.removeDiscount),
        icon: Tag,
        onSelect: () => toggleDiscount([row], on),
      });
    }
    actions.push({
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.medicineEdit(row.id),
    });
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: t(keys.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => setDeleting({ kind: 'medicine', id: row.id, name: row.name }),
      });
    }
    return actions;
  };

  // The view action (H:5438–5443): a Nearest expiry window → the discount for
  // every expiring medicine; Low stock → "Reorder low stock".
  let viewAction = null;
  if (search.expiry && canEdit && rows.length > 0) {
    const allOn = rows.every((row) => row.nearExpiryDiscountPct > 0);
    viewAction = (
      <RoomViewAction
        actionId="discount"
        tableId={TABLE_ID}
        icon={Tag}
        label={t(
          allOn
            ? MEDICAL_KEYS.viewActions.removeDiscount
            : MEDICAL_KEYS.viewActions.sellAllDiscount,
        )}
        onClick={() => toggleDiscount(rows, !allOn)}
      />
    );
  } else if (search.stock === 'low' && canCreate && rows.length > 0) {
    viewAction = (
      <RoomViewAction
        actionId="reorder"
        tableId={TABLE_ID}
        icon={Package}
        label={t(MEDICAL_KEYS.viewActions.reorderLow)}
        onClick={() => nav.create('purchases', { reorder: 'low' })}
      />
    );
  }

  return (
    <section
      data-testid="medical-medicines-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar
        tab="medicines"
        table={table}
        filters={{ fields, copy }}
        viewAction={viewAction}
      />
      <MedicalTable
        tab="medicines"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.medicines.empty)}
        emptyAction={
          canCreate
            ? {
                label: t(MEDICAL_KEYS.create.medicine),
                onSelect: () => nav.create('medicines'),
              }
            : undefined
        }
        recordsLabel={t(MEDICAL_KEYS.medicines.records)}
        minWidth={1240}
        onRowClick={(row) => nav.medicineEdit(row.id)}
        rowTone={(row) =>
          MEDICINE_STOCK_TONES[medicineStockLevel(row.stock, row.minStock)]
        }
        rowActions={rowActions}
        exportName="medicines.csv"
      />
      <MedicineDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, medicine: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
        openChild={stack.open}
      />
      <MedicalStackHost stack={stack} />
      <MedicalDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <ExpiringReturnDrawer medicine={returning} onClose={() => setReturning(null)} />
      <Outlet />
    </section>
  );
}
