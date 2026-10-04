import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MONEY_SCALE, numberFromText } from '@/lib/number-text.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { StockPurchase } from '@/shared/api/clinic/clinic-schema.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
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
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useStockDrawerAccess } from '../../hooks/useStockAccess/index.ts';
import {
  useStockItemCatalogue,
  useStockVendorCatalogue,
} from '../../hooks/useStockLists/index.ts';
import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import {
  useCreateStockPurchase,
  useUpdateStockPurchase,
} from '../../hooks/useStockWrites/index.ts';
import type { StockItemRow, StockPurchaseRow } from '../../stock-contracts.ts';
import {
  STOCK_DRAWER_KEYS,
  STOCK_DRAWER_TEST_IDS,
  STOCK_DRAWERS_NS,
} from '../../stock-drawers.constants.ts';
import { StockDeleteConfirm } from '../StockDeleteConfirm/index.ts';
import {
  billOf,
  dueOf,
  linesMissingRate,
  newPurchaseForm,
  purchaseFormOf,
  purchaseInputOf,
  reorderLines,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';
import {
  BillFields,
  ItemsFields,
  PaymentFields,
  type PurchaseFieldsProps,
} from './StockPurchaseFields.tsx';

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

/** The step that holds a field the save stopped on. */
const stepOfField = (field: string) => {
  if (field.startsWith('lines')) return 'items';
  return field === 'bill' || field === 'paid' ? 'payment' : 'bill';
};

/** The header's badges (`clinic-stock.md:256`): the supplier, the bill, what is due or Paid. */
function badgesOf(
  values: StockPurchaseFormValues,
  vendorName: string | undefined,
  formatPaise: (paise: number) => string,
  t: TFunction,
): DrawerBadge[] {
  const due = dueOf(values);
  return [
    { id: 'vendor', label: vendorName ?? t(K.noSupplier), tone: 'sky' },
    { id: 'bill', label: t(K.bill, { amount: formatPaise(billOf(values)) }) },
    due > 0
      ? { id: 'due', label: t(K.due, { amount: formatPaise(due) }), tone: 'blush' }
      : { id: 'due', label: t(K.paid), tone: 'sage' },
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
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const lines = values.lines.filter((line) => line.itemId !== null);
  const billNo = values.billNo.trim();
  const paid = numberFromText(values.paid, MONEY_SCALE);
  return [
    {
      id: 'bill',
      title: t(K.steps.bill),
      summary: [vendorName, billNo].filter(Boolean).join(' · ') || notFilled,
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
      summary:
        lines.length > 0
          ? t(K.fields.peek, { count: lines.length, amount: formatPaise(billOf(values)) })
          : notFilled,
      content: <ItemsFields {...body} />,
    },
    {
      id: 'payment',
      title: t(K.steps.payment),
      summary: [formatPaise(billOf(values)), paid > 0 ? formatPaise(paid) : '']
        .filter(Boolean)
        .join(' · '),
      peek: [
        {
          kind: 'value',
          label: t(K.fields.billAmount),
          value: formatPaise(billOf(values)),
        },
        {
          kind: 'value',
          label: t(K.fields.paid),
          value: paid > 0 ? formatPaise(paid) : '',
        },
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

/** What a session opens with: the saved purchase, or a new one — its lines reordered when asked. */
function initialForm(
  purchase: StockPurchaseRow | null,
  reorderFrom: readonly StockItemRow[] | undefined,
): StockPurchaseFormValues {
  if (purchase) return purchaseFormOf(purchase);
  return newPurchaseForm(reorderFrom ? reorderLines(reorderFrom) : []);
}

/**
 * The purchase's save — past the Bill step's "Pick a supplier", which the
 * drawer asks first: every picked line's rate, each cell red with "Enter the
 * rate" (validated before submit, §7.3); a new purchase with lines says
 * "Purchase saved · stock updated".
 */
function usePurchaseSave({
  form,
  purchase,
  setOpenStep,
  onClose,
}: {
  form: UseFormReturn<StockPurchaseFormValues>;
  purchase: StockPurchaseRow | null;
  setOpenStep: (step: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const create = useCreateStockPurchase({
    notifyOnError: false,
    successMessage: (_saved, input) => t(input.lines.length > 0 ? K.savedStock : K.saved),
  });
  const update = useUpdateStockPurchase({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  return useDrawerSave<StockPurchaseFormValues, StockPurchase>({
    form,
    fieldOrder: ['vendorId', 'billNo', 'date', 'lines', 'bill', 'paid'],
    toastId: 'stock-purchase-save-failed',
    check: (current) => {
      form.clearErrors('lines');
      const missing = linesMissingRate(current.lines);
      if (missing.length === 0) return null;
      // Each rate cell says it in red; the toast says what to do.
      for (const index of missing) {
        form.setError(`lines.${index}.rate`, {
          type: 'client',
          message: t(K.fields.enterRate),
        });
      }
      setOpenStep('items');
      return { fields: [], message: t(K.fields.enterRate) };
    },
    onField: (field) => setOpenStep(stepOfField(field)),
    write: () => {
      const input = purchaseInputOf(form.getValues());
      return purchase
        ? update.mutateAsync({ id: purchase.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone: () => onClose(),
  });
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
  const formatPaise = usePaiseFormat();
  const { readOnly, canDelete } = useStockDrawerAccess(purchase !== null);
  const catalogue = useStockItemCatalogue().data;
  const vendors = useStockVendorCatalogue().data ?? [];
  const idPrefix = `stock-purchase-${useId().replace(/:/g, '')}`;
  const form = useForm<StockPurchaseFormValues>({
    defaultValues: initialForm(purchase, reorder ? catalogue : undefined),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>(reorder ? 'items' : 'bill');
  const [deleting, setDeleting] = useState(false);
  const fillLines = (lines: StockPurchaseFormValues['lines']) => {
    form.setValue('lines', lines, { shouldDirty: true });
    setOpenStep('items');
  };
  const reorderFill = useReorder(fillLines);

  const { saveState, save } = usePurchaseSave({ form, purchase, setOpenStep, onClose });

  const vendorName = vendors.find((vendor) => vendor.id === values.vendorId)?.name;
  const steps = useSteps(
    { form, idPrefix, readOnly, openChild, testId },
    values,
    vendorName,
  );

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(purchase ? K.title.edit : K.title.create)}
        tag={purchase ? displayId.stockPurchase(purchase.seq) : undefined}
        sub={t(K.sub)}
        badges={badgesOf(values, vendorName, formatPaise, t)}
        quickFill={purchase ? undefined : [reorderFill]}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.stock}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        summary={vendorName ?? ''}
        readOnly={readOnly}
        saveLabel={t(purchase ? STOCK_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        onMissing={() => notify.warning(t(K.pickSupplier))}
        dirty={isDirty}
        testId={testId}
      />
      {purchase ? (
        <StockDeleteConfirm
          target={
            deleting
              ? {
                  kind: 'purchase',
                  id: purchase.id,
                  name: displayId.stockPurchase(purchase.seq),
                  seq: purchase.seq,
                  record: vendorName ?? purchase.vendor?.name,
                }
              : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit purchase (KICKOFF §6.8 Drawers; `clinic-stock.md:142–157, 247–259`)
 * on the shared record drawer, 840px: "Bill" — Supplier* (a clinic vendor, "New
 * clinic vendor" stacked), Invoice no., Bill date — "Items received" — the
 * rows, each an item ("New clinic item" stacked), its quantity and rate — and
 * "Payment" — Bill amount (the lines' total until typed) and Paid ("Full" ·
 * "Nothing"). The badges say the supplier, the bill and what is due. A new
 * purchase offers "⚡ Reorder low items" (`?reorder=low` presets it); its lines
 * are received into stock — "Purchase saved · stock updated". Editing adds
 * Delete. The Paid field stores `paid` without a ledger entry (AMBER).
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
