import { useEffect, useMemo, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { InvoiceType } from '@/shared/api/app/app-schema.ts';
import type { InvoicePresets } from '@/shared/api/app/invoices-contracts.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import { useContact } from '@/shared/hooks/useContacts/index.ts';
import { useInvoicePresets } from '@/shared/hooks/useInvoices/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { useOffers } from '@/shared/hooks/useOffers/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';
import { useVisitTreatmentsToBill } from '@/shared/hooks/useTreatments/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import type { InvoiceFormValues, InvoicePartyForm } from './invoice-form.ts';
import {
  type InvoiceCatalogItem,
  lineFromCatalog,
  offeringCatalogItem,
} from './invoice-lines.ts';
import { rxLines, visitLines } from './invoice-presets.ts';
import { type SalePrescription, salePrescriptionOf } from './sale-form.ts';

/*
 * The Invoice drawer's form-level behaviour beside its fields (KICKOFF §6.9): what arrives after
 * it opens (the prefilled patient's name and contact, a prescription's medicines, the branch, the
 * team), the stacked "New offering", and the save's toasts — all clinozy-be's, a Medical sale's
 * too.
 */

const K = INVOICE_DRAWER_KEYS;

type InvoiceForm = UseFormReturn<InvoiceFormValues>;

/** A prefilled party's id while its name is still to read; null otherwise. */
const unnamedPatient = (party: InvoicePartyForm | null) =>
  party?.kind === 'patient' && party.name === '' ? party.id : undefined;

/** A prefilled buyer's contact while its name is still to read; undefined otherwise. */
const unnamedContact = (party: InvoicePartyForm | null) =>
  party?.kind === 'contact' && party.name === '' && party.contactId
    ? party.contactId
    : undefined;

/**
 * A prefilled patient (`?patient=`, a sale's `?customer=pat_…`) or a sale's buyer
 * (`?customer=con_…`) arrives as an id: their name, mobile and the contact the invoice or the
 * sale bills — and a buyer's patient file — follow once read (clinozy-be's).
 */
export function usePrefillPatientName(form: InvoiceForm): void {
  const party = form.getValues('party');
  const patient = usePatient(unnamedPatient(party));
  const contact = useContact(unnamedContact(party));
  useEffect(() => {
    const current = form.getValues('party');
    const buyer = contact.data;
    if (!buyer || current?.contactId !== buyer.id || current.name) return;
    form.setValue('party', {
      kind: buyer.patientId ? 'patient' : 'contact',
      id: buyer.patientId ?? buyer.id,
      contactId: buyer.id,
      name: buyer.name,
      phone: buyer.primaryPhone || null,
    });
  }, [form, contact.data]);
  useEffect(() => {
    const current = form.getValues('party');
    if (!patient.data || current?.id !== patient.data.id || current.name) return;
    form.setValue('party', {
      kind: 'patient',
      id: patient.data.id,
      contactId: patient.data.contactId,
      name: patient.data.name,
      phone: patient.data.phone,
    });
  }, [form, patient.data]);
}

/**
 * A sale's patient's approved prescriptions, newest first, as a sale fills them — clinozy-be's
 * (`GET /app/patients/:patient_id/prescriptions`); idle outside a sale or without a patient.
 */
function useSalePrescriptions(
  patientId: string | null,
  sale: boolean,
): SalePrescription[] {
  const read = usePatientPrescriptions(patientId ?? '', {
    enabled: sale && patientId !== null,
    notifyOnError: false,
  });
  return useMemo(
    () =>
      (read.data ?? [])
        .filter((record) => record.status === 'approved')
        .map(salePrescriptionOf),
    [read.data],
  );
}

/**
 * A sale from a prescription (`?prescription=&customer=`, `S:50`; `medical.md:401`): once the
 * patient's prescriptions and the medicines are known, the prescription's medicines in stock and
 * the Remark "From Rx #500"; a name the store lacks is named in a toast ("Flubolt 400 not in the
 * medicine list · add from the quick line"). The prescription is read among its patient's — a
 * prescription alone, with no patient, prefills nothing.
 */
export function usePrescriptionPrefill(
  form: InvoiceForm,
  {
    prescriptionId,
    patientId,
    catalog,
  }: {
    prescriptionId: string | null;
    patientId: string | null;
    catalog: readonly InvoiceCatalogItem[];
  },
): void {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const prescriptions = useSalePrescriptions(patientId, prescriptionId !== null);
  const filledRef = useRef(false);
  const preset = prescriptions.find((rx) => rx.id === prescriptionId);
  useEffect(() => {
    if (!preset || filledRef.current || catalog.length === 0) return;
    filledRef.current = true;
    const { lines, unmatched } = rxLines(preset, catalog);
    if (lines.length > 0) form.setValue('items', lines);
    form.setValue('remark', t(K.presets.rx, { seq: preset.seq }));
    for (const name of unmatched) notify.info(t(K.toasts.rxUnmatched, { name }));
  }, [preset, catalog, form, t]);
}

/**
 * The visit flow's "Create invoice from visit" (`?appointment=`, D156): once the visit's sessions
 * still to bill are read (`GET /app/patients/:patient_id/treatments?appointment_id=
 * &is_billed=false`) and the catalogue is in, the items become one line per offering carrying
 * the sessions it bills ({@link visitLines}) — once; nothing to bill leaves the blank row.
 */
export function useVisitPrefill(
  form: InvoiceForm,
  {
    patientId,
    appointmentId,
    catalog,
  }: {
    patientId: string | null;
    appointmentId: string | null;
    catalog: readonly InvoiceCatalogItem[];
  },
): void {
  const sessions = useVisitTreatmentsToBill(patientId, appointmentId).data;
  const filledRef = useRef(false);
  useEffect(() => {
    if (!sessions || filledRef.current || catalog.length === 0) return;
    filledRef.current = true;
    const lines = visitLines(sessions, catalog);
    if (lines.length > 0) form.setValue('items', lines);
  }, [sessions, catalog, form]);
}

/** A new invoice files under the screen's branch once the branches have loaded. */
export function useBranchPrefill(form: InvoiceForm, branchId: string | null): void {
  useEffect(() => {
    if (!form.getValues('branchId') && branchId) form.setValue('branchId', branchId);
  }, [form, branchId]);
}

/** What the team prefill hands the drawer: Quick fill's reads, and the member's own touch. */
export interface TeamPrefill {
  /** An invoice's patient's packages and last invoices (clinozy-be). */
  presets: InvoicePresets | null;
  /** A sale's patient's latest approved prescription — "⚡ From Rx #500". */
  latestRx: SalePrescription | null;
  /** The member changed the team: no prefill replaces it any more. */
  touch: () => void;
}

/**
 * The team a new invoice starts with (`payments.md:139`): the patient's last invoice's team,
 * else the member themself — until the member changes it; a Medical sale's "Prescribed by" the
 * member themself. An invoice with a team of its own keeps it (`ownTeam`): an edit, a copy.
 * Both name memberships (`mem_…`, clinozy-be's team).
 */
export function useTeamPrefill({
  form,
  ownTeam,
  patientId,
  sale,
}: {
  form: InvoiceForm;
  ownTeam: boolean;
  patientId: string | null;
  sale: boolean;
}): TeamPrefill {
  const presets = useInvoicePresets(sale ? null : patientId);
  const [latestRx] = useSalePrescriptions(patientId, sale);
  const myMembershipId = useMyMembershipId();
  const touchedRef = useRef(ownTeam);
  const recent = presets.data?.recentTeamIds ?? [];
  const key = (recent.length > 0 ? recent : [myMembershipId ?? ''])
    .filter(Boolean)
    .join();
  useEffect(() => {
    if (touchedRef.current || key === '') return;
    if (form.getValues('teamIds').join() === key) return;
    form.setValue('teamIds', key.split(','));
  }, [form, key]);
  return {
    presets: presets.data ?? null,
    latestRx: latestRx ?? null,
    touch: () => {
      touchedRef.current = true;
    },
  };
}

/**
 * The drawer stacked on the invoice (`_patterns.md:37`, S:116): "New offering · “q”" from a
 * row's picker fills that row with the new offering (clinozy-be's — `offering:create`).
 */
export function useInvoiceStacks(form: InvoiceForm) {
  const offers = useOffers();
  const setParty = (party: InvoicePartyForm | null) =>
    form.setValue('party', party, { shouldDirty: true });
  const rowRef = useRef<number | null>(null);
  const offering = useStackedDrawer<OfferingRecord>((created) => {
    const index = rowRef.current;
    if (index === null) return;
    const item = offeringCatalogItem(
      created,
      form.getValues('branchId'),
      offers.data ?? [],
    );
    const qty = form.getValues(`items.${index}.qty`);
    form.setValue(
      `items.${index}`,
      { ...lineFromCatalog(item), qty },
      { shouldDirty: true },
    );
  });
  return {
    setParty,
    offering,
    openNewOffering: (rowIndex: number, query: string) => {
      rowRef.current = rowIndex;
      offering.open(query);
    },
  };
}

/** What a save hands back: the invoice (or sale invoice) as saved, and the plan rows it bills. */
export interface InvoiceDrawerOutcome {
  invoiceId: string;
  /** "#788". */
  seq: number;
  type: InvoiceType;
  /** Plan rows its lines bill ("· 2 offering suggestions items marked invoiced"). */
  planLinked: number;
}

/**
 * A save's toast (`payments.md:149`): "Clinic invoice #788 created" (+ "· 2 offering
 * suggestions items marked invoiced"), a copy's "Copied as #788" (H:5017, + the same), "Invoice
 * #787 saved" (+ "· offering suggestions updated") — then the host's hand-off.
 */
export function useSaveToast(
  kind: 'create' | 'copy' | 'edit',
  onSaved: (outcome: InvoiceDrawerOutcome) => void,
) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  return (outcome: InvoiceDrawerOutcome) => {
    const linked = outcome.planLinked;
    if (kind === 'edit') {
      notify.success(
        t(linked > 0 ? K.toasts.savedPlan : K.toasts.saved, { seq: outcome.seq }),
      );
    } else {
      const created =
        kind === 'copy'
          ? t(K.toasts.copied, { seq: outcome.seq })
          : t(K.toasts.created[outcome.type], { seq: outcome.seq });
      notify.success(
        linked > 0 ? t(K.toasts.createdPlan, { created, count: linked }) : created,
      );
    }
    onSaved(outcome);
  };
}
