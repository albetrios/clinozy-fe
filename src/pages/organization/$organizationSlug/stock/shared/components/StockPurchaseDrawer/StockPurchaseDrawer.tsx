import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { defaultBranchId } from '@/shared/app/app-branch.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import {
  type DrawerSaveProblem,
  useDrawerSave,
} from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import {
  type EditingRecordRead,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useStockAccess,
  useStockDrawerAccess,
} from '../../hooks/useStockAccess/index.ts';
import {
  useStockItemCatalogue,
  useStockVendorCatalogue,
} from '../../hooks/useStockLists/index.ts';
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import {
  useCreateStockPurchase,
  useUpdateStockPurchase,
} from '../../hooks/useStockWrites/index.ts';
import { fetchStockPurchase, stockQueryKeys } from '../../stock-api.ts';
import type {
  StockItemRow,
  StockPurchaseRecord,
  StockPurchaseRow,
} from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import { StockDeleteConfirm } from '../StockDeleteConfirm/index.ts';
import {
  billOf,
  linesMissingRate,
  newPurchaseForm,
  paidOf,
  pickedCount,
  PURCHASE_LINES_MAX,
  purchaseChangeOf,
  purchaseFieldOrder,
  purchaseFormOf,
  purchaseInputOf,
  type PurchaseLineValues,
  purchaseServerFields,
  reorderLines,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';
import {
  BillFields,
  ItemsFields,
  PaymentFields,
  type PurchaseFieldsProps,
  type PurchasePayment,
} from './StockPurchaseFields.tsx';
import { usePurchaseDelete } from './use-purchase-delete.ts';

const K = STOCK_DRAWER_KEYS.purchase;

/** Items rows: 840px (`clinic-stock.md:254`). */
const CONTENT_PROFILE = { fieldCount: 6, hasItems: true } as const;

/** What every use of the drawer passes. */
interface StockPurchaseDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Opens a vendor or an item on top for "New clinic vendor / item · “q”". */
  openChild?: OpenStockChild;
  testId?: string;
}

/** Props of {@link StockPurchaseDrawer}: New purchase (`?reorder=low` presets its lines), or Edit purchase. */
export type StockPurchaseDrawerProps = StockPurchaseDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { reorder?: 'low' } }
    | { mode: 'edit'; purchase: StockPurchaseRow | undefined }
  );

/** The Payment step's fields. */
const PAYMENT_FIELDS: ReadonlySet<string> = new Set([
  'bill',
  'paid',
  'paidMode',
  'paidBranchId',
]);

/** The step that holds a field the save stopped on. */
const stepOfField = (field: string) => {
  if (field.startsWith('lines')) return 'items';
  return PAYMENT_FIELDS.has(field) ? 'payment' : 'bill';
};

/** Why clinozy-be refuses a new purchase's "Paid" (`409`) — said on the Paid field. */
const PAID_REFUSALS: ReadonlyMap<string, string> = new Map([
  ['more_than_due', K.fields.moreThanBill],
  ['day_closed', K.fields.dayClosed],
]);

/** The header's badge for what is due: "₹1,710 due" in blush, or "Paid" in sage. */
const dueBadge = (due: string | null, t: TFunction): DrawerBadge =>
  due === null
    ? { id: 'due', label: t(K.paid), tone: 'sage' }
    : { id: 'due', label: t(K.due, { amount: due }), tone: 'blush' };

/**
 * The header's badges (`clinic-stock.md:256`): the supplier, the bill, and what
 * is due — a saved purchase's as the server has it, a new one's what its
 * "Paid" leaves of the bill being typed.
 */
function usePurchaseBadges(
  values: StockPurchaseFormValues,
  vendorName: string | undefined,
  saved: StockPurchaseRow | null,
): DrawerBadge[] {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const formatRupees = useRupeeFormat();
  const bill = billOf(values);
  const unpaid = bill - paidOf(values);
  let due: string | null = unpaid > 0 ? formatPaise(unpaid) : null;
  if (saved) due = saved.due > 0 ? formatRupees(saved.due) : null;
  return [
    { id: 'vendor', label: vendorName ?? t(K.noSupplier), tone: 'sky' },
    { id: 'bill', label: t(K.bill, { amount: formatPaise(bill) }) },
    dueBadge(due, t),
  ];
}

/** The step cards: Bill → Items received → Payment (`clinic-stock.md:257`). */
function useSteps(
  body: PurchaseFieldsProps,
  values: StockPurchaseFormValues,
  vendorName: string | undefined,
): DrawerStep[] {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const formatRupees = useRupeeFormat();
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const lines = pickedCount(values.lines);
  const billNo = values.billNo.trim();
  const bill = formatPaise(billOf(values));
  const paidNow = paidOf(values);
  let paid = body.payment && paidNow > 0 ? formatPaise(paidNow) : '';
  if (body.saved) paid = body.saved.paid > 0 ? formatRupees(body.saved.paid) : '';
  return [
    {
      id: 'bill',
      title: t(K.steps.bill),
      summary: drawerStepSummary([vendorName, billNo], notFilled),
      peek: [
        { kind: 'value', label: t(K.fields.vendor), value: vendorName ?? '' },
        { kind: 'value', label: t(K.fields.billNo), value: billNo },
      ],
      missing: values.vendorId ? [] : [t(K.fields.vendor)],
      content: (
        <DrawerStepBody readOnly={body.readOnly}>
          <BillFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'items',
      title: t(K.steps.items),
      summary: lines > 0 ? t(K.fields.peek, { count: lines, amount: bill }) : notFilled,
      content: <ItemsFields {...body} />,
    },
    {
      id: 'payment',
      title: t(K.steps.payment),
      summary: drawerStepSummary([bill, paid], ''),
      peek: [
        { kind: 'value', label: t(K.fields.billAmount), value: bill },
        { kind: 'value', label: t(K.fields.paid), value: paid },
      ],
      content: (
        <DrawerStepBody readOnly={body.readOnly}>
          <PaymentFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];
}

/** "⚡ Reorder low items" — a new purchase only (`clinic-stock.md:154`). */
function useReorder(
  onFill: (lines: StockPurchaseFormValues['lines']) => void,
): QuickFillItem {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const items = useStockItemCatalogue().data ?? [];
  return {
    id: 'reorder',
    label: t(K.reorder),
    tone: 'butter',
    onSelect: () => onFill(reorderLines(items)),
  };
}

/**
 * A new purchase's "Paid" for a member who may pay (`payment:create`): the
 * branches they work in and the one it starts on — the header's one branch,
 * else the main one. Null on an edit, without the code, or with no branch.
 */
function usePurchasePayment(creating: boolean): PurchasePayment | null {
  const { canPay } = useStockAccess();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  if (!(creating && canPay) || openBranches.length === 0) return null;
  return {
    branches: openBranches,
    branchId: defaultBranchId(openBranches, preferences.branchFilter),
  };
}

/** What a session opens with: the saved purchase, or a new one — its lines reordered when asked. */
function initialForm(
  purchase: StockPurchaseRow | null,
  reorderFrom: readonly StockItemRow[] | undefined,
): StockPurchaseFormValues {
  if (purchase) return purchaseFormOf(purchase);
  return newPurchaseForm(reorderFrom ? reorderLines(reorderFrom) : []);
}

/**
 * How an Edit purchase drawer reads its purchase again — a save refused as stale
 * (`409 record_changed`: someone saved it, or paid on it, since; the toast's
 * "Reload") — past the cache, for `useEditingRecord`.
 */
const readStockPurchase = (
  purchase: StockPurchaseRow,
  organizationId: string | null,
): EditingRecordRead<StockPurchaseRow> => ({
  queryKey: stockQueryKeys.purchase(organizationId, purchase.id),
  queryFn: () => fetchStockPurchase(purchase.id),
});

/**
 * A new purchase's lines before anything is sent: one item at least, at most
 * 50, each picked one with its rate — every rate cell left empty says "Enter
 * the rate" in red (validated before submit, §7.3).
 */
function useLinesCheck(
  form: UseFormReturn<StockPurchaseFormValues>,
  openItems: () => void,
) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (
    current: StockPurchaseFormValues,
  ): DrawerSaveProblem<StockPurchaseFormValues> | null => {
    form.clearErrors('lines');
    const count = pickedCount(current.lines);
    if (count === 0) return { fields: ['lines'], message: t(K.fields.addLine) };
    if (count > PURCHASE_LINES_MAX) {
      return {
        fields: ['lines'],
        message: t(K.fields.tooManyLines, { max: PURCHASE_LINES_MAX }),
      };
    }
    const missing = linesMissingRate(current.lines);
    if (missing.length === 0) return null;
    // Each rate cell says it in red; the toast says what to do.
    for (const index of missing) {
      form.setError(`lines.${index}.rate`, {
        type: 'client',
        message: t(K.fields.enterRate),
      });
    }
    openItems();
    return { fields: [], message: t(K.fields.enterRate) };
  };
}

/**
 * A refused save's `409` (a stale one aside): "Paid" above the bill (`more_than_due`)
 * or on a branch whose day is closed (`day_closed`) goes on the Paid field;
 * any other refusal is the server's.
 */
function usePaidConflict(
  form: UseFormReturn<StockPurchaseFormValues>,
  openPayment: () => void,
) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  return (error: HttpError) => {
    const key = PAID_REFUSALS.get(apiErrorReason(error) ?? '');
    if (!key) {
      notify.error(mapApiError(error));
      return;
    }
    const message = t(key);
    form.setError('paid', { type: 'server', message });
    openPayment();
    notify.error(message);
  };
}

/** What the save reads. */
interface PurchaseSaveInput {
  form: UseFormReturn<StockPurchaseFormValues>;
  /** The purchase as last read — an edit; null for a new one. */
  saved: StockPurchaseRecord | null;
  /** The form's lines now — the server's line errors go on their rows. */
  lines: readonly PurchaseLineValues[];
  payment: PurchasePayment | null;
  setOpenStep: (step: string) => void;
  onClose: () => void;
  reload: () => Promise<void>;
}

/**
 * The purchase's save — past the Bill step's "Pick a supplier", which the
 * drawer asks first. A new purchase checks its lines, then records the bill
 * and receives them — "Purchase saved · stock updated" — with its "Paid" as a
 * supplier-bill payment. An edit saves what changed of the bill's details
 * with its read's `updated_at` ("Purchase saved"). A field the API names goes
 * on its field — a line's on its row.
 */
function usePurchaseSave({
  form,
  saved,
  lines,
  payment,
  setOpenStep,
  onClose,
  reload,
}: PurchaseSaveInput) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const create = useCreateStockPurchase({
    notifyOnError: false,
    successMessage: t(K.savedStock),
  });
  const update = useUpdateStockPurchase({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const checkLines = useLinesCheck(form, () => setOpenStep('items'));
  const onConflict = usePaidConflict(form, () => setOpenStep('payment'));
  return useDrawerSave<StockPurchaseFormValues, StockPurchaseRecord>({
    form,
    fieldOrder: purchaseFieldOrder(lines),
    serverFields: purchaseServerFields(lines),
    toastId: 'stock-purchase-save-failed',
    check: saved ? undefined : checkLines,
    onConflict,
    onStale: saved ? () => void reload() : undefined,
    onField: (field) => setOpenStep(stepOfField(field)),
    write: () =>
      saved
        ? update.mutateAsync({ record: saved, input: purchaseChangeOf(form.getValues()) })
        : create.mutateAsync(purchaseInputOf(form.getValues(), payment)),
    onDone: () => onClose(),
  });
}

/** The supplier's name: the vendor list's, or — before it loads — the saved purchase's. */
function useVendorName(
  vendorId: string | null,
  record: StockPurchaseRow | null,
): string | undefined {
  const vendors = useStockVendorCatalogue().data ?? [];
  const listed = vendors.find((vendor) => vendor.id === vendorId)?.name;
  if (listed !== undefined) return listed;
  return record?.vendorId === vendorId ? record?.vendor?.name : undefined;
}

/** What differs between New and Edit purchase: the title, the tag, Quick fill and the save's label. */
function sessionChrome(
  record: StockPurchaseRow | null,
  reorderFill: QuickFillItem,
  t: TFunction,
) {
  if (!record) {
    return { title: t(K.title.create), quickFill: [reorderFill], saveLabel: t(K.save) };
  }
  return {
    title: t(K.title.edit),
    tag: displayId.stockPurchase(record.seq),
    saveLabel: t(STOCK_DRAWER_KEYS.saveChanges),
  };
}

/** Edit purchase's Delete confirm: "Delete this purchase?", the supplier in its pill. */
function PurchaseDeleteConfirm({
  record,
  vendorName,
  open,
  onClose,
  onDeleted,
}: {
  record: StockPurchaseRow | null;
  vendorName: string | undefined;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  if (!record) return null;
  return (
    <StockDeleteConfirm
      target={
        open
          ? {
              kind: 'purchase',
              id: record.id,
              name: displayId.stockPurchase(record.seq),
              seq: record.seq,
              record: vendorName ?? record.vendor?.name,
            }
          : null
      }
      onClose={onClose}
      onDeleted={onDeleted}
    />
  );
}

/** One opening of the drawer: the form, its steps and its save. */
function PurchaseSession({
  open,
  onClose,
  purchase,
  reorder,
  openChild,
  testId,
}: StockPurchaseDrawerBaseProps & {
  purchase: StockPurchaseRow | null;
  reorder: boolean;
  testId: string;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { readOnly, canDelete } = useStockDrawerAccess(purchase !== null);
  const catalogue = useStockItemCatalogue().data;
  const payment = usePurchasePayment(purchase === null);
  const idPrefix = `stock-purchase-${useId().replace(/:/g, '')}`;
  const form = useForm<StockPurchaseFormValues>({
    defaultValues: initialForm(purchase, reorder ? catalogue : undefined),
  });
  const { record, reload } = useEditingRecord({
    record: purchase,
    form,
    formOf: purchaseFormOf,
    read: readStockPurchase,
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>(reorder ? 'items' : 'bill');
  const [deleting, setDeleting] = useState(false);
  const reorderFill = useReorder((lines) => {
    form.setValue('lines', lines, { shouldDirty: true });
    setOpenStep('items');
  });
  const askDelete = usePurchaseDelete<StockPurchaseRecord>(() => setDeleting(true));

  const { saveState, save } = usePurchaseSave({
    form,
    saved: record,
    lines: values.lines,
    payment,
    setOpenStep,
    onClose,
    reload,
  });

  const vendorName = useVendorName(values.vendorId, record);
  const steps = useSteps(
    { form, idPrefix, readOnly, openChild, testId, saved: record, payment },
    values,
    vendorName,
  );
  const badges = usePurchaseBadges(values, vendorName, record);

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        {...sessionChrome(record, reorderFill, t)}
        sub={t(K.sub)}
        badges={badges}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.stock}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        summary={vendorName ?? ''}
        readOnly={readOnly}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={record && canDelete ? () => askDelete(record) : undefined}
        onMissing={() => notify.warning(t(K.pickSupplier))}
        dirty={isDirty}
        testId={testId}
      />
      <PurchaseDeleteConfirm
        record={record}
        vendorName={vendorName}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={onClose}
      />
    </>
  );
}

/**
 * New / Edit purchase (KICKOFF §6.8 Drawers; `clinic-stock.md:142–157, 247–259`)
 * on the shared record drawer, 840px, on clinozy-be: "Bill" — Supplier* (a
 * clinic vendor, "New clinic vendor" stacked), Invoice no., Bill date (never
 * after today) — "Items received" — 1 to 50 rows, each an item ("New clinic
 * item" stacked), its quantity and rate — and "Payment" — Bill amount (the
 * lines' total until typed) and, for a member who may pay, "Paid": the amount,
 * Cash · UPI · Card and the paying branch, a supplier-bill payment with the
 * purchase. The badges say the supplier, the bill and what is due. A new
 * purchase offers "⚡ Reorder low items" (`?reorder=low` presets it); its
 * lines are received into stock — "Purchase saved · stock updated". Editing
 * changes the bill's details only — the lines were received, and what is paid
 * is the server's — and adds Delete, for an unpaid purchase.
 */
export function StockPurchaseDrawer(props: StockPurchaseDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const catalogue = useStockItemCatalogue();
  const testId = props.testId ?? STOCK_DRAWER_TEST_IDS.purchase;
  const reorder = props.mode === 'create' && props.prefill?.reorder === 'low';
  // "Reorder low items" from the URL waits for the items it orders.
  if ((props.mode === 'edit' && !props.purchase) || (reorder && !catalogue.data)) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(props.mode === 'edit' ? K.title.edit : K.title.create)}
        sub={t(K.sub)}
        recordLabel={t(STOCK_DRAWER_KEYS.records.purchase)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const purchase = props.mode === 'edit' ? (props.purchase ?? null) : null;
  return (
    <PurchaseSession
      key={`${session}-${purchase?.id ?? 'new'}`}
      open={props.open}
      onClose={props.onClose}
      openChild={props.openChild}
      purchase={purchase}
      reorder={reorder}
      testId={testId}
    />
  );
}
