import { useState } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_MODE_TONES, SECTION_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerStepBody,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsQtyCell,
  ItemsReadCell,
} from '@/shared/forms/ItemsField/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { useReturnSale } from '../../../shared/hooks/useMedicalFlows/index.ts';
import type { SaleRow } from '../../../shared/medical-contracts.ts';
import { useMedicalDrawerAccess } from '../../../shared/medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import {
  REFUND_MODES,
  SALE_RETURN_REASONS,
  type SaleReturnResult,
} from '../../../shared/medical-flows-contracts.ts';
import {
  everythingBack,
  lineRefund,
  linesBack,
  RETURN_REASON_TONES,
  returnAmount,
  saleReturnFormOf,
  type SaleReturnFormValues,
  saleReturnInputOf,
} from './sale-return-form.ts';

const K = MEDICAL_DRAWER_KEYS.saleReturn;

/** The lines table: 840px, as every drawer holding item rows (H:3850). */
const CONTENT_PROFILE = { fieldCount: 3, hasItems: true } as const;

/** Props of {@link SaleReturnDrawer}. */
export interface SaleReturnDrawerProps {
  open: boolean;
  /** Every exit, and after the return is saved. */
  onClose: () => void;
  /** The sale once read; the drawer shimmers until then. */
  sale: SaleRow | undefined;
  testId?: string;
}

/** What the steps' bodies read. */
interface BodyProps {
  form: UseFormReturn<SaleReturnFormValues>;
  readOnly: boolean;
  testId: string;
}

/** Medicine · Batch · Sold · Return · Refund (H:5411). */
function useLineColumns({
  readOnly,
}: Pick<BodyProps, 'readOnly'>): ItemsColumn<SaleReturnFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  return [
    {
      id: 'medicine',
      header: t(K.medicine),
      track: 'minmax(0,2fr)',
      cell: ({ row }) => <ItemsReadCell strong>{row.name}</ItemsReadCell>,
    },
    {
      id: 'batch',
      header: t(K.batch),
      track: '110px',
      cell: ({ row }) => <ItemsReadCell>{row.batchNo}</ItemsReadCell>,
    },
    {
      id: 'sold',
      header: t(K.sold),
      track: '64px',
      align: 'end',
      cell: ({ row }) => <ItemsReadCell>{String(row.sold)}</ItemsReadCell>,
    },
    {
      id: 'return',
      header: t(K.return),
      track: '96px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell
          {...row.bind('qty')}
          min={0}
          max={row.row.sold}
          readOnly={readOnly}
        />
      ),
    },
    {
      id: 'refund',
      header: t(K.refund),
      track: '100px',
      align: 'end',
      cell: ({ row }) => (
        <ItemsReadCell strong>{formatPaise(lineRefund(row))}</ItemsReadCell>
      ),
    },
  ];
}

/** WHAT IS COMING BACK: the sold lines, each with how many return (`medical.md:288`). */
function LinesStep(props: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  return (
    <ItemsField
      control={props.form.control}
      name="lines"
      label={t(K.steps.back)}
      columns={useLineColumns(props)}
      readOnly={props.readOnly}
      removable={false}
      testId={`${props.testId}-lines`}
    />
  );
}

/** REASON & REFUND: Reason (default Unused) · Refund by (default Cash) (`medical.md:289–290`). */
function ReasonStep({ form, readOnly, testId }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (
    <DrawerStepBody readOnly={readOnly}>
      <DrawerFieldGrid>
        <DrawerField span="full" label={t(K.reason)}>
          <Controller
            control={form.control}
            name="reason"
            render={({ field }) => (
              <DrawerChips
                label={t(K.reason)}
                options={SALE_RETURN_REASONS.map((reason) => ({
                  value: reason,
                  label: t(K.reasons[reason]),
                  tone: RETURN_REASON_TONES[reason],
                }))}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value);
                }}
                disabled={readOnly}
                testId={`${testId}-reason`}
              />
            )}
          />
        </DrawerField>
        <DrawerField span="full" label={t(K.refundBy)}>
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <DrawerChips
                label={t(K.refundBy)}
                options={REFUND_MODES.map((mode) => ({
                  value: mode,
                  label: tApp(APP_KEYS.paymentModes[mode]),
                  tone: PAYMENT_MODE_TONES[mode],
                }))}
                value={field.value}
                onChange={(value) => {
                  if (value) field.onChange(value);
                }}
                disabled={readOnly}
                testId={`${testId}-mode`}
              />
            )}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </DrawerStepBody>
  );
}

/** The two step cards, and what each collapsed one summarises. */
function useSteps(body: BodyProps, values: SaleReturnFormValues): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const formatPaise = usePaiseFormat();
  const back = linesBack(values.lines);
  return [
    {
      id: 'back',
      title: t(K.steps.back),
      peek: [
        {
          kind: 'items',
          label: t(K.medicine),
          names: back.map((line) => `${line.name} × ${line.qty}`),
        },
        {
          kind: 'value',
          label: t(K.refund),
          value: back.length > 0 ? formatPaise(returnAmount(values.lines)) : undefined,
        },
      ],
      content: <LinesStep {...body} />,
    },
    {
      id: 'reason',
      title: t(K.steps.reason),
      peek: [
        {
          kind: 'value',
          label: t(K.reason),
          value: t(K.reasons[values.reason]),
          tone: RETURN_REASON_TONES[values.reason],
        },
        {
          kind: 'value',
          label: t(K.refundBy),
          value: tApp(APP_KEYS.paymentModes[values.mode]),
          tone: PAYMENT_MODE_TONES[values.mode],
        },
      ],
      content: <ReasonStep {...body} />,
    },
  ];
}

/** The toast a saved return raises: refunded, or only off the bill; restocked or written off. */
function savedMessage(
  result: SaleReturnResult,
  t: ReturnType<typeof useTranslation>['t'],
  formatPaise: (paise: number) => string,
): string {
  if (result.refunded > 0) {
    return t(result.restocked ? K.refunded : K.refundedWrittenOff, {
      amount: formatPaise(result.refunded),
    });
  }
  return t(result.restocked ? K.lowered : K.loweredWrittenOff, {
    amount: formatPaise(result.amount),
  });
}

/** One opening of the drawer on a read sale. */
function ReturnSession({
  open,
  onClose,
  sale,
  testId,
}: Omit<SaleReturnDrawerProps, 'sale' | 'testId'> & { sale: SaleRow; testId: string }) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const { readOnly } = useMedicalDrawerAccess(true);
  const form = useForm<SaleReturnFormValues>({ defaultValues: saleReturnFormOf(sale) });
  const values = useFormValues(form);
  const [openStep, setOpenStep] = useState('back');
  const returnSale = useReturnSale({
    notifyOnError: false,
    successMessage: (result) => savedMessage(result, t, formatPaise),
  });

  const { saveState, save } = useDrawerSave<SaleReturnFormValues, SaleReturnResult>({
    form,
    fieldOrder: ['lines', 'reason', 'mode'],
    toastId: 'sale-return-save-failed',
    check: (current) => {
      if (linesBack(current.lines).length > 0) return null;
      setOpenStep('back');
      return { fields: [], message: t(K.nothing) };
    },
    onField: (field) => setOpenStep(field.startsWith('lines') ? 'back' : 'reason'),
    write: () =>
      returnSale.mutateAsync({
        saleId: sale.id,
        input: saleReturnInputOf(form.getValues()),
      }),
    onDone: () => onClose(),
  });

  const amount = formatPaise(returnAmount(values.lines));
  const customer = sale.customer?.name ?? t(MEDICAL_DRAWER_KEYS.sale.walkIn);
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title)}
      tag={`#${sale.seq}`}
      sub={t(K.sub, { customer: isolateText(customer) })}
      quickFill={[
        {
          id: 'everything',
          label: t(K.quickFill),
          tone: 'lav',
          onSelect: () => {
            form.setValue('lines', everythingBack(form.getValues('lines')), {
              shouldDirty: true,
            });
            setOpenStep('back');
          },
        },
      ]}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.medical}
      steps={useSteps({ form, readOnly, testId }, values)}
      openStep={openStep}
      onOpenStepChange={setOpenStep}
      summary={t(K.summary, { reason: t(K.reasons[values.reason]), amount })}
      readOnly={readOnly}
      saveLabel={t(K.save, { amount })}
      onSave={() => void save()}
      saveState={saveState}
      testId={testId}
    />
  );
}

/**
 * Return from patient (KICKOFF §6.7 Drawers; `medical.md:283–295`; H:5409–5413),
 * 840px in two steps: "What is coming back" — each sold line with what is
 * still out and how many return, its refund beside it — then "Reason &
 * refund": Unused · Reaction · Doctor changed Rx · Wrong item · Damaged, paid
 * back by Cash · UPI · Card. "⚡ Return everything" fills every line. "Refund
 * ₹550" writes the return: stock back into its batch — written off for a
 * reaction or damage — and, when the sale was paid, a credit note and the
 * refund on the ledger. An unpaid sale's return lowers what is due instead
 * (AMBER: the "Refund" wording stays). Nothing coming back: "Enter what is
 * being returned".
 */
export function SaleReturnDrawer({ testId: id, ...props }: SaleReturnDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = id ?? MEDICAL_DRAWER_TEST_IDS.saleReturn;
  if (!props.sale) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.sale)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  return (
    <ReturnSession
      key={`${session}-${props.sale.id}`}
      {...props}
      sale={props.sale}
      testId={testId}
    />
  );
}
