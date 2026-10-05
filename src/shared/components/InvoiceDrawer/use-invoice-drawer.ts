import { useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type {
  InvoicePresets,
  InvoiceRxPreset,
  InvoiceSaveResult,
} from '@/shared/api/clinic/invoices-contracts.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import {
  patientName,
  type PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import {
  useInvoicePresets,
  usePrescriptionPreset,
} from '@/shared/hooks/useInvoices/index.ts';
import { useOffers } from '@/shared/hooks/useOffers/index.ts';
import { usePatient } from '@/shared/hooks/usePatients/index.ts';
import { useStackedDrawer } from '@/shared/hooks/useStackedDrawer/index.ts';
import { useMyStaffProfile } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import type { InvoiceFormValues, InvoicePartyForm } from './invoice-form.ts';
import {
  type InvoiceCatalogItem,
  lineFromCatalog,
  offeringCatalogItem,
} from './invoice-lines.ts';
import { rxLines } from './invoice-presets.ts';

/*
 * The Invoice drawer's form-level behaviour beside its fields (KICKOFF §6.9):
 * what arrives after it opens (the prefilled patient's name, a prescription's
 * medicines, the branch, the team), the stacked "New patient" and "New
 * offering", and the save's toasts.
 */

const K = INVOICE_DRAWER_KEYS;

type InvoiceForm = UseFormReturn<InvoiceFormValues>;

/** A prefilled patient (`?patient=`) arrives as an id: their name and mobile follow once read. */
export function usePrefillPatientName(form: InvoiceForm): void {
  const party = form.getValues('party');
  const patient = usePatient(
    party?.kind === 'patient' && !party.name ? party.id : undefined,
  );
  useEffect(() => {
    const current = form.getValues('party');
    if (!patient.data || current?.id !== patient.data.id || current.name) return;
    form.setValue('party', {
      kind: 'patient',
      id: patient.data.id,
      name: patientName(patient.data),
      phone: patient.data.phone,
    });
  }, [form, patient.data]);
}

/**
 * A sale from a prescription (`?prescription=`, `S:50`; `medical.md:401`):
 * once the medicines are known, its patient, its medicines in stock and the
 * Remark "From Rx #500"; a name the store lacks is named in a toast ("Flubolt
 * 400 not in the medicine list · add from the quick line").
 */
export function usePrescriptionPrefill(
  form: InvoiceForm,
  prescriptionId: string | null,
  catalog: readonly InvoiceCatalogItem[],
): void {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const rx = usePrescriptionPreset(prescriptionId);
  const filledRef = useRef(false);
  const preset: InvoiceRxPreset | undefined = rx.data;
  useEffect(() => {
    if (!preset || filledRef.current || catalog.length === 0) return;
    filledRef.current = true;
    const { lines, unmatched } = rxLines(preset, catalog);
    if (!form.getValues('party')) {
      form.setValue('party', {
        kind: 'patient',
        id: preset.patientId,
        name: '',
        phone: null,
      });
    }
    if (lines.length > 0) form.setValue('items', lines);
    form.setValue('remark', t(K.presets.rx, { seq: preset.seq }));
    for (const name of unmatched) notify.info(t(K.toasts.rxUnmatched, { name }));
  }, [preset, catalog, form, t]);
}

/** A new invoice files under the screen's branch once the branches have loaded. */
export function useBranchPrefill(form: InvoiceForm, branchId: string | null): void {
  useEffect(() => {
    if (!form.getValues('branchId') && branchId) form.setValue('branchId', branchId);
  }, [form, branchId]);
}

/** What the team prefill hands the drawer: Quick fill's reads, and the member's own touch. */
export interface TeamPrefill {
  presets: InvoicePresets | null;
  /** The member changed the team: no prefill replaces it any more. */
  touch: () => void;
}

/**
 * The team a new invoice starts with (`payments.md:139`): the patient's last
 * invoice's team, else the member themself — until the member changes it. An
 * invoice with a team of its own keeps it (`ownTeam`): an edit, a copy.
 */
export function useTeamPrefill(
  form: InvoiceForm,
  ownTeam: boolean,
  patientId: string | null,
): TeamPrefill {
  const me = useMyStaffProfile();
  const presets = useInvoicePresets(patientId);
  const touchedRef = useRef(ownTeam);
  const recent = presets.data?.recentTeamIds ?? [];
  const mine = me.data ? [me.data.id] : [];
  const key = (recent.length > 0 ? recent : mine).join();
  useEffect(() => {
    if (touchedRef.current || key === '') return;
    if (form.getValues('teamIds').join() === key) return;
    form.setValue('teamIds', key.split(','));
  }, [form, key]);
  return {
    presets: presets.data ?? null,
    touch: () => {
      touchedRef.current = true;
    },
  };
}

/**
 * The drawers stacked on the invoice (`_patterns.md:37`, S:116): "New patient
 * · “q”" from the Patient field picks the new patient; "New offering · “q”"
 * from a row's picker fills that row with the new offering.
 */
export function useInvoiceStacks(form: InvoiceForm, today: string) {
  const offers = useOffers();
  const setParty = (party: InvoicePartyForm | null) =>
    form.setValue('party', party, { shouldDirty: true });
  const patient = useStackedDrawer<PatientRecord>((created) =>
    setParty({
      kind: 'patient',
      id: created.id,
      name: patientName(created),
      phone: created.phone,
    }),
  );
  const rowRef = useRef<number | null>(null);
  const offering = useStackedDrawer<OfferingRecord>((created) => {
    const index = rowRef.current;
    if (index === null) return;
    const item = offeringCatalogItem(
      created,
      form.getValues('branchId'),
      offers.data ?? [],
      today,
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
    patient,
    offering,
    openNewOffering: (rowIndex: number, query: string) => {
      rowRef.current = rowIndex;
      offering.open(query);
    },
  };
}

/**
 * A save's toast (`payments.md:149`): "Clinic invoice #788 created" (+ "· 2
 * offering suggestions items marked invoiced"), a copy's "Copied as #788"
 * (H:5017, + the same), "Invoice #787 saved" (+ "· offering suggestions
 * updated") — then the host's hand-off.
 */
export function useSaveToast(
  kind: 'create' | 'copy' | 'edit',
  onSaved: (result: InvoiceSaveResult) => void,
) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  return (result: InvoiceSaveResult) => {
    const { invoice } = result.detail;
    const linked = result.planLinked;
    if (kind !== 'edit') {
      const created =
        kind === 'copy'
          ? t(K.toasts.copied, { seq: invoice.seq })
          : t(K.toasts.created[invoice.type], { seq: invoice.seq });
      notify.success(
        linked > 0 ? t(K.toasts.createdPlan, { created, count: linked }) : created,
      );
    } else {
      notify.success(
        t(linked > 0 ? K.toasts.savedPlan : K.toasts.saved, { seq: invoice.seq }),
      );
    }
    onSaved(result);
  };
}
