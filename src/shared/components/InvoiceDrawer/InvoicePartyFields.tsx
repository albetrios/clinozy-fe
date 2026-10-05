import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Branch, Role } from '@/shared/api/clinic/clinic-schema.ts';
import {
  invoiceQueryKeys,
  searchSaleCustomers,
} from '@/shared/api/clinic/invoices-api.ts';
import type { SaleCustomerRow } from '@/shared/api/clinic/invoices-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone, toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { clinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import { personFullName, personInitials } from '@/shared/components/Cells/index.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  type DrawerFieldProps,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import {
  PATIENT_PICKER_KEYS,
  PatientPicker,
} from '@/shared/components/PatientPicker/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import {
  useAddMedicalContact,
  useSetMedicalContactPhone,
} from '@/shared/hooks/useInvoices/index.ts';
import { useStaffProfiles } from '@/shared/hooks/useTeam/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import type { InvoiceFormValues, InvoicePartyForm } from './invoice-form.ts';

const K = INVOICE_DRAWER_KEYS;

/** The roles the Team field lists first, in this order (H:5051: doctors, then the rest). */
const TEAM_ROLE_ORDER: readonly Role[] = ['doctor', 'therapist', 'counsellor'];

/** Where a member sorts in the Team list: by their first listed role. */
const teamRank = (person: StaffProfile) => {
  const ranks = person.roles
    .map((role) => TEAM_ROLE_ORDER.indexOf(role))
    .filter((rank) => rank >= 0);
  return ranks.length > 0 ? Math.min(...ranks) : TEAM_ROLE_ORDER.length;
};

/**
 * The Team (Medical: "Prescribed by") options (`payments.md:139`): the active
 * team, doctors first, then therapists, counsellors and the rest — and anyone
 * already picked who has since left — each on their avatar with their role.
 */
function useTeamOptions(picked: readonly string[]): PickerOption<StaffProfile>[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const staff = useStaffProfiles();
  return (staff.data ?? [])
    .filter((person) => person.active || picked.includes(person.id))
    .sort(
      (a, b) =>
        teamRank(a) - teamRank(b) || personFullName(a).localeCompare(personFullName(b)),
    )
    .map((person) => ({
      key: person.id,
      label: personFullName(person),
      sub: person.roles[0] ? t(CLINIC_KEYS.roles[person.roles[0]]) : undefined,
      tone: person.tone,
      leading: { kind: 'avatar', initials: person.initials },
      keywords: [person.initials],
      data: person,
    }));
}

/**
 * One customer as an option of the Medical field, under its group
 * (`payments.md:138`) — its "#3508 · +91 …" sub isolated part by part.
 */
function customerOption(
  row: SaleCustomerRow,
  t: (key: string) => string,
): PickerOption<SaleCustomerRow> {
  const phone = row.phone ? formatClinicPhone(row.phone) : t(K.customerSub.noMobile);
  let sub = isolateJoin([phone]);
  if (row.kind === 'patient') sub = isolateJoin([displayId.patient(row.seq), phone]);
  else if (row.kind === 'lead') sub = isolateJoin([displayId.lead(row.seq), phone]);
  return {
    key: row.id,
    label: row.name,
    sub,
    group: t(K.customerGroups[row.kind]),
    leading: {
      kind: 'avatar',
      initials: personInitials(row.name),
      patient: row.kind === 'patient',
    },
    data: row,
  };
}

/** Props of {@link InvoicePartyFields}. */
export interface InvoicePartyFieldsProps {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  idPrefix: string;
  branches: readonly Pick<Branch, 'id' | 'name' | 'tone'>[];
  readOnly: boolean;
  /** An edit: the invoice keeps the patient or customer it bills. */
  lockedParty: boolean;
  /** The patient or customer was picked: the drawer prefills the team. */
  onParty: (party: InvoicePartyForm | null) => void;
  /** The member changed the team themself: no prefill replaces it any more. */
  onTeamChange: () => void;
  /** "New patient · “q”" — the full form stacked on top (Q-P2). */
  onNewPatient: (query: string) => void;
}

/**
 * The first step, "Patient & team" (`payments.md:136–139`; H:5051): Branch
 * (two or more open branches), then Patient — the shared remote search, leads
 * shown but never taken, "New patient · “q”" stacking the full form — or, for
 * Medical, Customer: patients, leads and Medical contacts, "Add contact “q”"
 * saving one at once with a Mobile field under it — then Team ("Prescribed by"),
 * multi, "from Rhea’s team" once a patient is picked.
 */
export function InvoicePartyFields({
  form,
  values,
  idPrefix,
  branches,
  readOnly,
  lockedParty,
  onParty,
  onTeamChange,
  onNewPatient,
}: InvoicePartyFieldsProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const medical = values.type === 'medical';
  const party = values.party;
  const teamOptions = useTeamOptions(values.teamIds);
  const partyId = `${idPrefix}-party`;
  const teamId = `${idPrefix}-team`;
  const firstName = party?.name.split(' ')[0];

  return (
    <DrawerFieldGrid>
      {branches.length > 1 ? (
        <DrawerField span="half" label={t(K.fields.branch)}>
          <DrawerChips
            label={t(K.fields.branch)}
            options={branches.map((branch) => ({
              value: branch.id,
              label: branch.name,
              tone: branch.tone,
            }))}
            value={values.branchId}
            onChange={(branchId) => {
              if (branchId) form.setValue('branchId', branchId, { shouldDirty: true });
            }}
            disabled={readOnly}
            testId={INVOICE_DRAWER_TEST_IDS.branch}
          />
        </DrawerField>
      ) : null}
      {medical ? (
        <CustomerField
          span="half"
          stretch={false}
          id={partyId}
          party={party}
          disabled={readOnly || lockedParty}
          onParty={onParty}
        />
      ) : (
        <DrawerField
          span="half"
          stretch={false}
          label={t(PATIENT_PICKER_KEYS.label)}
          htmlFor={partyId}
          required
          hint={t(PATIENT_PICKER_KEYS.hint)}
        >
          <PatientPicker
            id={partyId}
            value={party?.kind === 'patient' ? party.id : null}
            onChange={(patient) =>
              onParty(
                patient
                  ? {
                      kind: 'patient',
                      id: patient.id,
                      name: patient.name,
                      phone: patient.phone,
                    }
                  : null,
              )
            }
            disabled={readOnly || lockedParty}
            onCreateFull={readOnly ? undefined : onNewPatient}
            createFullLabel={t(K.fields.newPatient)}
            testId={INVOICE_DRAWER_TEST_IDS.patient}
          />
        </DrawerField>
      )}
      {medical && party?.kind === 'contact' ? (
        <ContactMobileField
          span="third"
          key={party.id}
          party={party}
          disabled={readOnly}
          onParty={onParty}
        />
      ) : null}
      <DrawerField
        span="half"
        label={t(medical ? K.fields.prescribedBy : K.fields.team)}
        htmlFor={teamId}
        hint={
          firstName ? t(K.fields.teamFrom, { name: firstName }) : t(K.fields.teamHint)
        }
      >
        <Picker<StaffProfile>
          id={teamId}
          multiple
          label={t(medical ? K.fields.prescribedBy : K.fields.team)}
          placeholder={t(K.fields.teamPlaceholder)}
          options={teamOptions}
          value={values.teamIds}
          onChange={(teamIds) => {
            onTeamChange();
            form.setValue('teamIds', teamIds, { shouldDirty: true });
          }}
          disabled={readOnly}
          size="md"
          testId={INVOICE_DRAWER_TEST_IDS.team}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * A field component's width in the drawer grid — read by `DrawerFieldGrid`
 * off the element it holds, so it rides on the component, not inside it.
 */
type GridWidth = Pick<DrawerFieldProps, 'span' | 'stretch'>;

/**
 * A Medical sale's Customer (`payments.md:138`): patients, leads and Medical
 * contacts in their groups; "Add contact “q”" saves a Medical contact at once
 * ("Viral Sheth saved as a Medical contact · add a mobile below").
 */
function CustomerField({
  id,
  party,
  disabled,
  onParty,
}: GridWidth & {
  id: string;
  party: InvoicePartyForm | null;
  disabled: boolean;
  onParty: (party: InvoicePartyForm | null) => void;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const addContact = useAddMedicalContact({ notifyOnError: true });
  const selected: PickerOption<SaleCustomerRow>[] = party
    ? [
        customerOption(
          party.kind === 'contact'
            ? { kind: 'contact', id: party.id, name: party.name, phone: party.phone }
            : {
                kind: party.kind,
                id: party.id,
                seq: 0,
                name: party.name,
                phone: party.phone,
              },
          t,
        ),
      ]
    : [];
  return (
    <DrawerField
      label={t(K.fields.customer)}
      htmlFor={id}
      required
      hint={t(K.fields.customerHint)}
    >
      <Picker<SaleCustomerRow>
        id={id}
        label={t(K.fields.customer)}
        placeholder={t(K.fields.customerPlaceholder)}
        searchPlaceholder={t(K.fields.customerPlaceholder)}
        loadOptionsKey={invoiceQueryKeys.customers()}
        loadOptions={async (query, cursor) => {
          const page = await searchSaleCustomers(query, cursor ?? null);
          return {
            rows: page.items.map((row) => customerOption(row, t)),
            next: page.nextCursor,
            hasMore: page.nextCursor !== null,
          };
        }}
        selectedOptions={selected}
        value={party?.id ?? null}
        onChange={(_key, option) => {
          const row = option?.data;
          onParty(
            row ? { kind: row.kind, id: row.id, name: row.name, phone: row.phone } : null,
          );
        }}
        onCreate={async (query) => {
          const contact = await addContact.mutateAsync(query.trim());
          onParty({ kind: 'contact', id: contact.id, name: contact.name, phone: null });
          notify.success(t(K.toasts.contactSaved, { name: contact.name }));
        }}
        createLabel={t(K.fields.addContact)}
        disabled={disabled}
        size="md"
        minWidth={280}
        testId={INVOICE_DRAWER_TEST_IDS.customer}
      />
    </DrawerField>
  );
}

/** A Medical contact's mobile, "saved on the contact" when it leaves the field as ten digits. */
function ContactMobileField({
  party,
  disabled,
  onParty,
}: GridWidth & {
  party: InvoicePartyForm;
  disabled: boolean;
  onParty: (party: InvoicePartyForm) => void;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const save = useSetMedicalContactPhone({ notifyOnError: true });
  const [digits, setDigits] = useState(() =>
    party.phone ? clinicPhoneDigits(party.phone) : '',
  );
  const id = `${party.id}-mobile`;
  return (
    <DrawerField label={t(K.fields.mobile)} htmlFor={id} hint={t(K.fields.mobileHint)}>
      <DrawerPhoneInput
        id={id}
        value={digits}
        onChange={setDigits}
        placeholder={t(K.fields.mobilePlaceholder)}
        readOnly={disabled}
        data-testid={INVOICE_DRAWER_TEST_IDS.mobile}
        onBlur={() => {
          const phone = toClinicPhone(digits);
          if (!phone || phone === party.phone) return;
          void save
            .mutateAsync({ id: party.id, phone })
            .then(() => onParty({ ...party, phone }));
        }}
      />
    </DrawerField>
  );
}
