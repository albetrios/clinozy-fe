import type { ReactNode } from 'react';
import { useController, useForm, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import type { MedicalPurchaseOrder } from '@/shared/api/clinic/clinic-schema.ts';
import { SECTION_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerFieldGrid } from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  ITEMS_QTY_MAX,
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsReadCell,
  type ItemsRowContext,
  ItemsTextCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { Check, X } from '@/shared/icons/index.ts';

import { MEDICAL_KEYS } from '../../../medical.constants.ts';
import { useReceivePurchaseOrder } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { OpenMedicalChild } from '../../../shared/hooks/useMedicalStack/index.ts';
import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import { useMedicalDrawerAccess } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import {
  rateMessage,
  useMedicineOptions,
} from '../PurchaseOrderDrawer/order-medicine.ts';
import { OrderMedicineCell } from '../PurchaseOrderDrawer/OrderMedicineCell.tsx';
import {
  anyArrived,
  emptyUnexpectedLine,
  expiryProblems,
  receiveFormOf,
  type ReceiveFormValues,
  receiveInputOf,
  receiveLineCount,
  receiveTotal,
  unexpectedProblems,
} from './receive-form.ts';

const K = MEDICAL_DRAWER_KEYS.receive;
const F = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** Item rows: 840px (`medical.md:334`). */
const CONTENT_PROFILE = { fieldCount: 1, hasItems: true } as const;

/** A batch number's longest text (the medicine drawer's). */
const BATCH_MAX = 30;

/** Props of {@link ReceiveGoodsDrawer}. */
export interface ReceiveGoodsDrawerProps {
  open: boolean;
  /** Every exit, and after the goods are received. */
  onClose: () => void;
  /** The Ordered order once read; the drawer shimmers until then. */
  order: PurchaseOrderRow | undefined;
  /** An unexpected line's "New medicine · “q”" opens it on top (`medical.md:319`). */
  openChild?: OpenMedicalChild;
  testId?: string;
}

type LineContext = ItemsRowContext<ReceiveFormValues, 'lines'>;

/** A line's Arrived ✓ / ✗ (`medical.md:271`): a 32px toggle, ✓ in sage, ✗ muted. */
function ArrivedCell({
  form,
  index,
  disabled,
  testId,
}: {
  form: UseFormReturn<ReceiveFormValues>;
  index: number;
  disabled: boolean;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { field } = useController({
    control: form.control,
    name: `lines.${index}.arrived`,
  });
  const Icon = field.value ? Check : X;
  return (
    <button
      type="button"
      aria-pressed={field.value}
      aria-label={t(field.value ? K.arrived : K.notArrived)}
      disabled={disabled}
      onClick={() => field.onChange(!field.value)}
      data-testid={testId}
      className={cn(
        'flex size-8 items-center justify-center rounded-md border transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        field.value
          ? cn(TONE_CLASSES.sage.surface, 'border-current')
          : 'bg-muted text-muted-foreground border-transparent',
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

/**
 * An unexpected line's figure on a phone, where the table drops its header
 * row: the column's name before it, as the header reads (10.5px uppercase).
 * The control carries the same name as its accessible name.
 */
function PhoneCaption({ label, children }: { label: string; children: ReactNode }) {
  if (useViewportTier() !== 'phone') return children;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="text-tiny text-muted-foreground font-semibold tracking-[0.04em] uppercase"
      >
        {label}
      </span>
      {children}
    </span>
  );
}

/** What the columns read beside the form. */
interface ColumnsContext {
  form: UseFormReturn<ReceiveFormValues>;
  readOnly: boolean;
  order: PurchaseOrderRow;
  openChild?: OpenMedicalChild;
  /** An unexpected line is in the table: the Rate column joins it. */
  priced: boolean;
}

/**
 * Arrived · Medicine · Qty · Free · Batch · Expiry (`medical.md:271–275`;
 * H:5388). An ordered line reads its medicine, counts and rate from the
 * order; an unexpected line picks its medicine (the purchase order's picker,
 * "New medicine" included) and types its counts and rate — the Rate column
 * shows while one is in the table, read-only on the ordered lines.
 */
function useColumns({
  form,
  readOnly,
  order,
  openChild,
  priced,
}: ColumnsContext): ItemsColumn<ReceiveFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const options = useMedicineOptions(order.supplierId, order.supplierName);
  // A line that did not come takes no batch, expiry or figures.
  const locked = (row: LineContext) => readOnly || !row.row.arrived;
  const count = (key: 'qty' | 'free') => (row: LineContext) =>
    row.row.unexpected ? (
      <PhoneCaption label={row.label}>
        <ItemsNumberCell
          {...row.bind(key)}
          max={ITEMS_QTY_MAX}
          maxLength={4}
          readOnly={locked(row)}
          className="max-md:w-14"
        />
      </PhoneCaption>
    ) : (
      <ItemsReadCell>{String(row.row[key])}</ItemsReadCell>
    );
  const rate: ItemsColumn<ReceiveFormValues, 'lines'> = {
    id: 'rate',
    header: t(F.rate),
    track: '90px',
    align: 'end',
    cell: (row) =>
      row.row.unexpected ? (
        <PhoneCaption label={row.label}>
          <ItemsNumberCell
            {...row.bind('rate')}
            money
            placeholder={t(F.rate)}
            readOnly={locked(row)}
            className="max-md:w-24"
          />
        </PhoneCaption>
      ) : (
        <ItemsReadCell>{formatPaise(row.row.rate)}</ItemsReadCell>
      ),
  };
  return [
    {
      id: 'arrived',
      header: t(K.arrived),
      track: '64px',
      cell: (row) => (
        <ArrivedCell
          form={form}
          index={row.index}
          disabled={!row.editable}
          testId={row.testId}
        />
      ),
    },
    {
      id: 'medicine',
      header: t(K.medicine),
      track: 'minmax(0,2fr)',
      cell: (row) =>
        row.row.unexpected ? (
          <OrderMedicineCell<ReceiveFormValues>
            binding={row.bind('medicineId')}
            options={options}
            supplierId={order.supplierId}
            openChild={openChild}
            disabled={locked(row)}
            onMedicine={(medicine) => {
              const line = `lines.${row.index}` as const;
              form.setValue(`${line}.medicineId`, medicine.id, { shouldDirty: true });
              form.setValue(`${line}.name`, medicine.name);
              form.setValue(`${line}.rate`, medicine.rate, { shouldDirty: true });
            }}
          />
        ) : (
          <ItemsReadCell strong>{row.row.name}</ItemsReadCell>
        ),
    },
    { id: 'qty', header: t(K.qty), track: '56px', align: 'end', cell: count('qty') },
    { id: 'free', header: t(K.free), track: '56px', align: 'end', cell: count('free') },
    ...(priced ? [rate] : []),
    {
      id: 'batch',
      header: t(K.batch),
      track: '120px',
      cell: (row) => (
        <ItemsTextCell
          {...row.bind('batchNo')}
          placeholder={t(K.batch)}
          maxLength={BATCH_MAX}
          readOnly={locked(row)}
        />
      ),
    },
    {
      id: 'expiry',
      header: t(K.expiry),
      track: '90px',
      cell: (row) => (
        <ItemsTextCell
          {...row.bind('expiry')}
          placeholder={t(K.expiryPlaceholder)}
          maxLength={5}
          readOnly={locked(row)}
        />
      ),
    },
  ];
}

/**
 * Mark received — each arrived line's expiry first: an empty one is red with
 * "Enter the expiry", one not "MM/YY" with "Enter the expiry as MM/YY"
 * (AMBER: the prototype invents "12/27"); then an unexpected line's count
 * ("Enter a quantity") and rate ("Enter the rate for Epriva Tab", as the
 * purchase order asks); nothing ticked says "Tick what arrived".
 */
function useReceiveSave(
  form: UseFormReturn<ReceiveFormValues>,
  order: PurchaseOrderRow,
  onClose: () => void,
) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const receive = useReceivePurchaseOrder({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  return useDrawerSave<ReceiveFormValues, MedicalPurchaseOrder>({
    form,
    fieldOrder: ['lines'],
    toastId: 'receive-goods-save-failed',
    check: (current) => {
      form.clearErrors('lines');
      if (!anyArrived(current.lines)) return { fields: [], message: t(K.tickArrived) };
      const expiry = expiryProblems(current.lines);
      const unexpected = unexpectedProblems(current.lines);
      const expiryMessage = (problem: string) =>
        problem === 'missing'
          ? t(K.enterExpiry)
          : t(MEDICAL_DRAWER_KEYS.medicine.batches.expiryInvalid);
      const flag = (field: 'expiry' | 'qty' | 'rate', index: number, message: string) =>
        form.setError(`lines.${index}.${field}`, { type: 'client', message });
      for (const { index, problem } of expiry)
        flag('expiry', index, expiryMessage(problem));
      for (const index of unexpected.qty) flag('qty', index, t(K.enterQuantity));
      for (const index of unexpected.rate) flag('rate', index, t(F.enterRate));
      const [first] = expiry;
      if (first) return { fields: [], message: expiryMessage(first.problem) };
      if (unexpected.qty.length) return { fields: [], message: t(K.enterQuantity) };
      if (unexpected.rate.length) {
        const names = unexpected.rate.map((index) => current.lines[index]?.name);
        return { fields: [], message: rateMessage(names, t) };
      }
      return null;
    },
    // One section: every field is in view.
    onField: () => undefined,
    write: () =>
      receive.mutateAsync({ id: order.id, input: receiveInputOf(form.getValues()) }),
    onDone: () => onClose(),
  });
}

/** One opening of the drawer on an Ordered order. */
function ReceiveSession({
  open,
  onClose,
  order,
  openChild,
  testId,
}: Omit<ReceiveGoodsDrawerProps, 'order' | 'testId'> & {
  order: PurchaseOrderRow;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { readOnly } = useMedicalDrawerAccess(true);
  const form = useForm<ReceiveFormValues>({ defaultValues: receiveFormOf(order) });
  const lines = useWatch({ control: form.control, name: 'lines' });
  const { saveState, save } = useReceiveSave(form, order, onClose);
  const columns = useColumns({
    form,
    readOnly,
    order,
    openChild,
    priced: lines.some((line) => line.unexpected),
  });
  const total = formatPaise(receiveTotal(order, lines));
  // The supplier, the lines and their bill, which follow the unexpected ones (H:5394).
  const badges: DrawerBadge[] = [
    { id: 'supplier', label: order.supplierName, tone: 'sky' },
    {
      id: 'items',
      label: t(MEDICAL_KEYS.purchases.items, { count: receiveLineCount(lines) }),
    },
    { id: 'total', label: total },
  ];
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      tag={`#${order.seq}`}
      sub={t(K.sub, { supplier: isolateText(order.supplierName) })}
      badges={badges}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      summary={total}
      readOnly={readOnly}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      testId={testId}
    >
      {/* One section, under its heading "Tick what arrived" (H:5388). */}
      <DrawerFieldGrid title={t(K.section)}>
        <ItemsField
          control={form.control}
          name="lines"
          label={t(K.section)}
          columns={columns}
          newRow={emptyUnexpectedLine}
          addLabel={t(K.addUnexpected)}
          readOnly={readOnly}
          removable={(line) => line.unexpected}
          testId={`${testId}-lines`}
        />
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}

/**
 * Receive goods (KICKOFF §6.7 Drawers; `medical.md:269–279`; H:5387–5392) on
 * an Ordered order, 840px: under the header the supplier, the lines and their
 * bill as chips (H:5394), then one section — "Tick what arrived": each line
 * Arrived ✓ (by default) or ✗, its medicine, qty and free units, and the batch
 * and expiry it came with. "+ Add unexpected item" adds a line for what came
 * but was not ordered — its medicine, counts, rate, batch and expiry; × drops
 * it (the prototype's button adds nothing, H:5388). "Mark received" adds every
 * arrived line to stock — qty + free into its batch ("NEW-430" when none is
 * typed) — and the order becomes a bill to pay, the unexpected lines on it:
 * "Goods received · stock and free quantity added". The summary is that bill.
 */
export function ReceiveGoodsDrawer({ testId: id, ...props }: ReceiveGoodsDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = id ?? MEDICAL_DRAWER_TEST_IDS.receive;
  if (!props.order) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.purchaseOrder)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  return (
    <ReceiveSession
      key={`${session}-${props.order.id}`}
      {...props}
      order={props.order}
      testId={testId}
    />
  );
}
