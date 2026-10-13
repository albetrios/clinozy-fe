import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { CreditDirection } from '@/shared/api/app/app-schema.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { creditQueryKeys, fetchCredit } from '@/shared/api/app/credits-api.ts';
import type { CreditRow } from '@/shared/api/app/credits-contracts.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { CREDIT_DIRECTION_TONES } from '@/shared/app/app-tones.ts';
import { DrawerStepBody } from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { useCreateCredit, useUpdateCredit } from '@/shared/hooks/useCredits/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import {
  resetFormInPlace,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useContactInvoices } from '@/shared/hooks/usePayments/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';
import { useDayLabel } from '../../../shared/hooks/useDayLabel/index.ts';
import { CreditDeleteConfirm } from '../CreditDeleteConfirm/index.ts';
import {
  creditAmount,
  creditFormOf,
  type CreditFormValues,
  creditInputOf,
  type CreditProblem,
  creditProblem,
  emptyCreditForm,
  reasonTone,
  withDirection,
  withParty,
} from './credit-form.ts';
import { CreditWayFields, CreditWhyFields } from './CreditFields.tsx';

const K = PAYMENTS_KEYS.credit;

/** The drawer's root test id — the create and edit routes' manifests name it. */
export const CREDIT_DRAWER_TEST_ID = 'credit-drawer';

/** Seven fields, the reason chips and the note among them: the 680px of `payments.md:245`. */
const CONTENT_PROFILE = { fieldCount: 7, hasHeavyField: true } as const;

/**
 * The API's names the form spells differently: who is the party (`contact_id`, `party_name`),
 * the reason its chip.
 */
const SERVER_FIELDS = {
  contactId: 'party',
  partyName: 'party',
  reason: 'reasonKey',
} as const;

/** The drawer's steps, in order (`payments.md:251`). */
type CreditStepId = 'way' | 'why';

/** What every use of the drawer passes. */
interface CreditDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through — and a save. */
  onClose: () => void;
}

/** Add pending over Pending (`/payments/pending/create`, `S:89`). */
export interface CreditCreateDrawerProps extends CreditDrawerBaseProps {
  mode: 'create';
  /** `?direction=give|take` — the "⌄" menu's Give / Take. */
  direction?: CreditDirection;
}

/** Edit pending (`/payments/pending/$creditId/edit`, `S:90`) — an open credit nothing has settled. */
export interface CreditEditDrawerProps extends CreditDrawerBaseProps {
  mode: 'edit';
  credit: CreditRow;
  /** No Edit: the drawer only shows the credit. */
  readOnly?: boolean;
}

/** Props of {@link CreditDrawer}. */
export type CreditDrawerProps = CreditCreateDrawerProps | CreditEditDrawerProps;

/** The form's values as they stand, every key present. */
function useFormValues(form: UseFormReturn<CreditFormValues>): CreditFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as CreditFormValues;
}

/**
 * Who may save here: `payment:create` for a new credit, `payment:update` for an open one (and
 * `payment:delete` for its Delete) — while nothing of it is settled; part settled meanwhile
 * (`locked`) turns the drawer view only.
 */
function useDrawerAccess(props: CreditDrawerProps, locked: boolean) {
  const access = usePaymentAccess();
  const editing = props.mode === 'edit';
  const readOnly =
    locked ||
    (editing && props.readOnly === true) ||
    (access.resolved && !(editing ? access.canEdit : access.canCreate));
  return { readOnly, canDelete: editing && !readOnly && access.canDelete };
}

/** A problem's toast: "Pick who", "Enter the amount", "Pick a reason", "Add a note for “Other”". */
const problemMessage = (problem: CreditProblem, t: TFunction) =>
  t(K.problems[problem.kind]);

/** The footer's line: "Give ₹500 back to Tanvi Shah · Charged twice" once who and how much are in. */
function useSummary(values: CreditFormValues): string | undefined {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const amount = creditAmount(values);
  if (!values.party || amount <= 0) return undefined;
  const line = t(K.summary[values.direction], {
    amount: formatPaise(amount),
    name: values.party.name,
  });
  if (!values.reasonKey) return line;
  // "Other" is stored as its note, so the line says what the row will say.
  const note = values.note.trim();
  const reason =
    values.reasonKey === 'other' && note
      ? note
      : t(PAYMENTS_KEYS.pending.reasons[values.reasonKey]);
  return `${line} · ${reason}`;
}

/** The step cards: each step's heads (peek, summary, what is missing) and its body. */
function useSteps({
  values,
  invoices,
  settleByLabel,
  bodies,
}: {
  values: CreditFormValues;
  invoices: readonly InvoiceRecord[] | null;
  settleByLabel: string | undefined;
  bodies: Record<CreditStepId, ReactNode>;
}): DrawerStep[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const amount = creditAmount(values);
  const way = t(PAYMENTS_KEYS.pending.ways[values.direction]);
  const reason = values.reasonKey
    ? t(PAYMENTS_KEYS.pending.reasons[values.reasonKey])
    : undefined;
  const invoice = invoices?.find((row) => row.id === values.invoiceId);
  const missingWay = [
    ...(values.party ? [] : [t(K.who)]),
    ...(amount > 0 ? [] : [t(K.amount)]),
  ];
  return [
    {
      id: 'way',
      title: t(K.steps.way),
      missing: missingWay,
      summary: [way, values.party?.name, amount > 0 ? formatPaise(amount) : '']
        .filter(Boolean)
        .join(' · '),
      peek: [
        {
          kind: 'value',
          label: t(K.way),
          value: way,
          tone: CREDIT_DIRECTION_TONES[values.direction],
        },
        { kind: 'value', label: t(K.who), value: values.party?.name },
        {
          kind: 'value',
          label: t(K.amount),
          value: amount > 0 ? formatPaise(amount) : undefined,
        },
      ],
      content: bodies.way,
    },
    {
      id: 'why',
      title: t(K.steps.why),
      missing: values.reasonKey ? [] : [t(K.reason)],
      summary: reason,
      peek: [
        {
          kind: 'value',
          label: t(K.reason),
          value: reason,
          tone: values.reasonKey
            ? reasonTone(values.direction, values.reasonKey)
            : undefined,
        },
        ...(invoices && invoices.length > 0
          ? [
              {
                kind: 'value' as const,
                label: t(K.invoice),
                value: invoice
                  ? t(PAYMENTS_KEYS.pending.invoice, { seq: invoice.seq })
                  : t(K.noInvoice),
                tone: 'lav' as const,
              },
            ]
          : []),
        { kind: 'value', label: t(K.settleBy), value: settleByLabel },
        { kind: 'value', label: t(K.note), value: values.note.trim() || undefined },
      ],
      content: bodies.why,
    },
  ];
}

/**
 * The save: who, an amount, a reason and "Other"'s note first, then the write — a change sends
 * only what differs, with the read's `updated_at` — its toast and the close: "CR-3 saved · give
 * ₹500 to Tanvi Shah", "CR-1 updated". A save over a newer change (`409 record_changed`) offers
 * Reload; part of it settled meanwhile (`409 credit_settled`) turns the drawer view only.
 */
function useCreditSave({
  form,
  credit,
  onStep,
  onStale,
  onLocked,
  onClose,
}: {
  form: UseFormReturn<CreditFormValues>;
  credit: CreditRow | null;
  onStep: (stepId: CreditStepId) => void;
  onStale: () => void;
  onLocked: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const create = useCreateCredit({ notifyOnError: false });
  const update = useUpdateCredit({ notifyOnError: false });
  const onConflict = (error: HttpError) => {
    if (credit && apiErrorReason(error) === 'credit_settled') {
      onLocked();
      notify.error(
        t(PAYMENTS_KEYS.pending.conflicts.settled, {
          ref: displayId.pendingCredit(credit.seq),
        }),
      );
      return;
    }
    notifyError(error);
  };
  return useDrawerSave<CreditFormValues, CreditRow>({
    form,
    fieldOrder: [
      'direction',
      'party',
      'amount',
      'reasonKey',
      'invoiceId',
      'settleBy',
      'note',
    ],
    serverFields: SERVER_FIELDS,
    toastId: 'credit-save-failed',
    check: (current) => {
      const problem = creditProblem(current);
      return problem
        ? { fields: [problem.field], message: problemMessage(problem, t) }
        : null;
    },
    onConflict,
    onStale: credit ? onStale : undefined,
    onField: (name) =>
      onStep(
        name === 'party' || name === 'amount' || name === 'direction' ? 'way' : 'why',
      ),
    write: () => {
      const input = creditInputOf(form.getValues());
      return credit ? update.mutateAsync({ credit, input }) : create.mutateAsync(input);
    },
    onDone: (saved) => {
      const ref = displayId.pendingCredit(saved.seq);
      notify.success(
        credit
          ? t(K.updated, { ref })
          : t(K.saved[saved.direction], {
              ref,
              amount: formatRupees(saved.amount),
              name: saved.partyName,
            }),
      );
      onClose();
    },
  });
}

/** One opening of the drawer: the form, its two steps, its save. */
function CreditSession({
  props,
  start,
}: {
  props: CreditDrawerProps;
  start: CreditFormValues;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const idPrefix = `credit-${useId().replace(/:/g, '')}`;
  const [today] = useState(() => appToday());
  const [locked, setLocked] = useState(false);
  const { readOnly, canDelete } = useDrawerAccess(props, locked);

  const form = useForm<CreditFormValues>({ defaultValues: start });
  const { record: credit, reload } = useEditingRecord({
    record: props.mode === 'edit' ? props.credit : null,
    form,
    formOf: creditFormOf,
    read: (record, organizationId) => ({
      queryKey: creditQueryKeys.detail(organizationId, record.id),
      queryFn: () => fetchCredit(record.id),
    }),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('way');
  const [deleting, setDeleting] = useState(false);
  const contactInvoices = useContactInvoices(values.party?.contactId ?? null);
  const invoices = values.party?.contactId ? (contactInvoices.data ?? null) : null;
  const dayLabel = useDayLabel();
  const { saveState, save } = useCreditSave({
    form,
    credit,
    onStep: setOpenStep,
    onStale: () => void reload(),
    onLocked: () => setLocked(true),
    onClose: props.onClose,
  });
  const summary = useSummary(values);
  const replace = (next: CreditFormValues) =>
    resetFormInPlace(form, next, { keepDefaultValues: true });
  const fieldsProps = { form, values, idPrefix, testId: CREDIT_DRAWER_TEST_ID, readOnly };

  const steps = useSteps({
    values,
    invoices,
    settleByLabel: values.settleBy ? dayLabel(values.settleBy) : undefined,
    bodies: {
      way: (
        <DrawerStepBody readOnly={readOnly}>
          <CreditWayFields
            {...fieldsProps}
            onDirection={(direction) =>
              replace(withDirection(form.getValues(), direction))
            }
            onParty={(party) => replace(withParty(form.getValues(), party))}
          />
        </DrawerStepBody>
      ),
      why: (
        <DrawerStepBody readOnly={readOnly}>
          <CreditWhyFields {...fieldsProps} invoices={invoices} today={today} />
        </DrawerStepBody>
      ),
    },
  });

  let saveLabel = t(K.save[values.direction]);
  if (credit) saveLabel = t(K.saveEdit);

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={t(credit ? K.titleEdit : K.title)}
        tag={credit ? displayId.pendingCredit(credit.seq) : undefined}
        sub={t(credit ? K.subEdit : K.sub)}
        content={CONTENT_PROFILE}
        tone={CREDIT_DIRECTION_TONES[values.direction]}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => {
          // The step's head lists what is missing; the toast names the first
          // problem in the design's order (H:4033).
          const problem = creditProblem(form.getValues());
          if (!problem) return;
          const message = problemMessage(problem, t);
          form.setError(problem.field, { type: 'client', message });
          notify.warning(message);
        }}
        summary={summary}
        readOnly={readOnly}
        stacked
        saveLabel={saveLabel}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={CREDIT_DRAWER_TEST_ID}
      />
      {credit ? (
        <CreditDeleteConfirm
          credit={deleting ? credit : null}
          onClose={() => setDeleting(false)}
          onDeleted={props.onClose}
        />
      ) : null}
    </>
  );
}

/**
 * Add pending / Edit pending (KICKOFF §6.9; `payments.md:152–168, 240–252`;
 * H:4022–4034) on clinozy-be (`POST` / `PATCH /app/pending-credits`) and the
 * shared record drawer, 680px, stacked, in two steps: "Which way" — Give /
 * Take, Who (the clinic's people, then its stock vendors and Medical
 * suppliers, or a typed name), Amount — and "Why" — the way's Reason chips,
 * For invoice (a person with invoices), Settle by (a task falls due then),
 * Note (required for "Other"). The drawer takes the way's tone. Save checks
 * who, an amount, a reason and "Other"'s note, in that order: "CR-3 saved ·
 * give ₹500 to Tanvi Shah", or for an open credit — only what changed —
 * "CR-1 updated", with Delete beside it. A save over a newer change offers
 * Reload, which reads the credit again and starts the form over on it.
 */
export function CreditDrawer(props: CreditDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const start =
    props.mode === 'edit' ? creditFormOf(props.credit) : emptyCreditForm(props.direction);
  return <CreditSession key={session} props={props} start={start} />;
}
