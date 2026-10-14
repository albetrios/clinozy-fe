import { Outlet, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  type RoomFilterFields,
  RoomViewAction,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useFixtureOpenSupplierBills } from '@/shared/hooks/useFixtureLedger/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePayBill } from '@/shared/hooks/usePayBill/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { Eye, PenLine, SquareCheck, Trash, Wallet } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import { PURCHASE_STAGES, validateMedicalSearch } from '../medical.search.ts';
import {
  MedicalFlowConfirm,
  type MedicalFlowTarget,
} from '../shared/components/MedicalFlowConfirm/index.ts';
import { MedicalStackHost } from '../shared/components/MedicalStackHost/index.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import {
  type MedicalDialogRoute,
  useMedicalDialogRoute,
} from '../shared/hooks/useMedicalDialogRoute/index.ts';
import {
  useMedicalSummary,
  usePurchaseOrderList,
} from '../shared/hooks/useMedicalLists/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';
import {
  type MedicalStack,
  useMedicalStack,
} from '../shared/hooks/useMedicalStack/index.ts';
import { fetchPurchaseOrder, medicalQueryKeys } from '../shared/medical-api.ts';
import type { PurchaseOrderRow } from '../shared/medical-contracts.ts';
import { MEDICAL_DRAWER_KEYS } from '../shared/medical-drawers.constants.ts';
import { PURCHASE_STAGE_TONES } from '../shared/medical-tones.ts';
import { PurchaseOrderDrawer } from './components/PurchaseOrderDrawer/index.ts';
import { PurchaseOrderView } from './components/PurchaseOrderView/index.ts';
import { ReceiveGoodsDrawer } from './components/ReceiveGoodsDrawer/index.ts';
import { usePurchaseOrderColumns } from './hooks/usePurchaseOrderColumns/index.ts';
import { purchaseOrderFilterKey, purchaseOrderParamsOf } from './purchases.params.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.purchases;

/** The Purchases Filters (`medical.md:71`): Stage (All · Ordered · Received · Paid) · Created. */
const PURCHASE_FILTER_FIELDS = {
  stage: { kind: 'options', values: PURCHASE_STAGES, single: true },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

type OrderDialog = MedicalDialogRoute<PurchaseOrderRow>;

/** An order's route its stage has left — editing or receiving a received one — shows its view instead (`S:59`). */
const leftStage = (dialog: OrderDialog) =>
  dialog.kind === 'record' &&
  dialog.record !== undefined &&
  dialog.record.stage !== 'ordered' &&
  (dialog.action === 'edit' || dialog.action === 'receive');

/**
 * The drawer the URL names (D24): New purchase order (`?supplier=`,
 * `?reorder=low`), an Ordered order to edit or receive, or a received or paid
 * order's view. An Ordered order's view route opens it as Edit — read only
 * without Edit.
 */
function OrderDrawers({
  dialog,
  close,
  stack,
  onPay,
}: {
  dialog: OrderDialog;
  close: () => void;
  stack: MedicalStack;
  onPay?: (order: PurchaseOrderRow) => void;
}) {
  if (dialog.kind === 'create') {
    return (
      <PurchaseOrderDrawer
        mode="create"
        open
        prefill={{ supplierId: dialog.prefill.supplier, reorder: dialog.prefill.reorder }}
        onClose={close}
        openChild={stack.open}
      />
    );
  }
  if (dialog.kind !== 'record' || leftStage(dialog)) return null;
  const ordered = dialog.record?.stage === 'ordered';
  if (dialog.action === 'receive') {
    return (
      <ReceiveGoodsDrawer
        open
        order={dialog.record}
        onClose={close}
        openChild={stack.open}
      />
    );
  }
  if (dialog.action === 'edit' || ordered) {
    return (
      <PurchaseOrderDrawer
        mode="edit"
        open
        order={dialog.record}
        onClose={close}
        openChild={stack.open}
      />
    );
  }
  return <PurchaseOrderView open order={dialog.record} onClose={close} onPay={onPay} />;
}

/**
 * "Pay all received · ₹2,980" (`medical.md:17`; Q-M1): with Stage Received,
 * Send payment on the oldest open Medical bill — "Add & another" walks the
 * rest there (AMBER).
 */
function PayAllReceived({ onPay }: { onPay: (purchaseId: string) => void }) {
  const { t } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const bills = (useFixtureOpenSupplierBills().data ?? []).filter(
    (bill) => bill.kind === 'medical_po',
  );
  const [oldest] = bills;
  if (!oldest) return null;
  const total = bills.reduce((sum, bill) => sum + bill.due, 0);
  return (
    <RoomViewAction
      actionId="pay-received"
      tableId={TABLE_ID}
      icon={Wallet}
      label={t(MEDICAL_KEYS.viewActions.payAllReceived, { amount: formatPaise(total) })}
      onClick={() => onPay(oldest.purchaseId)}
    />
  );
}

/**
 * Medical › Purchases (KICKOFF §6.7; `medical.md:57–71`): the Medical toolbar
 * over the purchase orders. The sequence follows the stage (`medical.md:434`):
 * an Ordered order opens for editing and offers "Receive goods" and the red
 * "Cancel order" (Admin); a Received one its read-only view and "Pay ₹2,980",
 * which — like "Pay all received" with Stage Received — opens Payments › Send
 * payment on the bill (Q-M1); a Paid one its view. The search, Stage, Created
 * and the sort live in the URL; the footer counts the orders they match. The
 * dialog routes render nothing: this page opens their drawers.
 */
export function PurchasesPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const formatPaise = usePaiseFormat();
  const search = validateMedicalSearch(useSearch({ strict: false }));
  const params = purchaseOrderParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useAppAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(PURCHASE_FILTER_FIELDS);
  const stack = useMedicalStack();
  const { canPay, pay } = usePayBill();
  const [cancelling, setCancelling] = useState<MedicalFlowTarget | null>(null);
  const { dialog, close } = useMedicalDialogRoute({
    tab: 'purchases',
    param: 'purchaseOrderId',
    queryKey: medicalQueryKeys.purchaseOrder,
    fetchRecord: fetchPurchaseOrder,
    recordLabel: t(MEDICAL_DRAWER_KEYS.records.purchaseOrder),
  });

  // Editing or receiving an order past Ordered shows its view (`S:59`).
  const leftOrder = leftStage(dialog) && dialog.kind === 'record' ? dialog.id : null;
  useEffect(() => {
    if (leftOrder) nav.purchaseOrder(leftOrder, true);
  }, [leftOrder, nav]);

  const list = usePurchaseOrderList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, purchaseOrderFilterKey(params));
  const summary = useMedicalSummary('purchases', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: usePurchaseOrderColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const canEdit = access.isResolved && access.can('medical', 'edit');
  const canDelete = access.isResolved && access.can('medical', 'delete');
  const keys = MEDICAL_KEYS.purchases;
  const payOrder = (purchaseId: string) => pay({ kind: 'medical_po', purchaseId });

  /** Ordered → the editable order; Received or Paid → the read-only view (`S:58–59`). */
  const open = (order: PurchaseOrderRow) =>
    order.stage === 'ordered' && canEdit
      ? nav.purchaseOrderEdit(order.id)
      : nav.purchaseOrder(order.id);

  const rowActions = (order: PurchaseOrderRow): DataTableRowAction[] => {
    if (order.stage !== 'ordered') {
      const actions: DataTableRowAction[] = [];
      if (order.stage === 'received' && order.due > 0 && canPay) {
        actions.push({
          id: 'pay',
          label: t(keys.rowActions.pay, { amount: formatPaise(order.due) }),
          icon: Wallet,
          onSelect: () => payOrder(order.id),
        });
      }
      actions.push({
        id: 'view',
        label: t(keys.rowActions.view),
        icon: Eye,
        onSelect: () => nav.purchaseOrder(order.id),
      });
      return actions;
    }
    if (!canEdit) return [];
    const actions: DataTableRowAction[] = [
      {
        id: 'receive',
        label: t(keys.rowActions.receive),
        icon: SquareCheck,
        onSelect: () => nav.purchaseOrderReceive(order.id),
      },
      {
        id: 'edit',
        label: t(keys.rowActions.edit),
        icon: PenLine,
        onSelect: () => nav.purchaseOrderEdit(order.id),
      },
    ];
    if (canDelete) {
      actions.push({
        id: 'cancel',
        label: t(keys.rowActions.cancel),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          setCancelling({
            kind: 'cancelOrder',
            id: order.id,
            seq: order.seq,
            record: [order.supplierName, formatPaise(order.total)].join(' · '),
          }),
      });
    }
    return actions;
  };

  return (
    <section
      data-testid="medical-purchases-page"
      className="flex min-h-0 flex-1 flex-col"
    >
      <MedicalToolbar
        tab="purchases"
        table={table}
        filters={{
          fields: PURCHASE_FILTER_FIELDS,
          copy: {
            stage: {
              label: t(MEDICAL_KEYS.filters.stage),
              anyLabel: t(MEDICAL_KEYS.filters.all),
              options: Object.fromEntries(
                PURCHASE_STAGES.map((stage) => [
                  stage,
                  { label: t(keys.stages[stage]), tone: PURCHASE_STAGE_TONES[stage] },
                ]),
              ),
            },
          },
        }}
        viewAction={
          search.stage === 'received' && canPay ? (
            <PayAllReceived onPay={payOrder} />
          ) : null
        }
      />
      <MedicalTable
        tab="purchases"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.empty.store)}
        recordsLabel={t(keys.records)}
        countLabel={summary ? t(keys.count, { count: summary.total }) : undefined}
        minWidth={1030}
        onRowClick={open}
        rowTone={(order) => PURCHASE_STAGE_TONES[order.stage]}
        rowActions={rowActions}
        exportName="purchase-orders.csv"
      />
      <OrderDrawers
        dialog={dialog}
        close={close}
        stack={stack}
        onPay={canPay ? (order) => payOrder(order.id) : undefined}
      />
      <MedicalStackHost stack={stack} />
      <MedicalFlowConfirm target={cancelling} onClose={() => setCancelling(null)} />
      <Outlet />
    </section>
  );
}
