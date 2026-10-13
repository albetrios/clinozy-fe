import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateJoin } from '@/lib/bidi-isolate.ts';
import type { Branch } from '@/shared/api/app/app-schema.ts';
import { contactQueryKeys, searchContacts } from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import { formatAppPhone, toAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits } from '@/shared/app/app-phone-field.ts';
import { personInitials } from '@/shared/components/Cells/index.ts';
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
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import type { InvoiceFormValues, InvoicePartyForm } from './invoice-form.ts';
import { NEW_CUSTOMER_ID } from './sale-form.ts';

const K = INVOICE_DRAWER_KEYS;

/**
 * The Team — a sale's "Prescribed by" — options (`payments.md:139`): clinozy-be's active members
 * by name, each on their avatar in their own tone — the team carries no roles to order by (M41).
 */
function useTeamOptions(): PickerOption[] {
  const team = useTeamDirectory();
  return team.members.map((member) => ({
    key: member.id,
    label: member.name,
    tone: member.tone,
    leading: { kind: 'avatar', initials: member.initials },
    keywords: [member.initials],
  }));
}

/** One buyer the sale's Customer field lists: a contact — a patient's, a lead's or any other. */
interface SaleCustomerRow {
  kind: InvoicePartyForm['kind'];
  /** The contact (`con_…`) — the sale's buyer; the new customer's marker until it is saved. */
  contactId: string;
  /** Their patient file, when they have one. */
  patientId: string | null;
  name: string;
  phone: string | null;
}

/**
 * A searched contact as a buyer: under Patients with a file, Leads with an open lead, else
 * Medical contacts.
 */
function customerRowOf(contact: ContactSummary): SaleCustomerRow {
  let kind: SaleCustomerRow['kind'] = 'contact';
  if (contact.patientId) kind = 'patient';
  else if (contact.openLeadId) kind = 'lead';
  return {
    kind,
    contactId: contact.id,
    patientId: contact.patientId,
    name: contact.name,
    phone: contact.primaryPhone || null,
  };
}

/** The picked buyer as the field's row — a prefilled patient's contact may still be on its way. */
function customerRowOfParty(party: InvoicePartyForm): SaleCustomerRow {
  return {
    kind: party.kind,
    contactId: party.contactId ?? party.id,
    patientId: party.kind === 'patient' ? party.id : null,
    name: party.name,
    phone: party.phone,
  };
}

/**
 * One customer as an option of the Medical field, under its group
 * (`payments.md:138`) — its mobile as the sub line, isolated.
 */
function customerOption(
  row: SaleCustomerRow,
  t: (key: string) => string,
): PickerOption<SaleCustomerRow> {
  const phone = row.phone ? formatAppPhone(row.phone) : t(K.customerSub.noMobile);
  return {
    key: row.contactId,
    label: row.name,
    sub: isolateJoin([phone]),
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
  /** An edit: the invoice keeps the patient or customer it bills, and its branch. */
  lockedParty: boolean;
  /** The patient or customer was picked: the drawer prefills the team. */
  onParty: (party: InvoicePartyForm | null) => void;
  /** The member changed the team themself: no prefill replaces it any more. */
  onTeamChange: () => void;
  /** "New patient · “q”" — the full form stacked on top (Q-P2); absent, the picker has no create. */
  onNewPatient?: (query: string) => void;
}

/**
 * The first step, "Patient & team" (`payments.md:136–139`; H:5051): Branch (two or more open
 * branches; a saved invoice keeps its own), then Patient — the shared search over clinozy-be's
 * patients (`GET /app/contacts?is_patient=true`), a pick carrying the contact the invoice bills
 * — or, for a Medical sale, Customer: clinozy-be's contacts as patients, leads and Medical
 * contacts (`GET /app/contacts?q=`), "Add contact “q”" a new customer with a Mobile field under
 * it, saved with the sale — then Team (clinozy-be's members; a sale's "Prescribed by"), multi,
 * "from Rhea’s team" once a patient is picked.
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
  const teamOptions = useTeamOptions();
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
            disabled={readOnly || lockedParty}
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
        <PatientField
          span="half"
          stretch={false}
          id={partyId}
          party={party}
          disabled={readOnly || lockedParty}
          onParty={onParty}
          onNewPatient={readOnly ? undefined : onNewPatient}
        />
      )}
      {medical && party?.kind === 'contact' && party.contactId === null ? (
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
        <Picker
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
 * An invoice's Patient: clinozy-be's patients (`GET /app/contacts?is_patient=true`) — a pick
 * carries the contact the invoice bills.
 */
function PatientField({
  id,
  party,
  disabled,
  onParty,
  onNewPatient,
}: GridWidth & {
  id: string;
  party: InvoicePartyForm | null;
  disabled: boolean;
  onParty: (party: InvoicePartyForm | null) => void;
  onNewPatient?: (query: string) => void;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  return (
    <DrawerField
      label={t(PATIENT_PICKER_KEYS.label)}
      htmlFor={id}
      required
      hint={t(PATIENT_PICKER_KEYS.hint)}
    >
      <PatientPicker
        id={id}
        value={party?.kind === 'patient' ? party.id : null}
        onChange={(patient) =>
          onParty(
            patient
              ? {
                  kind: 'patient',
                  id: patient.id,
                  contactId: patient.contactId,
                  name: patient.name,
                  phone: patient.phone,
                }
              : null,
          )
        }
        disabled={disabled}
        onCreateFull={onNewPatient}
        createFullLabel={t(K.fields.newPatient)}
        testId={INVOICE_DRAWER_TEST_IDS.patient}
      />
    </DrawerField>
  );
}

/**
 * A Medical sale's Customer (`payments.md:138`): clinozy-be's contacts — 3 letters of a name or
 * 4 digits of a number — under Patients, Leads and Medical contacts; a pick is the sale's buyer.
 * "Add contact “q”" starts a new customer: the Mobile field opens under it, and the contact is
 * saved with the sale (a contact needs its number).
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
  const organizationId = useOrganizationId();
  const picked = party ? customerRowOfParty(party) : null;
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
        loadOptionsKey={[...contactQueryKeys.all, organizationId, 'sale-customers']}
        loadOptions={async (query) => {
          const contacts = await searchContacts(query);
          return {
            rows: contacts.map((contact) => customerOption(customerRowOf(contact), t)),
            next: null,
            hasMore: false,
          };
        }}
        selectedOptions={picked ? [customerOption(picked, t)] : []}
        value={picked?.contactId ?? null}
        onChange={(_key, option) => {
          const row = option?.data;
          onParty(
            row
              ? {
                  kind: row.kind,
                  id: row.patientId ?? row.contactId,
                  contactId: row.contactId,
                  name: row.name,
                  phone: row.phone,
                }
              : null,
          );
        }}
        onCreate={(query) =>
          onParty({
            kind: 'contact',
            id: NEW_CUSTOMER_ID,
            contactId: null,
            name: query.trim(),
            phone: null,
          })
        }
        createLabel={t(K.fields.addContact)}
        disabled={disabled}
        size="md"
        minWidth={280}
        testId={INVOICE_DRAWER_TEST_IDS.customer}
      />
    </DrawerField>
  );
}

/** A new customer's mobile — "saved on the contact" when the sale saves it. */
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
  const [digits, setDigits] = useState(() =>
    party.phone ? appPhoneDigits(party.phone) : '',
  );
  const id = `${party.id}-mobile`;
  return (
    <DrawerField label={t(K.fields.mobile)} htmlFor={id} hint={t(K.fields.mobileHint)}>
      <DrawerPhoneInput
        id={id}
        value={digits}
        onChange={(next) => {
          setDigits(next);
          onParty({ ...party, phone: toAppPhone(next) });
        }}
        placeholder={t(K.fields.mobilePlaceholder)}
        readOnly={disabled}
        data-testid={INVOICE_DRAWER_TEST_IDS.mobile}
      />
    </DrawerField>
  );
}
