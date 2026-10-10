import { useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { InvoiceType } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type {
  InvoiceDetail,
  InvoiceRecord,
  InvoiceSaveResult,
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
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFixturePlan as usePlan } from '@/shared/hooks/useFixturePlan/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import {
  useDeleteInvoice,
  useOftenBilled,
  useRestoreInvoice,
} from '@/shared/hooks/useInvoices/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_ID,
  INVOICE_DRAWER_TONE,
} from './invoice-drawer.constants.ts';
import { type InvoiceDrawerView, useInvoiceDrawerView } from './invoice-drawer-view.ts';
import {
  blankLine,
  copiedInvoiceForm,
  draftFigures,
  emptyInvoiceForm,
  type InvoiceDraftFigures,
  invoiceFormOf,
  type InvoiceFormValues,
  type InvoicePrefill,
} from './invoice-form.ts';
import { type InvoiceCatalogItem, oftenBilledItems, rowFloor } from './invoice-lines.ts';
import { useInvoiceQuickFill } from './invoice-presets.ts';
import { printInvoice } from './invoice-sheet.tsx';
import { InvoiceItemsField } from './InvoiceItemsField.tsx';
import { InvoicePartyFields } from './InvoicePartyFields.tsx';
import { InvoicePaymentFields } from './InvoicePaymentFields.tsx';
import { InvoiceTotals } from './InvoiceTotals.tsx';
import { InvoiceTypeSwitch } from './InvoiceTypeSwitch.tsx';
import { type InvoiceCatalog, useInvoiceCatalog } from './use-invoice-catalog.ts';
import {
  useBranchPrefill,
  useInvoiceStacks,
  usePrefillPatientName,
  usePrescriptionPrefill,
  useSaveToast,
  useTeamPrefill,
} from './use-invoice-drawer.ts';
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
  patientId?: string | null;
  /** `?prescription=` (Medical, `S:50`): its patient, medicines and "From Rx #500". */
  prescriptionId?: string | null;
  /**
   * `?copyOf=` — the patient file's "Copy invoice" (`patient-file.md:43`): the
   * saved invoice a new one starts as — its party, team, lines, discount and
   * remark, dated today with nothing paid (`copiedInvoiceForm`); its save
   * says "Copied as #788" (H:5017).
   */
  copyOf?: InvoiceDetail;
}

/** New invoice — `invoices/create/` (`S:92`), or Medical's New sale. */
export interface InvoiceCreateDrawerProps extends InvoiceDrawerBaseProps {
  mode: 'create';
  prefill?: InvoiceCreatePrefill;
  /** Saved: the host closes the drawer; the page behind stays (D28). */
  onCreated: (result: InvoiceSaveResult) => void;
}

/** Edit invoice — `invoices/$invoiceId/edit/` (`S:94`). */
export interface InvoiceEditDrawerProps extends InvoiceDrawerBaseProps {
  mode: 'edit';
  detail: InvoiceDetail;
  onSaved: (result: InvoiceSaveResult) => void;
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
    party: patientId ? { kind: 'patient', id: patientId, name: '', phone: null } : null,
  };
  return emptyInvoiceForm(today, prefill);
}

/**
 * What the drawer's access allows (KICKOFF §6.9 Access; Q-U8): Payments Create
 * or Edit — but Medical's New sale is Medical's create (§6.7 Access: Admin,
 * Pharmacist), so a pharmacist without Payments still sells.
 */
function useInvoiceAccess(editing: InvoiceDetail | null, newSale: boolean) {
  const access = useClinicAccess();
  const readOnly =
    access.isResolved &&
    !access.can(newSale ? 'medical' : 'payments', editing ? 'edit' : 'create');
  const sale = Boolean(editing?.invoice.saleId);
  return {
    readOnly,
    /** A sale's medicines are never changed (`S:51`). */
    sale,
    /** Delete: the `void` ability, never a sale's invoice (Medical voids those). */
    canDelete: editing !== null && !readOnly && !sale && access.canAbility('void'),
    disc: access.canAbility('disc'),
    floorVisible: access.canAbility('floor'),
    /** A medicine the store lacks becomes a quick draft (Q-M4): Medical's create. */
    addMedicine: access.can('medical', 'create'),
  };
}

/** The staff by id as the Team peek's pills: "Dr. Drashti", "Kiran P." in their own tones. */
function useStaffPills(): ReadonlyMap<string, DrawerPeekPill> {
  const staff = useStaffProfiles();
  return new Map(
    (staff.data ?? []).map((person) => [
      person.id,
      { label: shortPersonName(personFullName(person)), tone: person.tone },
    ]),
  );
}

/** What the three steps render from. */
interface StepsInput {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  view: InvoiceDrawerView;
  figures: InvoiceDraftFigures;
  catalog: InvoiceCatalog;
  oftenBilled: readonly InvoiceCatalogItem[];
  floorOf: (row: InvoiceFormValues['items'][number]) => number | null;
  access: ReturnType<typeof useInvoiceAccess>;
  editing: boolean;
  alreadyPaid: number;
  idPrefix: string;
  branches: Parameters<typeof InvoicePartyFields>[0]['branches'];
  stacks: ReturnType<typeof useInvoiceStacks>;
  onTeamChange: () => void;
  onPromo: (item: InvoiceCatalogItem) => void;
}

/** The steps (`payments.md:328`): "Patient & team" · "Items" ("Medicines") · "Payment". */
function invoiceSteps(input: StepsInput): DrawerStep[] {
  const { form, values, view, access } = input;
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
          floorOf={input.floorOf}
          floorVisible={access.floorVisible}
          oftenBilled={input.oftenBilled}
          total={input.figures.totals.bill}
          readOnly={access.readOnly}
          locked={access.sale}
          canAddMedicine={access.addMedicine}
          onNewOffering={input.stacks.openNewOffering}
          onPromo={input.onPromo}
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
          figures={input.figures}
          alreadyPaid={input.alreadyPaid}
          idPrefix={input.idPrefix}
          readOnly={access.readOnly}
        />
      ),
    },
  ];
}

/**
 * The props as an opening reads them: the saved invoice, the invoice to copy,
 * the prescription to sell, the hand-offs.
 */
function sessionInput(props: InvoiceDrawerProps) {
  if (props.mode === 'edit') {
    return {
      editing: props.detail,
      copyOf: null,
      prescriptionId: null,
      onSaved: props.onSaved,
      onDeleted: props.onDeleted,
    };
  }
  return {
    editing: null,
    copyOf: props.prefill?.copyOf ?? null,
    prescriptionId: props.prefill?.prescriptionId ?? null,
    onSaved: props.onCreated,
    onDeleted: undefined,
  };
}

/** The save's toast: an edit's, a copy's ("Copied as #788") or a new invoice's. */
function saveToastKind(input: ReturnType<typeof sessionInput>) {
  if (input.editing) return 'edit';
  return input.copyOf ? 'copy' : 'create';
}

/** The reads the form's type and party need: the catalogue, "Often billed", the plan. */
function useInvoiceReads(values: InvoiceFormValues) {
  const medical = values.type === 'medical';
  const patientId = values.party?.kind === 'patient' ? values.party.id : null;
  const catalog = useInvoiceCatalog(values.type, values.branchId);
  const often = useOftenBilled(medical ? 'medical' : 'clinic');
  const plan = usePlan(medical ? null : patientId);
  return {
    medical,
    patientId,
    catalog,
    oftenBilled: oftenBilledItems(often.data ?? [], catalog.items),
    plan: plan.data?.suggestions ?? [],
  };
}

/** The saved invoice's own figures: what it has received, its number and id. */
function savedFigures(editing: InvoiceDetail | null) {
  return {
    alreadyPaid: editing?.balance.paid ?? 0,
    seq: editing?.invoice.seq ?? null,
    invoiceId: editing?.invoice.id ?? null,
  };
}

/** One opening of the drawer: the form, its catalogue, its checks and its save. */
function InvoiceDrawerSession(props: InvoiceDrawerProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const idPrefix = `invoice-${useId().replace(/:/g, '')}`;
  const [today] = useState(() => clinicToday());
  const input = sessionInput(props);
  const { editing } = input;
  const saved = savedFigures(editing);
  const access = useInvoiceAccess(editing, editing === null && Boolean(props.sale));
  const branchId = defaultBranchId(openBranches, preferences.branchFilter);

  const form = useForm<InvoiceFormValues>({
    defaultValues: startingForm(props, today, branchId),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  // Every drawer opens on its first step, a prefilled patient's too (H:3840 `step`).
  const [openStep, setOpenStep] = useState<string>('party');
  const [deleting, setDeleting] = useState(false);

  const reads = useInvoiceReads(values);
  const { catalog } = reads;
  usePrefillPatientName(form);
  usePrescriptionPrefill(form, input.prescriptionId, catalog.items);
  useBranchPrefill(form, branchId);
  // An edit keeps its team, and so does a copy of an invoice that has one; a
  // copy of one without starts like any new invoice (`payments.md:139`).
  const ownTeam = editing !== null || (input.copyOf?.invoice.teamIds.length ?? 0) > 0;
  const team = useTeamPrefill(form, ownTeam, reads.patientId);
  const stacks = useInvoiceStacks(form, today);

  const figures = draftFigures(values, saved.alreadyPaid);
  const floorOf = (row: InvoiceFormValues['items'][number]) =>
    rowFloor(row, catalog.offerings, catalog.byKey, { disc: access.disc });
  const view = useInvoiceDrawerView({
    values,
    figures,
    seq: saved.seq,
    sale: Boolean(props.sale),
    offerings: catalog.offerings,
    staff: useStaffPills(),
    branch: openBranches.find((branch) => branch.id === values.branchId) ?? null,
  });
  const quickFill = useInvoiceQuickFill({
    form,
    values,
    catalog,
    presets: team.presets,
    plan: reads.plan,
    invoiceId: saved.invoiceId,
    onPrint: editing && (() => void printInvoice(editing)),
  });
  const { saveState, save } = useInvoiceSave({
    form,
    invoiceId: saved.invoiceId,
    alreadyPaid: saved.alreadyPaid,
    fallbackBranchId: branchId ?? '',
    catalog,
    floorOf,
    floorVisible: access.floorVisible,
    onStep: setOpenStep,
    onDone: useSaveToast(saveToastKind(input), input.onSaved),
  });

  const switchType = (type: InvoiceType) => {
    form.setValue('type', type, { shouldDirty: true });
    // Switching clears the items (`payments.md:134`); only a patient bills a clinic invoice.
    form.setValue('items', [blankLine()], { shouldDirty: true });
    const party = form.getValues('party');
    if (type !== 'medical' && party?.kind !== 'patient') stacks.setParty(null);
  };

  const steps = invoiceSteps({
    form,
    values,
    view,
    figures,
    catalog,
    oftenBilled: reads.oftenBilled,
    floorOf,
    access,
    editing: editing !== null,
    alreadyPaid: saved.alreadyPaid,
    idPrefix,
    branches: openBranches,
    stacks,
    onTeamChange: team.touch,
    onPromo: (item) =>
      notify.info(t(K.toasts.promo, { offer: item.promo, offering: item.label })),
  });
  const missingParty = t(reads.medical ? K.errors.pickCustomer : K.errors.pickPatient);
  // The type is chosen once: a sale's is Medical, a saved invoice keeps its own.
  const switchable = !(props.sale || editing);

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={view.title}
        tag={view.tag}
        sub={view.sub}
        badges={view.badges}
        quickFill={quickFill}
        headerStrip={
          switchable && (
            <InvoiceTypeSwitch
              value={values.type}
              onChange={switchType}
              disabled={access.readOnly}
            />
          )
        }
        footerStrip={<InvoiceTotals figures={figures} />}
        content={CONTENT_PROFILE}
        tone={INVOICE_DRAWER_TONE}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(missingParty)}
        summary={view.summary}
        readOnly={access.readOnly}
        saveLabel={view.saveLabel}
        onSave={() => void save(false)}
        saveState={saveState}
        onDelete={access.canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={INVOICE_DRAWER_TEST_ID}
      />
      <InvoiceStackedDrawers stacks={stacks} />
      {editing && (
        <InvoiceDeleteConfirm
          invoice={editing.invoice}
          open={deleting}
          record={view.summary}
          onClose={() => setDeleting(false)}
          onDeleted={input.onDeleted}
        />
      )}
    </>
  );
}

/**
 * The drawer stacked on the invoice: New offering (L-30e). New patient (Q-P2) comes back with
 * Payments on clinozy-be — this drawer still reads the fixture patients (D152).
 */
function InvoiceStackedDrawers({
  stacks,
}: {
  stacks: ReturnType<typeof useInvoiceStacks>;
}) {
  return (
    <OfferingQuickCreate
      open={stacks.offering.isOpen}
      query={stacks.offering.query}
      onClose={stacks.offering.close}
      onCreated={stacks.offering.complete}
    />
  );
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

/**
 * An invoice's Delete — the `void` ability (Q-U8), from Edit invoice or the
 * patient file's Invoices row: the shared reason confirm, "Delete this
 * invoice?", the invoice in its pill; "Invoice #787 deleted" offers Undo for
 * 10s (D32, `S:1546`).
 */
export function InvoiceDeleteConfirm({
  invoice,
  open,
  record,
  onClose,
  onDeleted,
}: InvoiceDeleteConfirmProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const remove = useDeleteInvoice();
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
        await remove.mutateAsync({ id: invoice.id, reason, note });
        onDeleted?.();
      }}
    />
  );
}

/**
 * The shared Invoice drawer (KICKOFF §6.9; `payments.md:132–150`;
 * H:5051–5068) on the record drawer, 840px for its item rows: New invoice /
 * Edit invoice — or Medical's New sale, the type locked — in three steps,
 * "Patient & team" · "Items" ("Medicines") · "Payment", the type switch
 * (Clinic · Medical · Consultation; switching clears the items), Quick fill,
 * the badges (type · "Bill ₹324" · "Covers 6 sessions" · "Cash + UPI" · "Draft"
 * / "₹324 due" / "Fully paid") and the totals above the footer. Every
 * figure comes from the one money module (Q-G7: the overall percent before
 * tax); a Final below its floor turns red. A save creates the invoice — or the
 * sale with its stock drawn by earliest expiry — the receipt for "Paid now",
 * the packages and the plan links, and a "Payment due" task for a balance.
 * Every opening starts a fresh form.
 */
export function InvoiceDrawer(props: InvoiceDrawerProps) {
  const { session } = useDrawerSession(props.open);
  return <InvoiceDrawerSession key={session} {...props} />;
}
