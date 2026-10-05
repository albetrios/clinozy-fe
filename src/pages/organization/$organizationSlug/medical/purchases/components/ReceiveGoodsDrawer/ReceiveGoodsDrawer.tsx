import { useController, useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { MedicalPurchaseOrder } from '@/shared/api/clinic/clinic-schema.ts';
import { SECTION_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsReadCell,
  ItemsTextCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { Check, X } from '@/shared/icons/index.ts';

import { useReceivePurchaseOrder } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import { useMedicalDrawerAccess } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import {
  anyArrived,
  expiryProblems,
  receiveFormOf,
  type ReceiveFormValues,
  receiveInputOf,
} from './receive-form.ts';

const K = MEDICAL_DRAWER_KEYS.receive;

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
  testId?: string;
}

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

/** Arrived · Medicine · Qty · Free · Batch · Expiry (`medical.md:271–275`; H:5388). */
function useColumns(
  form: UseFormReturn<ReceiveFormValues>,
  readOnly: boolean,
): ItemsColumn<ReceiveFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
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
      cell: ({ row }) => <ItemsReadCell strong>{row.name}</ItemsReadCell>,
    },
    {
      id: 'qty',
      header: t(K.qty),
      track: '56px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{String(row.qty)}</ItemsReadCell>,
    },
    {
      id: 'free',
      header: t(K.free),
      track: '56px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{String(row.free)}</ItemsReadCell>,
    },
    {
      id: 'batch',
      header: t(K.batch),
      track: '120px',
      cell: (row) => (
        <ItemsTextCell
          {...row.bind('batchNo')}
          placeholder={t(K.batch)}
          maxLength={BATCH_MAX}
          readOnly={readOnly || !row.row.arrived}
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
          readOnly={readOnly || !row.row.arrived}
        />
      ),
    },
  ];
}

/**
 * Mark received — each arrived line's expiry first: an empty one is red with
 * "Enter the expiry", one not "MM/YY" with "Enter the expiry as MM/YY"
 * (AMBER: the prototype invents "12/27"); nothing ticked says "Tick what
 * arrived".
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
      const problems = expiryProblems(current.lines);
      const [first] = problems;
      if (!first) return null;
      const messageOf = (problem: string) =>
        problem === 'missing'
          ? t(K.enterExpiry)
          : t(MEDICAL_DRAWER_KEYS.medicine.batches.expiryInvalid);
      for (const { index, problem } of problems) {
        form.setError(`lines.${index}.expiry`, {
          type: 'client',
          message: messageOf(problem),
        });
      }
      return { fields: [], message: messageOf(first.problem) };
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
  testId,
}: Omit<ReceiveGoodsDrawerProps, 'order' | 'testId'> & {
  order: PurchaseOrderRow;
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { readOnly } = useMedicalDrawerAccess(true);
  const form = useForm<ReceiveFormValues>({ defaultValues: receiveFormOf(order) });
  const { saveState, save } = useReceiveSave(form, order, onClose);
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      tag={`#${order.seq}`}
      sub={t(K.sub, { supplier: order.supplierName })}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      summary={formatPaise(order.total)}
      readOnly={readOnly}
      saveLabel={t(K.save)}
      onSave={() => void save()}
      saveState={saveState}
      testId={testId}
    >
      <ItemsField
        control={form.control}
        name="lines"
        label={t(K.section)}
        columns={useColumns(form, readOnly)}
        readOnly={readOnly}
        removable={false}
        testId={`${testId}-lines`}
      />
    </RecordDrawer>
  );
}

/**
 * Receive goods (KICKOFF §6.7 Drawers; `medical.md:269–279`; H:5387–5392) on
 * an Ordered order, 840px, one section — "Tick what arrived": each line
 * Arrived ✓ (by default) or ✗, its medicine, qty and free units, and the batch
 * and expiry it came with. "Mark received" adds every arrived line to stock —
 * qty + free into its batch ("NEW-430" when none is typed) — and the order
 * becomes a bill to pay: "Goods received · stock and free quantity added".
 * "+ Add unexpected item" adds nothing in the prototype and is not built.
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
