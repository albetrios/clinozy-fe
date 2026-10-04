import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Branch } from '@/shared/api/clinic/clinic-schema.ts';
import type { OpenInvoice } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  PATIENT_PICKER_KEYS,
  PATIENT_PICKER_NS,
  type PatientPick,
  PatientPicker,
} from '@/shared/components/PatientPicker/index.ts';
import { SplitRowsField, splitsTotal } from '@/shared/forms/SplitRowsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import type { ReceiveFormValues } from './receive-form.ts';

const K = PAYMENTS_KEYS.receive;

/** Reference and Note limits — the contract's (`payments-contracts`). */
const LIMITS = { reference: 30, note: 280 } as const;

/** Props of {@link ReceiveFields}. */
export interface ReceiveFieldsProps {
  form: UseFormReturn<ReceiveFormValues>;
  values: ReceiveFormValues;
  idPrefix: string;
  testId: string;
  /** The branches to choose from — the field shows with two or more. */
  branches: readonly Pick<Branch, 'id' | 'name' | 'tone'>[];
  /** The picked patient's open invoices, oldest first; null while none is picked. */
  invoices: readonly OpenInvoice[] | null;
  /** The due the rows may reach — the picked invoice's; null without one. */
  due: number | null;
  /** An edit: the patient and the invoice are the entry's. */
  editing: boolean;
  readOnly: boolean;
  onPatient: (patient: PatientPick | null) => void;
  onInvoice: (invoice: OpenInvoice) => void;
}

/** "Pick the patient first" / "Nothing due": the inert chip the invoice field shows instead. */
function InertChip({ label, testId }: { label: string; testId: string }) {
  return (
    <span
      data-slot="pill"
      data-testid={testId}
      className="bg-canvas text-muted-foreground inline-flex h-6 w-fit items-center rounded-full px-2.5 text-xs font-medium"
    >
      {label}
    </span>
  );
}

/** "Against invoice": the open invoices as chips, peach once picked, each typed in its tooltip. */
function InvoiceChips({
  invoices,
  picked,
  onPick,
  disabled,
  testId,
}: {
  invoices: readonly OpenInvoice[] | null;
  picked: string | null;
  onPick: (invoice: OpenInvoice) => void;
  disabled: boolean;
  testId: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  if (invoices === null)
    return <InertChip label={t(K.pickPatientFirst)} testId={testId} />;
  if (invoices.length === 0) return <InertChip label={t(K.nothingDue)} testId={testId} />;
  return (
    <DrawerChips
      label={t(K.invoice)}
      options={invoices.map((invoice) => ({
        value: invoice.id,
        label: t(K.invoiceChip, {
          id: displayId.invoiceNumber(invoice.seq),
          due: formatPaise(invoice.due),
        }),
        tone: invoice.id === picked ? ('peach' as const) : undefined,
        hint: tClinic(CLINIC_KEYS.invoiceTypes[invoice.type]),
      }))}
      value={picked}
      onChange={(id) => {
        const invoice = invoices.find((open) => open.id === id);
        if (invoice) onPick(invoice);
      }}
      disabled={disabled}
      testId={testId}
    />
  );
}

/**
 * Receive payment's one section, "Who is paying" (`payments.md:95–104`;
 * H:5069–5071): Branch (with two or more open branches) · Patient (only
 * patients, with their dues) · Against invoice (the open ones, peach once
 * picked) · Amount received (Mode · Amount rows, "+ Split · add a mode" until
 * every mode is used, "Total ₹8,550 · due ₹8,550") · Reference · Note.
 */
export function ReceiveFields({
  form,
  values,
  idPrefix,
  testId,
  branches,
  invoices,
  due,
  editing,
  readOnly,
  onPatient,
  onInvoice,
}: ReceiveFieldsProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tPicker } = useTranslation(PATIENT_PICKER_NS);
  const formatPaise = usePaiseFormat();
  const field = useDrawerFieldIds(form, idPrefix);
  const patient = field('patientId');
  const reference = field('reference');
  const note = field('note');
  const total = splitsTotal(values.splits);
  const openCount = invoices?.length ?? 0;

  return (
    <DrawerFieldGrid title={t(K.section)}>
      {branches.length > 1 ? (
        <DrawerField span="half" stretch={false} label={t(K.branch)}>
          <Controller
            control={form.control}
            name="branchId"
            render={({ field: control }) => (
              <DrawerChips
                label={t(K.branch)}
                options={branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                  tone: branch.tone,
                }))}
                value={control.value}
                onChange={(id) => {
                  if (id) control.onChange(id);
                }}
                disabled={readOnly || editing}
                testId={`${testId}-branch`}
              />
            )}
          />
        </DrawerField>
      ) : null}
      <DrawerField
        span="half"
        label={tPicker(PATIENT_PICKER_KEYS.label)}
        htmlFor={patient.id}
        required
        hint={tPicker(PATIENT_PICKER_KEYS.hint)}
        error={patient.error}
      >
        <PatientPicker
          id={patient.id}
          aria-describedby={patient.control['aria-describedby']}
          invalid={Boolean(patient.error)}
          value={values.patientId}
          onChange={onPatient}
          disabled={readOnly || editing}
          testId={`${testId}-patient`}
        />
      </DrawerField>
      <DrawerField
        label={t(K.invoice)}
        hint={openCount > 1 ? t(K.invoiceOpen, { count: openCount }) : undefined}
      >
        <InvoiceChips
          invoices={invoices}
          picked={values.invoiceId}
          onPick={onInvoice}
          disabled={readOnly || editing}
          testId={`${testId}-invoice`}
        />
      </DrawerField>
      <DrawerField label={t(K.amount)} required>
        <SplitRowsField
          control={form.control}
          label={t(K.amount)}
          rows={values.splits}
          limit={due}
          compact
          addLabel={t(K.split)}
          total={
            due === null
              ? t(K.total, { total: formatPaise(total) })
              : t(K.totalDue, { total: formatPaise(total), due: formatPaise(due) })
          }
          readOnly={readOnly}
          testId={`${testId}-splits`}
        />
      </DrawerField>
      <DrawerField
        span="third"
        label={t(K.reference)}
        htmlFor={reference.id}
        hint={t(K.referenceHint)}
      >
        <DrawerInput
          {...reference.control}
          {...form.register('reference')}
          capitalize={false}
          maxLength={LIMITS.reference}
          placeholder={t(K.referencePlaceholder)}
          autoComplete="off"
          readOnly={readOnly}
          data-testid={`${testId}-reference`}
        />
      </DrawerField>
      <DrawerField span="half" label={t(K.note)} htmlFor={note.id}>
        <DrawerInput
          {...note.control}
          {...form.register('note')}
          maxLength={LIMITS.note}
          placeholder={t(K.notePlaceholder)}
          autoComplete="off"
          readOnly={readOnly}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
