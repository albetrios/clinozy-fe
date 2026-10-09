import { useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { listOpenInvoices, paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import type { LedgerRow, OpenInvoice } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import type { PatientPick } from '@/shared/components/PatientPicker/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { splitsModes, splitsTotal } from '@/shared/forms/SplitRowsField/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import {
  useOpenInvoices,
  useReceivePayment,
  useUpdatePayment,
} from '@/shared/hooks/usePayments/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import type { PaymentReceiveSearch } from '../../payments.dialog-search.ts';
import {
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
import { ReceiveFields } from './ReceiveFields.tsx';

const K = PAYMENTS_KEYS.receive;

/** The drawer's root test id — the receive and edit routes' manifests name it. */
export const RECEIVE_DRAWER_TEST_ID = 'receive-drawer';

/** Six fields, chips and compact rows among them: the 560px of `payments.md:203`. */
const CONTENT_PROFILE = { fieldCount: 6 } as const;

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

/** What one opening starts from: its values, and the picked patient's open invoices. */
interface SessionStart {
  values: ReceiveFormValues;
  invoices: readonly OpenInvoice[] | null;
}

/** The form's values as they stand, every key present. */
function useFormValues(form: UseFormReturn<ReceiveFormValues>): ReceiveFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as ReceiveFormValues;
}

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

/** The Quick fill chips once an invoice is picked: Full, Half, Cash + UPI. */
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

/** Who may save here: Create for a new receipt, Edit for an entry — else view only. */
function useReadOnly(props: ReceivePaymentDrawerProps): boolean {
  const access = useClinicAccess();
  if (props.mode === 'edit' && props.readOnly) return true;
  return (
    access.isResolved &&
    !access.can('payments', props.mode === 'edit' ? 'edit' : 'create')
  );
}

/** The tag beside the title: the entry's `PAY-<seq>`, else the picked patient's `#<seq>`. */
function useTag(entry: LedgerRow | null, patientId: string | null): string | undefined {
  const patient = usePatient(entry ? undefined : (patientId ?? undefined));
  if (entry) return displayId.payment(entry.seq);
  return patient.data ? displayId.patient(patient.data.seq) : undefined;
}

/**
 * The invoices the field shows: none on an edit (the entry's is fixed), else
 * the picked patient's — as read now, or as the drawer opened with them.
 */
function shownInvoices(
  entry: LedgerRow | null,
  patientId: string | null,
  read: readonly OpenInvoice[] | undefined,
  opened: readonly OpenInvoice[] | null,
): readonly OpenInvoice[] | null {
  if (entry || !patientId) return null;
  return read ?? opened;
}

/** The save: the checks in the drawer's order, the write, its toast and the close. */
function useReceiveSave({
  form,
  entry,
  due,
  onDayClosed,
  onClose,
}: {
  form: UseFormReturn<ReceiveFormValues>;
  entry: LedgerRow | null;
  due: number | null;
  onDayClosed: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const receive = useReceivePayment({ notifyOnError: false });
  const update = useUpdatePayment({ notifyOnError: false });
  const fallbackBranch =
    defaultBranchId(openBranches, preferences.branchFilter) ?? openBranches[0]?.id ?? '';
  return useDrawerSave<ReceiveFormValues, LedgerRow>({
    form,
    fieldOrder: ['patientId', 'splits', 'reference', 'note'],
    toastId: 'receive-payment-save-failed',
    check: (current) => {
      const problem = receiveProblem(current, due);
      return problem
        ? { fields: [problem.field], message: problemMessage(problem, t, formatPaise) }
        : null;
    },
    onConflict: () => {
      onDayClosed();
      notify.error(t(PAYMENTS_KEYS.dialog.dayClosed));
    },
    onField: () => undefined,
    write: () =>
      entry
        ? update.mutateAsync({ id: entry.id, patch: receivePatchOf(form.getValues()) })
        : receive.mutateAsync(receiveInputOf(form.getValues(), fallbackBranch)),
    onDone: (row) => {
      notify.success(
        entry
          ? t(K.updated, { ref: displayId.payment(row.seq) })
          : t(K.received, { amount: formatPaise(row.amount), name: row.partyName }),
      );
      onClose();
    },
  });
}

/**
 * The picks that fill the form: a patient — their oldest open invoice and its
 * due — or an invoice chip — its due in the mode already chosen.
 */
function usePicks(form: UseFormReturn<ReceiveFormValues>) {
  const queryClient = useQueryClient();
  const pickPatient = async (patient: PatientPick | null) => {
    if (!patient) {
      form.setValue('patientId', null, { shouldDirty: true });
      form.setValue('invoiceId', null, { shouldDirty: true });
      return;
    }
    form.clearErrors('patientId');
    const open = await queryClient.query({
      queryKey: paymentQueryKeys.openInvoices(patient.id),
      queryFn: () => listOpenInvoices(patient.id),
    });
    const next = withPatient(form.getValues(), patient.id, open);
    form.setValue('patientId', next.patientId, { shouldDirty: true });
    form.setValue('invoiceId', next.invoiceId, { shouldDirty: true });
    form.setValue('splits', next.splits, { shouldDirty: true });
  };
  const pickInvoice = (invoice: OpenInvoice) => {
    form.setValue('invoiceId', invoice.id, { shouldDirty: true });
    form.setValue(
      'splits',
      [{ mode: form.getValues('splits.0.mode') ?? 'upi', amount: invoice.due }],
      { shouldDirty: true },
    );
  };
  return { pickPatient, pickInvoice };
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
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const { openBranches } = useBranches();
  const idPrefix = `receive-${useId().replace(/:/g, '')}`;
  const entry = props.mode === 'edit' ? props.entry : null;
  const [dayClosed, setDayClosed] = useState(false);
  const readOnly = useReadOnly(props) || dayClosed;

  const form = useForm<ReceiveFormValues>({ defaultValues: start.values });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const live = useOpenInvoices(entry ? null : values.patientId);
  const invoices = shownInvoices(entry, values.patientId, live.data, start.invoices);
  const picked = invoices?.find((invoice) => invoice.id === values.invoiceId) ?? null;
  // An edit's own amount goes back onto its invoice's due while it is changed.
  const due = entry?.invoice ? entry.invoice.due + entry.amount : (picked?.due ?? null);
  const tag = useTag(entry, values.patientId);
  const { saveState, save } = useReceiveSave({
    form,
    entry,
    due,
    onDayClosed: () => setDayClosed(true),
    onClose: props.onClose,
  });
  const { pickPatient, pickInvoice } = usePicks(form);

  const modes = splitsModes(values.splits);
  const modesLabel = modes
    .map((mode) => tClinic(CLINIC_KEYS.paymentModes[mode]))
    .join(' + ');
  const amount = formatPaise(splitsTotal(values.splits));
  const quickFill =
    picked && !entry ? quickFillItems(form, picked.due, t, formatPaise) : undefined;

  return (
    <RecordDrawer
      open={props.open}
      onClose={props.onClose}
      title={t(entry ? K.titleEdit : K.title)}
      tag={tag}
      sub={t(entry ? K.subEdit : K.sub)}
      badges={[
        { id: 'mode', label: modesLabel, tone: modesTone(modes) },
        { id: 'amount', label: amount },
      ]}
      quickFill={quickFill}
      content={CONTENT_PROFILE}
      tone={SECTION_TONES.payments}
      summary={t(K.summary, { modes: modesLabel, amount })}
      readOnly={readOnly}
      saveLabel={t(entry ? K.saveEdit : K.save, { amount })}
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
        editing={entry !== null}
        readOnly={readOnly}
        onPatient={(patient) => void pickPatient(patient)}
        onInvoice={pickInvoice}
      />
    </RecordDrawer>
  );
}

/**
 * Receive payment (KICKOFF §6.9; `payments.md:95–110, 198–210`; H:5069–5073)
 * on the shared record drawer, 560px: one section, "Who is paying" — Branch,
 * Patient (required; leads shown but never taken), Against invoice, the Mode ·
 * Amount rows, Reference and Note — with Quick fill once an invoice is picked
 * ("⚡ Full · ₹8,550", "⚡ Half · ₹4,275", "⚡ Cash + UPI"). A patient fills
 * their oldest open invoice and its due; `?patient=&invoice=` arrive filled.
 * Save checks in order: a patient ("Pick a patient"), an amount ("Enter an
 * amount"), at most the invoice's due (AMBER copy). "₹8,550 received from Kiran
 * Desai"; an edit — an open day's receipt, its patient and invoice fixed —
 * "PAY-5512 updated · change logged". A day closed meanwhile turns the drawer
 * view only.
 */
export function ReceivePaymentDrawer(props: ReceivePaymentDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  const prefill = props.mode === 'create' ? props.prefill : null;
  // A prefilled patient opens with their invoices read, so the drawer starts filled.
  const prefilled = useOpenInvoices(prefill?.patient ?? null);
  if (isPending || (prefill?.patient && !prefilled.isFetched)) return null;

  let start: SessionStart = {
    values: emptyReceiveForm(defaultBranchId(openBranches, preferences.branchFilter)),
    invoices: null,
  };
  if (props.mode === 'edit') {
    start = { values: receiveFormOf(props.entry), invoices: null };
  } else if (prefill?.patient && prefilled.data) {
    start = {
      values: withPatient(start.values, prefill.patient, prefilled.data, prefill.invoice),
      invoices: prefilled.data,
    };
  }
  return <ReceiveSession key={session} props={props} start={start} />;
}
