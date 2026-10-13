import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { paiseOfRupees } from '@/lib/number-text.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { invoiceQueryKeys, listOpenInvoices } from '@/shared/api/app/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { fetchPayment, paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { defaultBranchId } from '@/shared/app/app-branch.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import type { PatientPick } from '@/shared/components/PatientPicker/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { splitsModes, splitsTotal } from '@/shared/forms/SplitRowsField/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useEditingRecord } from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import {
  useOpenInvoices,
  useReceivePayment,
  useUpdatePayment,
} from '@/shared/hooks/usePayments/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import type { PaymentReceiveSearch } from '../../payments.dialog-search.ts';
import {
  dueInPaise,
  emptyReceiveForm,
  halfOf,
  modesTone,
  quickFillSplits,
  RECEIVE_QUICK_FILLS,
  receiveFormOf,
  type ReceiveFormValues,
  receiveInputOf,
  receivePatchOf,
  type ReceiveProblem,
  receiveProblem,
  withPatient,
} from './receive-form.ts';
import {
  ReceiveFields,
  type ReceiveInvoiceChoice,
  type ReceiveInvoices,
} from './ReceiveFields.tsx';

const K = PAYMENTS_KEYS.receive;

/** The drawer's root test id — the receive and edit routes' manifests name it. */
export const RECEIVE_DRAWER_TEST_ID = 'receive-drawer';

/** Six fields, chips and compact rows among them: the 560px of `payments.md:203`. */
const CONTENT_PROFILE = { fieldCount: 6 } as const;

/** The API's names the form spells differently (the 400's `errors[].field`, camel-cased). */
const SERVER_FIELDS = { contactId: 'patientId' } as const;

/** What every use of the drawer passes. */
interface ReceiveDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through — and a save. */
  onClose: () => void;
}

/** Receive payment over the ledger (`/payments/receive`, `S:85`). */
interface ReceiveCreateDrawerProps extends ReceiveDrawerBaseProps {
  mode: 'create';
  /** `?patient=&invoice=` — the Patients row's and the file's Collect, ⌘K "New receipt". */
  prefill: PaymentReceiveSearch;
}

/** Edit payment in (`/payments/$paymentId/edit` for a receipt, `S:87`). */
interface ReceiveEditDrawerProps extends ReceiveDrawerBaseProps {
  mode: 'edit';
  entry: LedgerRow;
  /** No Edit: the drawer only shows the entry. */
  readOnly?: boolean;
}

/** Props of {@link ReceivePaymentDrawer}. */
export type ReceivePaymentDrawerProps = ReceiveCreateDrawerProps | ReceiveEditDrawerProps;

/** What one opening starts from: its values, and the prefilled patient's open invoices. */
interface SessionStart {
  values: ReceiveFormValues;
  invoices: readonly InvoiceRecord[] | null;
}

/** An open invoice as the field offers it — its due in paise, as the rows hold money. */
const choiceOf = (invoice: InvoiceRecord): ReceiveInvoiceChoice => ({
  id: invoice.id,
  seq: invoice.seq,
  type: invoice.type,
  due: dueInPaise(invoice),
});

/** A save the form stops: its toast. */
function problemMessage(
  problem: ReceiveProblem,
  t: TFunction,
  formatPaise: (paise: number) => string,
): string {
  if (problem.kind === 'patient') return t(K.pickPatient);
  if (problem.kind === 'amount') return t(K.enterAmount);
  return t(K.aboveDue, { due: formatPaise(problem.due) });
}

/** The Quick fill chips once an invoice is picked: Full, Half, Cash + UPI (its due in paise). */
function quickFillItems(
  form: UseFormReturn<ReceiveFormValues>,
  due: number,
  t: TFunction,
  formatPaise: (paise: number) => string,
): QuickFillItem[] {
  const shown = { full: due, half: halfOf(due), cashUpi: due };
  return RECEIVE_QUICK_FILLS.map((fill) => ({
    id: fill.id,
    label: t(K.quickFill[fill.id], { amount: formatPaise(shown[fill.id]) }),
    tone: fill.tone,
    onSelect: () =>
      form.setValue('splits', quickFillSplits(fill.id, due), { shouldDirty: true }),
  }));
}

/** Who may save here: `payment:create` for a new receipt, `payment:update` for an entry. */
function useReadOnly(props: ReceivePaymentDrawerProps): boolean {
  const access = usePaymentAccess();
  if (props.mode === 'edit' && props.readOnly) return true;
  return access.resolved && !(props.mode === 'edit' ? access.canEdit : access.canCreate);
}

/** The tag beside the title: the entry's `PAY-<seq>`, else the picked patient's `#<seq>`. */
function useTag(entry: LedgerRow | null, patientId: string | null): string | undefined {
  const patient = usePatient(entry ? undefined : (patientId ?? undefined));
  if (entry) return displayId.payment(entry.seq);
  return patient.data ? displayId.patient(patient.data.seq) : undefined;
}

/**
 * The invoice field and the due the rows may reach (paise): an edit's own invoice — its due with
 * the entry's own amount back on it — or the picked patient's open invoices, as read now or as
 * the drawer opened with them; none picked is an advance (no due).
 */
function useInvoiceField(
  record: LedgerRow | null,
  values: ReceiveFormValues,
  opened: readonly InvoiceRecord[] | null,
): { invoices: ReceiveInvoices; due: number | null } {
  const live = useOpenInvoices(record ? null : values.patientId);
  if (record) {
    const choices: ReceiveInvoiceChoice[] =
      record.invoice && record.invoiceId
        ? [
            {
              id: record.invoiceId,
              seq: record.invoice.seq,
              type: record.invoice.type,
              due: paiseOfRupees(record.invoice.due + record.amount),
            },
          ]
        : [];
    return { invoices: { kind: 'choices', choices }, due: choices[0]?.due ?? null };
  }
  if (!values.patientId) return { invoices: { kind: 'waiting' }, due: null };
  const read = live.data ?? opened;
  if (!read) {
    return live.isError
      ? { invoices: { kind: 'failed', retry: () => void live.refetch() }, due: null }
      : { invoices: { kind: 'waiting' }, due: null };
  }
  const choices = read.map(choiceOf);
  const picked = choices.find((choice) => choice.id === values.invoiceId);
  return { invoices: { kind: 'choices', choices }, due: picked?.due ?? null };
}

/**
 * A patient's open invoices for the pick, through the same cache entry `useOpenInvoices` reads;
 * none when the read fails — the field then offers Retry.
 */
async function readOpenInvoices(
  queryClient: ReturnType<typeof useQueryClient>,
  organizationId: string | null,
  patientId: string,
): Promise<InvoiceRecord[]> {
  try {
    return await queryClient.query({
      queryKey: invoiceQueryKeys.every(organizationId, {
        patientId,
        status: ['unpaid', 'partial'],
        oldestFirst: true,
      }),
      queryFn: () => listOpenInvoices(patientId),
    });
  } catch {
    return [];
  }
}

/**
 * The picks that fill the form: a patient — their contact, their oldest open invoice and its due
 * — or an invoice chip — its due in the mode already chosen; clearing it is an advance.
 */
function usePicks(form: UseFormReturn<ReceiveFormValues>) {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const dirty = { shouldDirty: true } as const;
  const pickPatient = async (patient: PatientPick | null) => {
    if (!patient) {
      form.setValue('patientId', null, dirty);
      form.setValue('contactId', null, dirty);
      form.setValue('invoiceId', null, dirty);
      return;
    }
    form.clearErrors('patientId');
    const rowsAtPick = JSON.stringify(form.getValues('splits'));
    const open = await readOpenInvoices(queryClient, organizationId, patient.id);
    const next = withPatient(form.getValues(), patient, open);
    form.setValue('patientId', next.patientId, dirty);
    form.setValue('contactId', next.contactId, dirty);
    form.setValue('invoiceId', next.invoiceId, dirty);
    // The due fills the rows — unless an amount was typed while the invoices were read: a late
    // answer never wipes what the member entered.
    if (JSON.stringify(form.getValues('splits')) === rowsAtPick) {
      form.setValue('splits', next.splits, dirty);
    }
  };
  const pickInvoice = (invoice: ReceiveInvoiceChoice | null) => {
    form.setValue('invoiceId', invoice?.id ?? null, dirty);
    if (!invoice) return;
    form.setValue(
      'splits',
      [{ mode: form.getValues('splits.0.mode') ?? 'upi', amount: invoice.due }],
      dirty,
    );
  };
  return { pickPatient, pickInvoice };
}

/**
 * A refusal the screen tells apart (`409`): the closed day turns the drawer view only; more than
 * the invoice's due now (`more_than_due` — paid meanwhile) outlines the rows; any other says the
 * server's reason.
 */
function useConflict(form: UseFormReturn<ReceiveFormValues>, onDayClosed: () => void) {
  const { t } = useTranslation(PAYMENTS_NS);
  return (error: HttpError) => {
    const reason = apiErrorReason(error);
    if (reason === 'day_closed') {
      onDayClosed();
      notify.error(t(PAYMENTS_KEYS.dialog.dayClosed));
      return;
    }
    if (reason === 'more_than_due') {
      form.setError('splits', { type: 'server', message: t(K.moreThanDue) });
      notify.error(t(K.moreThanDue));
      return;
    }
    notifyError(error);
  };
}

/** The save: the checks in the drawer's order, the write, its toast and the close. */
function useReceiveSave({
  form,
  record,
  due,
  onDayClosed,
  onStale,
  onClose,
}: {
  form: UseFormReturn<ReceiveFormValues>;
  record: LedgerRow | null;
  due: number | null;
  onDayClosed: () => void;
  onStale: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const formatRupees = useRupeeFormat();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const receive = useReceivePayment({ notifyOnError: false });
  const update = useUpdatePayment({ notifyOnError: false });
  const onConflict = useConflict(form, onDayClosed);
  const fallbackBranch =
    defaultBranchId(openBranches, preferences.branchFilter) ?? openBranches[0]?.id ?? '';
  return useDrawerSave<ReceiveFormValues, LedgerRow>({
    form,
    fieldOrder: ['patientId', 'splits', 'reference', 'note'],
    serverFields: SERVER_FIELDS,
    toastId: 'receive-payment-save-failed',
    check: (current) => {
      const problem = receiveProblem(current, due);
      return problem
        ? { fields: [problem.field], message: problemMessage(problem, t, formatPaise) }
        : null;
    },
    onConflict,
    onStale: record ? onStale : undefined,
    onField: () => undefined,
    write: () =>
      record
        ? update.mutateAsync({ record, patch: receivePatchOf(form.getValues()) })
        : receive.mutateAsync(receiveInputOf(form.getValues(), fallbackBranch)),
    onDone: (row) => {
      notify.success(
        record
          ? t(K.updated, { ref: displayId.payment(row.seq) })
          : t(K.received, { amount: formatRupees(row.amount), name: row.partyName }),
      );
      onClose();
    },
  });
}

/** One opening of the drawer: the form, its picks, its checks and its save. */
function ReceiveSession({
  props,
  start,
}: {
  props: ReceivePaymentDrawerProps;
  start: SessionStart;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const formatPaise = usePaiseFormat();
  const { openBranches } = useBranches();
  const idPrefix = `receive-${useId().replace(/:/g, '')}`;
  const [dayClosed, setDayClosed] = useState(false);
  const readOnly = useReadOnly(props) || dayClosed;

  const form = useForm<ReceiveFormValues>({ defaultValues: start.values });
  const { record, reload } = useEditingRecord({
    record: props.mode === 'edit' ? props.entry : null,
    form,
    formOf: receiveFormOf,
    read: (entry, organizationId) => ({
      queryKey: paymentQueryKeys.detail(organizationId, entry.id),
      queryFn: () => fetchPayment(entry.id),
    }),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const { invoices, due } = useInvoiceField(record, values, start.invoices);
  const tag = useTag(record, values.patientId);
  const { saveState, save } = useReceiveSave({
    form,
    record,
    due,
    onDayClosed: () => setDayClosed(true),
    onStale: () => void reload(),
    onClose: props.onClose,
  });
  const { pickPatient, pickInvoice } = usePicks(form);

  const modes = splitsModes(values.splits);
  const modesLabel = modes.map((mode) => tApp(APP_KEYS.paymentModes[mode])).join(' + ');
  const amount = formatPaise(splitsTotal(values.splits));
  const quickFill =
    due !== null && !record ? quickFillItems(form, due, t, formatPaise) : undefined;

  return (
    <RecordDrawer
      open={props.open}
      onClose={props.onClose}
      title={t(record ? K.titleEdit : K.title)}
      tag={tag}
      sub={t(record ? K.subEdit : K.sub)}
      badges={[
        { id: 'mode', label: modesLabel, tone: modesTone(modes) },
        { id: 'amount', label: amount },
      ]}
      quickFill={quickFill}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.payments}
      summary={t(K.summary, { modes: modesLabel, amount })}
      readOnly={readOnly}
      saveLabel={t(record ? K.saveEdit : K.save, { amount })}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={RECEIVE_DRAWER_TEST_ID}
    >
      <ReceiveFields
        form={form}
        values={values}
        idPrefix={idPrefix}
        testId={RECEIVE_DRAWER_TEST_ID}
        branches={openBranches}
        invoices={invoices}
        due={due}
        editing={record !== null}
        readOnly={readOnly}
        onPatient={(patient) => void pickPatient(patient)}
        onInvoice={pickInvoice}
      />
    </RecordDrawer>
  );
}

/** Where a new receipt starts: empty, or the `?patient=` patient with their oldest open invoice. */
function createStart(
  branchId: string | null,
  prefill: PaymentReceiveSearch,
  patient: { id: string; contactId: string } | undefined,
  invoices: readonly InvoiceRecord[] | undefined,
): SessionStart {
  const values = emptyReceiveForm(branchId);
  if (!patient) return { values, invoices: null };
  return {
    values: withPatient(values, patient, invoices ?? [], prefill.invoice),
    invoices: invoices ?? null,
  };
}

/**
 * Receive payment (KICKOFF §6.9; `payments.md:95–110, 198–210`; H:5069–5073) on clinozy-be
 * (`POST /app/payments`, `kind: receipt`) and the shared record drawer, 560px: one section, "Who
 * is paying" — Branch, Patient (required; patients only, their contact is what the receipt
 * names), Against invoice (their open ones, `GET /app/invoices?patient_id=&payment_status=
 * unpaid,partial`; none picked is an advance), the Mode · Amount rows, Reference and Note — with
 * Quick fill once an invoice is picked ("⚡ Full · ₹8,550", "⚡ Half · ₹4,275", "⚡ Cash + UPI").
 * A patient fills their oldest open invoice and its due; `?patient=&invoice=` arrive filled.
 * Save checks in order: a patient ("Pick a patient"), an amount ("Enter an amount"), at most the
 * invoice's due (AMBER copy). "₹8,550 received from Kiran Desai"; an edit — an open day's receipt,
 * its patient and invoice fixed — sends only what changed with the read's `updated_at`:
 * "PAY-5512 updated · change logged". A save over a newer change (`409 record_changed`) offers
 * Reload, which reads the entry again; a day closed meanwhile (`409 day_closed`) turns the drawer
 * view only; more than is due now (`409 more_than_due`) outlines the rows.
 */
export function ReceivePaymentDrawer(props: ReceivePaymentDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  const prefill = props.mode === 'create' ? props.prefill : null;
  // A prefilled patient opens with their contact and invoices read, so the drawer starts filled.
  const prefilledPatient = usePatient(prefill?.patient);
  const prefilled = useOpenInvoices(prefill?.patient ?? null);
  const waitingForPrefill =
    Boolean(prefill?.patient) && (prefilledPatient.isPending || !prefilled.isFetched);
  if (isPending || waitingForPrefill) return null;

  const start: SessionStart =
    props.mode === 'edit'
      ? { values: receiveFormOf(props.entry), invoices: null }
      : createStart(
          defaultBranchId(openBranches, preferences.branchFilter),
          props.prefill,
          prefilledPatient.data,
          prefilled.data,
        );
  return <ReceiveSession key={session} props={props} start={start} />;
}
