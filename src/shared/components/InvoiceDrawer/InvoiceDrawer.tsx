import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { InvoiceType } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type {
  InvoiceDetail,
  InvoiceRecord,
} from '@/shared/api/clinic/invoices-contracts.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import type {
  DrawerPeekPill,
  DrawerStep,
} from '@/shared/components/DrawerSteps/index.ts';
import { OfferingQuickCreate } from '@/shared/components/OfferingQuickCreate/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import {
  type EditingRecordRead,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { useFixtureStaff } from '@/shared/hooks/useFixtureStaff/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import {
  useDeleteInvoice,
  useOftenBilled,
  useRestoreInvoice,
} from '@/shared/hooks/useInvoices/index.ts';
import { usePlan } from '@/shared/hooks/usePlan/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { type InvoiceDrawerAccess, useInvoiceAccess } from './invoice-access.ts';
import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_ID,
  INVOICE_DRAWER_TEST_IDS,
  INVOICE_DRAWER_TONE,
} from './invoice-drawer.constants.ts';
import { type InvoiceDrawerView, useInvoiceDrawerView } from './invoice-drawer-view.ts';
import {
  blankLine,
  copiedInvoiceForm,
  emptyInvoiceForm,
  invoiceFormOf,
  type InvoiceFormValues,
  type InvoicePrefill,
} from './invoice-form.ts';
import { oftenBilledItems } from './invoice-lines.ts';
import { useInvoiceQuickFill } from './invoice-presets.ts';
import { printInvoice } from './invoice-sheet.tsx';
import { InvoiceItemsField } from './InvoiceItemsField.tsx';
import { InvoicePartyFields } from './InvoicePartyFields.tsx';
import { InvoicePaymentFields } from './InvoicePaymentFields.tsx';
import { InvoiceTotals } from './InvoiceTotals.tsx';
import { InvoiceTypeSwitch } from './InvoiceTypeSwitch.tsx';
import { type InvoiceCatalog, useInvoiceCatalog } from './use-invoice-catalog.ts';
import {
  type InvoiceDrawerOutcome,
  useBranchPrefill,
  useInvoiceStacks,
  usePrefillPatientName,
  usePrescriptionPrefill,
  useSaveToast,
  useTeamPrefill,
  useVisitPrefill,
} from './use-invoice-drawer.ts';
import { type DrawerFigures, useDrawerFigures } from './use-invoice-figures.ts';
import { type DrawerPreview, useDrawerPreview } from './use-invoice-preview.ts';
import { useInvoiceSave } from './use-invoice-save.ts';

const K = INVOICE_DRAWER_KEYS;

/** What every use of the drawer passes. */
interface InvoiceDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through. */
  onClose: () => void;
  /**
   * Medical's New sale (`medical/sales/create`, `S:50`): the type locked to
   * Medical — "New sale", "Medical invoice · stock updates by earliest expiry".
   */
  sale?: boolean;
}

/** What a new invoice opens on — the URL's `?type=` and `?patient=`, a prescription to sell, an invoice to copy. */
export interface InvoiceCreatePrefill {
  type?: InvoiceType;
  /** The patient's file (`pat_…`) — the invoice bills their contact once it is read. */
  patientId?: string | null;
  /** `?prescription=` (Medical, `S:50`): its patient, medicines and "From Rx #500". */
  prescriptionId?: string | null;
  /**
   * `?appointment=` — the visit flow's "Create invoice from visit" (D156): the visit's sessions
   * still to bill as lines, one per offering, each carrying the sessions it bills.
   */
  appointmentId?: string | null;
  /**
   * `?copyOf=` — the patient file's "Copy invoice" (`patient-file.md:43`): the saved invoice a
   * new one starts as — its party, team, lines, discount and remark, dated today with nothing
   * paid (`copiedInvoiceForm`); its save says "Copied as #788" (H:5017).
   */
  copyOf?: InvoiceDetail;
}

/** New invoice — `invoices/create/` (`S:92`), or Medical's New sale. */
export interface InvoiceCreateDrawerProps extends InvoiceDrawerBaseProps {
  mode: 'create';
  prefill?: InvoiceCreatePrefill;
  /** Saved: the host closes the drawer; the page behind stays (D28). */
  onCreated: (outcome: InvoiceDrawerOutcome) => void;
}

/** Edit invoice — `invoices/$invoiceId/edit/` (`S:94`). */
export interface InvoiceEditDrawerProps extends InvoiceDrawerBaseProps {
  mode: 'edit';
  /** The invoice as read (`fetchInvoice`). */
  detail: InvoiceDetail;
  onSaved: (outcome: InvoiceDrawerOutcome) => void;
  /** Deleted from the drawer (its Delete, with Undo in the toast). */
  onDeleted?: () => void;
}

/** Props of {@link InvoiceDrawer}. */
export type InvoiceDrawerProps = InvoiceCreateDrawerProps | InvoiceEditDrawerProps;

/** The item rows a non-compact items field needs: the drawer is 840px (H:3850). */
const CONTENT_PROFILE = { fieldCount: 9, hasItems: true } as const;

/** A new invoice's starting form: the URL's type (Medical for a sale), its patient once read. */
function startingForm(
  props: InvoiceDrawerProps,
  today: string,
  branchId: string | null,
): InvoiceFormValues {
  if (props.mode === 'edit') return invoiceFormOf(props.detail);
  if (props.prefill?.copyOf) {
    return copiedInvoiceForm(props.prefill.copyOf, today, branchId);
  }
  const patientId = props.prefill?.patientId;
  const prefill: InvoicePrefill = {
    type: props.sale ? 'medical' : (props.prefill?.type ?? 'clinic'),
    branchId,
    prescriptionId: props.prefill?.prescriptionId ?? null,
    party: patientId
      ? { kind: 'patient', id: patientId, contactId: null, name: '', phone: null }
      : null,
  };
  return emptyInvoiceForm(today, prefill);
}

/**
 * The props as an opening reads them: the saved invoice, the invoice to copy, the prescription
 * to sell, the hand-offs.
 */
function sessionInput(props: InvoiceDrawerProps) {
  if (props.mode === 'edit') {
    return {
      editing: props.detail,
      copyOf: null,
      prescriptionId: null,
      appointmentId: null,
      onSaved: props.onSaved,
      onDeleted: props.onDeleted,
    };
  }
  return {
    editing: null,
    copyOf: props.prefill?.copyOf ?? null,
    prescriptionId: props.prefill?.prescriptionId ?? null,
    appointmentId: props.prefill?.appointmentId ?? null,
    onSaved: props.onCreated,
    onDeleted: undefined,
  };
}

/** The save's toast: an edit's, a copy's ("Copied as #788") or a new invoice's. */
function saveToastKind(input: ReturnType<typeof sessionInput>) {
  if (input.editing) return 'edit';
  return input.copyOf ? 'copy' : 'create';
}

/**
 * How Edit invoice reads its invoice again after a stale save (`409 record_changed`, the
 * toast's "Reload") — past the cache, with what reads beside it.
 */
const readInvoiceDetail = (
  detail: InvoiceDetail,
  organizationId: string | null,
): EditingRecordRead<InvoiceDetail> => ({
  queryKey: invoiceQueryKeys.detail(organizationId, detail.invoice.id),
  queryFn: () => fetchInvoice(detail.invoice.id),
});

/**
 * The team by id as the Team peek's pills, in their own tones: an invoice's clinozy-be members
 * ("Dr. Drashti"), a sale's fixture staff ("Kiran P.").
 */
function useStaffPills(sale: boolean): ReadonlyMap<string, DrawerPeekPill> {
  const staff = useFixtureStaff();
  const team = useTeamDirectory();
  if (sale) {
    return new Map(
      (staff.data ?? []).map((person) => [
        person.id,
        { label: shortPersonName(personFullName(person)), tone: person.tone },
      ]),
    );
  }
  return new Map(
    team.members.map((member) => [
      member.id,
      { label: shortPersonName(member.name), tone: member.tone },
    ]),
  );
}

/** What the three steps render from. */
interface StepsInput {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  view: InvoiceDrawerView;
  money: DrawerFigures;
  catalog: InvoiceCatalog;
  oftenBilled: Parameters<typeof InvoiceItemsField>[0]['oftenBilled'];
  access: InvoiceDrawerAccess;
  /** The Payment step's form: a sale's, a new invoice's or a saved one's. */
  paymentMode: 'sale' | 'create' | 'edit';
  editing: boolean;
  idPrefix: string;
  branches: Parameters<typeof InvoicePartyFields>[0]['branches'];
  stacks: ReturnType<typeof useInvoiceStacks>;
  onTeamChange: () => void;
}

/** The steps (`payments.md:328`): "Patient & team" · "Items" ("Medicines") · "Payment". */
function invoiceSteps(input: StepsInput): DrawerStep[] {
  const { form, values, view, access, money } = input;
  return [
    {
      id: 'party',
      ...view.steps.party,
      content: (
        <InvoicePartyFields
          form={form}
          values={values}
          idPrefix={input.idPrefix}
          branches={input.branches}
          readOnly={access.readOnly}
          lockedParty={input.editing}
          onParty={input.stacks.setParty}
          onTeamChange={input.onTeamChange}
        />
      ),
    },
    {
      id: 'items',
      ...view.steps.items,
      content: (
        <InvoiceItemsField
          form={form}
          values={values}
          catalog={input.catalog}
          rowFigures={money.rowFigures}
          onFinal={money.onFinal}
          oftenBilled={input.oftenBilled}
          total={money.figures.bill}
          readOnly={access.readOnly}
          locked={access.locked === 'sale'}
          canAddMedicine={access.addMedicine}
          onNewOffering={access.addOffering ? input.stacks.openNewOffering : undefined}
        />
      ),
    },
    {
      id: 'payment',
      ...view.steps.payment,
      content: (
        <InvoicePaymentFields
          form={form}
          values={values}
          figures={money.figures}
          mode={input.paymentMode}
          idPrefix={input.idPrefix}
          readOnly={access.readOnly}
        />
      ),
    },
  ];
}

/** The reads the form's type and party need: the catalogue, a sale's "Often billed", the plan. */
function useInvoiceReads(values: InvoiceFormValues, sale: boolean) {
  const patientId = values.party?.kind === 'patient' ? values.party.id : null;
  const catalog = useInvoiceCatalog(values.type, values.branchId);
  // "Often billed" is the fixture world's, for a sale only (G-P6: no clinozy-be read).
  const often = useOftenBilled('medical');
  const plan = usePlan(sale ? null : patientId);
  return {
    patientId,
    catalog,
    oftenBilled: sale ? oftenBilledItems(often.data ?? [], catalog.items) : [],
    plan: plan.data?.suggestions ?? [],
  };
}

/** Why a saved invoice opens read-only for everyone, said above its steps. */
function LockedNotice({ locked }: { locked: InvoiceDrawerAccess['locked'] }) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  if (!locked) return null;
  return (
    <p
      role="note"
      data-testid={INVOICE_DRAWER_TEST_IDS.notice}
      className="bg-canvas text-detail text-muted-foreground-strong rounded-lg border px-3 py-2"
    >
      {t(locked === 'sale' ? K.notices.sale : K.notices.settled)}
    </p>
  );
}

/** The figures the totals strip reads of the preview. */
function totalsPreview(preview: DrawerPreview) {
  return { failure: preview.failure, retry: preview.retry };
}

/** An edit keeps its team, and so does a copy of an invoice that has one (`payments.md:139`). */
function keepsOwnTeam(input: ReturnType<typeof sessionInput>): boolean {
  return input.editing !== null || (input.copyOf?.invoice.teamIds.length ?? 0) > 0;
}

/** "⚡ Print invoice" for a saved invoice: its sheet as read, the browser's dialog after. */
function printPreset(detail: InvoiceDetail | null): (() => void) | null {
  if (!detail) return null;
  return () => {
    Promise.resolve()
      .then(() => printInvoice(detail))
      .catch(notifyError);
  };
}

/** One opening's form: what it starts on, the invoice it edits (kept in step with a Reload). */
function useSessionForm(props: InvoiceDrawerProps) {
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const [today] = useState(() => clinicToday());
  const input = sessionInput(props);
  const branchId = defaultBranchId(openBranches, preferences.branchFilter);
  const form = useForm<InvoiceFormValues>({
    defaultValues: startingForm(props, today, branchId),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const editing = useEditingRecord({
    record: input.editing,
    form,
    formOf: invoiceFormOf,
    read: readInvoiceDetail,
  });
  return {
    input,
    branches: openBranches,
    branchId,
    form,
    values,
    isDirty,
    detail: editing.record,
    invoice: editing.record?.invoice ?? null,
    reload: editing.reload,
  };
}

/** The session's form, as {@link useSessionForm} reads it. */
type SessionForm = ReturnType<typeof useSessionForm>;

/**
 * Everything one opening derives from its form: the access, the reads and prefills, the
 * server's preview and the figures, the header's words, Quick fill and the save.
 */
function useSessionParts(
  session: SessionForm,
  props: InvoiceDrawerProps,
  onStep: (step: string) => void,
) {
  const { input, form, values, invoice, detail, branchId } = session;
  const newRecord = invoice === null;
  const sale = newRecord && values.type === 'medical';
  const access = useInvoiceAccess(invoice, newRecord && Boolean(props.sale));
  const reads = useInvoiceReads(values, sale);
  usePrefillPatientName(form);
  usePrescriptionPrefill(form, input.prescriptionId, reads.catalog.items);
  useVisitPrefill(form, {
    patientId: reads.patientId,
    appointmentId: input.appointmentId,
    catalog: reads.catalog.items,
  });
  useBranchPrefill(form, branchId);
  const team = useTeamPrefill({
    form,
    ownTeam: keepsOwnTeam(input),
    patientId: reads.patientId,
    sale,
  });
  const stacks = useInvoiceStacks(form);
  const fallbackBranchId = branchId ?? '';
  const live = access.resolved && !(sale || access.readOnly);
  const preview = useDrawerPreview({ values, invoice, enabled: live, fallbackBranchId });
  const money = useDrawerFigures({
    form,
    values,
    sale,
    invoice,
    readOnly: access.readOnly,
    preview,
    catalog: reads.catalog,
    floorVisible: access.floorVisible,
    openedWithLines: input.editing !== null || input.copyOf !== null,
  });
  const view = useInvoiceDrawerView({
    values,
    figures: money.figures,
    seq: invoice?.seq ?? null,
    sale: Boolean(props.sale),
    sessionLines: money.sessionLines,
    staff: useStaffPills(sale),
    branch: session.branches.find((branch) => branch.id === values.branchId) ?? null,
  });
  const quickFill = useInvoiceQuickFill({
    form,
    values,
    catalog: reads.catalog,
    presets: team.presets,
    latestRx: team.latestRx,
    plan: reads.plan,
    invoiceId: invoice?.id ?? null,
    onPrint: printPreset(detail),
  });
  const saving = useInvoiceSave({
    form,
    invoice,
    sale,
    fallbackBranchId,
    catalog: reads.catalog,
    figures: money.figures,
    refusedRows: preview.refusedRows,
    floorVisible: access.floorVisible,
    onStep,
    onStale: newRecord ? undefined : () => void session.reload(),
    onDone: useSaveToast(saveToastKind(input), input.onSaved),
  });
  return {
    sale,
    live,
    access,
    reads,
    team,
    stacks,
    preview,
    money,
    view,
    quickFill,
    saving,
  };
}

/** One opening of the drawer: the form, its catalogue, its checks and its save. */
function InvoiceDrawerSession(props: InvoiceDrawerProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const idPrefix = `invoice-${useId().replace(/:/g, '')}`;
  // Every drawer opens on its first step, a prefilled patient's too (H:3840 `step`).
  const [openStep, setOpenStep] = useState<string>('party');
  const [deleting, setDeleting] = useState(false);
  const session = useSessionForm(props);
  const { form, values, invoice } = session;
  const parts = useSessionParts(session, props, setOpenStep);
  const { access, view, money } = parts;

  const switchType = (type: InvoiceType) => {
    form.setValue('type', type, { shouldDirty: true });
    // Switching clears the items (`payments.md:134`); only a patient bills a clinic invoice.
    form.setValue('items', [blankLine()], { shouldDirty: true });
    const party = form.getValues('party');
    if (type !== 'medical' && party?.kind !== 'patient') parts.stacks.setParty(null);
  };

  const steps = invoiceSteps({
    form,
    values,
    view,
    money,
    catalog: parts.reads.catalog,
    oftenBilled: parts.reads.oftenBilled,
    access,
    paymentMode: paymentModeOf(parts.sale, invoice),
    editing: invoice !== null,
    idPrefix,
    branches: session.branches,
    stacks: parts.stacks,
    onTeamChange: parts.team.touch,
  });
  const missingParty = t(
    values.type === 'medical' ? K.errors.pickCustomer : K.errors.pickPatient,
  );
  // The type is chosen once: a sale's is Medical, a saved invoice keeps its own.
  const switchable = !(props.sale || invoice);

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={view.title}
        tag={view.tag}
        sub={view.sub}
        badges={view.badges}
        quickFill={parts.quickFill}
        headerStrip={
          switchable && (
            <InvoiceTypeSwitch
              value={values.type}
              onChange={switchType}
              disabled={access.readOnly}
            />
          )
        }
        footerStrip={
          <InvoiceTotals
            figures={money.figures}
            // None on a sale or a read-only invoice.
            preview={parts.live ? totalsPreview(parts.preview) : null}
          />
        }
        content={CONTENT_PROFILE}
        tone={INVOICE_DRAWER_TONE}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(missingParty)}
        summary={view.summary}
        readOnly={access.readOnly}
        saveLabel={view.saveLabel}
        onSave={() => void parts.saving.save(false)}
        saveState={parts.saving.saveState}
        onDelete={access.canDelete ? () => setDeleting(true) : undefined}
        dirty={session.isDirty}
        testId={INVOICE_DRAWER_TEST_ID}
      >
        <LockedNotice locked={access.locked} />
      </RecordDrawer>
      <OfferingQuickCreate
        open={parts.stacks.offering.isOpen}
        query={parts.stacks.offering.query}
        onClose={parts.stacks.offering.close}
        onCreated={parts.stacks.offering.complete}
      />
      {invoice && (
        <InvoiceDeleteConfirm
          invoice={invoice}
          open={deleting}
          record={view.summary}
          onClose={() => setDeleting(false)}
          onDeleted={session.input.onDeleted}
        />
      )}
    </>
  );
}

/** The Payment step's form: a sale's, a new invoice's, or a saved invoice's. */
function paymentModeOf(sale: boolean, invoice: InvoiceRecord | null) {
  if (sale) return 'sale';
  return invoice ? 'edit' : 'create';
}

/** Props of {@link InvoiceDeleteConfirm}. */
export interface InvoiceDeleteConfirmProps {
  invoice: Pick<InvoiceRecord, 'id' | 'seq'>;
  open: boolean;
  /** The confirm's record pill — the drawer's summary, a row's "Invoice #787". */
  record: string;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Why clinozy-be refuses a delete, in the screen's words: money paid, a used session. */
const DELETE_REFUSALS: ReadonlyMap<string, string> = new Map([
  ['invoice_paid', K.refusals.paid],
  ['offering_in_use', K.refusals.inUseDelete],
]);

/**
 * An invoice's Delete — `payment:delete`, from Edit invoice or the patient file's Invoices row:
 * the shared reason confirm, "Delete this invoice?", the invoice in its pill (`DELETE
 * /app/invoices/:id?reason=&note=`); "Invoice #787 deleted" offers Undo for 10s (`POST
 * …/restore`, D32, `S:1546`). An invoice with money paid or a credit note (`409 invoice_paid`),
 * or a package whose session is used (`offering_in_use`), stays — said in the screen's words,
 * the confirm closed.
 */
export function InvoiceDeleteConfirm({
  invoice,
  open,
  record,
  onClose,
  onDeleted,
}: InvoiceDeleteConfirmProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const remove = useDeleteInvoice({ notifyOnError: false });
  const restore = useRestoreInvoice();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t(K.deleteTitle)}
      reason={{
        record,
        undo: {
          message: t(K.toasts.deleted, { seq: invoice.seq }),
          onUndo: () => restore.mutateAsync(invoice.id),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        try {
          await remove.mutateAsync({ id: invoice.id, reason, note });
        } catch (error) {
          const refusal = DELETE_REFUSALS.get(apiErrorReason(error) ?? '');
          if (refusal) {
            // A refusal is final: the confirm closes on it — no Undo, nothing to retry.
            notify.error(t(refusal));
            onClose();
          } else notifyError(error);
          throw error;
        }
        onDeleted?.();
      }}
    />
  );
}

/**
 * The shared Invoice drawer (KICKOFF §6.9; `payments.md:132–150`; H:5051–5068) on the record
 * drawer, 840px for its item rows: New invoice / Edit invoice — or Medical's New sale, the type
 * locked — in three steps, "Patient & team" · "Items" ("Medicines") · "Payment", the type switch
 * (Clinic · Medical · Consultation; switching clears the items), Quick fill, the badges (type ·
 * "Bill ₹324" · "Covers 6 sessions" · "Cash + UPI" · "Draft" / "₹324 due" / "Fully paid") and
 * the totals above the footer. A clinic or consultation invoice is clinozy-be's: the server
 * prices every line — the best live offer at the branch and date, never under the lowest price
 * — and the drawer shows its preview as the member types, never its own sums; the save creates
 * the invoice with "Paid now" as one receipt, or changes what differs with the read's
 * `updated_at`. A Medical sale stays on the fixture world (D153 seam). Every opening starts a
 * fresh form.
 */
export function InvoiceDrawer(props: InvoiceDrawerProps) {
  const { session } = useDrawerSession(props.open);
  return <InvoiceDrawerSession key={session} {...props} />;
}
