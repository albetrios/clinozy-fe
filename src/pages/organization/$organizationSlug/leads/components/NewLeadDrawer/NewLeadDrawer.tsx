import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import { fetchContact } from '@/shared/api/app/contacts-api.ts';
import type { ContactSummary } from '@/shared/api/app/contacts-contracts.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import {
  ContactEditor,
  contactFieldsOf,
  contactValueName,
  extraReachCount,
  primaryPhoneOf,
} from '@/shared/forms/ContactEditor/index.ts';
import { useContactSearch } from '@/shared/hooks/useContacts/index.ts';
import { useCreateLead } from '@/shared/hooks/useLeads/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import {
  LeadContactStrip,
  LeadInterestsField,
  LeadPeopleField,
  LeadSourceField,
} from '../LeadFormFields/index.ts';
import {
  hasNewLeadContact,
  type NewLeadForm,
  newLeadForm,
  newLeadInputOf,
  type NewLeadPrefill,
  type NewLeadPreset,
  presetPressed,
  withoutContact,
  withPickedContact,
} from './new-lead-form.ts';
import { NewLeadContactStep } from './NewLeadContactStep.tsx';

const K = LEADS_KEYS.newLead;

/** Props of {@link NewLeadDrawer}. */
export interface NewLeadDrawerProps {
  /** `?name=&phone=` — ⌘K's "New lead", the contact card's "+ Lead". */
  prefill: NewLeadPrefill;
  /** The active members (`useTeamDirectory`). */
  members: readonly DirectoryMember[];
  /** The signed-in member's membership — the owner until someone else is assigned. */
  viewerId: string | null;
  /** Cancel, ×, the backdrop, Esc — nothing asks first (`leads.md:90`, Q-P1). */
  onClose: () => void;
  /** Created: the drawer closes over the list, which picks the new lead out (D28). */
  onCreated: (lead: LeadRecord) => void;
  /** "Open lead": the person's open lead (a hit's, or a 409's). */
  onOpenLead: (leadId: string) => void;
}

/**
 * The contact card for the form's person: the one picked — a patient's card once they have a
 * file — or the one typed, a lead's.
 */
function contactCardOf(form: NewLeadForm): ContactCardData {
  const { picked } = form;
  if (picked) {
    return {
      kind: picked.patientId ? 'patient' : 'lead',
      name: picked.name,
      displayId: displayId.contact(picked.contactNumber),
      reach: [
        { channel: 'phone', phone: picked.primaryPhone },
        ...picked.instagramHandles.map((handle) => ({
          channel: 'instagram' as const,
          handle,
        })),
      ],
    };
  }
  const fields = contactFieldsOf(form.contact);
  return {
    kind: 'lead',
    name: contactValueName(form.contact),
    reach: [
      ...fields.phones.map((entry) => ({
        channel: entry.isOnWhatsapp ? ('whatsapp' as const) : ('phone' as const),
        phone: entry.phone,
      })),
      ...fields.instagramHandles.map((handle) => ({
        channel: 'instagram' as const,
        handle,
      })),
    ],
  };
}

/**
 * The open lead a picked person has now — the 409 names it only in its words, and a lead opened
 * since the search is not on the hit; `null` when the read fails.
 */
async function openLeadOf(contactId: string): Promise<string | null> {
  try {
    return (await fetchContact(contactId)).openLeadId;
  } catch {
    return null;
  }
}

/** The form's write: "Saving…", then the new lead or the failure's toast. */
function useCreate(
  onCreated: NewLeadDrawerProps['onCreated'],
  onOpenLead: (id: string) => void,
) {
  const { t } = useTranslation(LEADS_NS);
  const create = useCreateLead({ notifyOnError: false });
  const [failed, setFailed] = useState(false);
  const save = async (form: NewLeadForm) => {
    const input = newLeadInputOf(form);
    if (!input) {
      notify.warning(t(K.toasts.missing));
      return;
    }
    setFailed(false);
    try {
      onCreated(await create.mutateAsync(input));
    } catch (error) {
      setFailed(true);
      // The server's words name the clash: the person's open lead (`lead_open_exists`, L6) or
      // the contact a new number belongs to (`contact_phone_exists`, CT3).
      const message = mapApiError(error);
      const openLeadId =
        apiErrorReason(error) === 'lead_open_exists' && form.picked
          ? await openLeadOf(form.picked.id)
          : null;
      if (openLeadId) {
        notify.error(message, {
          action: { label: t(K.toasts.open), onClick: () => onOpenLead(openLeadId) },
        });
        return;
      }
      notify.error(message);
    }
  };
  let saveState: DrawerSaveState = 'idle';
  if (create.isPending) saveState = 'saving';
  else if (failed) saveState = 'failed';
  return { save, saveState };
}

/** What the form's parts change: the form, through its setter. */
type FormSetter = (next: (current: NewLeadForm) => NewLeadForm) => void;

/**
 * Lead details (`leads.md:82–84`): Source, Interested in, and Assigned &
 * involved — the owner never also involved; anyone can be assigned here.
 */
function NewLeadDetails({
  form,
  ownerId,
  members,
  setForm,
}: {
  form: NewLeadForm;
  ownerId: string | null;
  members: readonly DirectoryMember[];
  setForm: FormSetter;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-3.5">
      <div className="col-span-full">
        <LeadSourceField
          value={form.source}
          onChange={(source) => setForm((current) => ({ ...current, source }))}
        />
      </div>
      <div className="col-span-full">
        <LeadInterestsField
          value={form.interests}
          onChange={(interests) => setForm((current) => ({ ...current, interests }))}
        />
      </div>
      <LeadPeopleField
        ownerId={ownerId}
        involvedIds={form.involvedIds}
        members={members}
        onAssign={(member) =>
          setForm((current) => ({
            ...current,
            ownerId: member.id,
            involvedIds: current.involvedIds.filter((id) => id !== member.id),
          }))
        }
        onToggleInvolved={(member, involved) =>
          setForm((current) => ({
            ...current,
            involvedIds: involved
              ? [...current.involvedIds, member.id]
              : current.involvedIds.filter((id) => id !== member.id),
          }))
        }
      />
    </div>
  );
}

/**
 * The person's strip in place of the Contact step (`leads.md:252–256`), with "Change". A new
 * person is edited here; a picked one in the lead drawer, once the lead is theirs.
 */
function NewLeadPerson({
  form,
  onEdit,
  onChange,
}: {
  form: NewLeadForm;
  onEdit: () => void;
  onChange: () => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { picked } = form;
  const extra = picked ? picked.instagramHandles.length : extraReachCount(form.contact);
  const typedPhone =
    primaryPhoneOf(form.contact) ?? form.contact.phones[0]?.digits ?? null;
  return (
    <LeadContactStrip
      card={contactCardOf(form)}
      name={picked ? picked.name : contactValueName(form.contact)}
      phone={picked ? picked.primaryPhone : typedPhone}
      more={extra > 0 ? t(K.more, { count: extra }) : undefined}
      onEditContact={picked ? undefined : onEdit}
      onChangeContact={onChange}
      aside={
        <Button
          type="button"
          variant="outline"
          size="xs"
          title={t(K.changeTitle)}
          onClick={onChange}
          data-testid={LEADS_TEST_IDS.newLeadChange}
          className="bg-card text-foreground-soft hover:bg-muted text-xs shadow-none"
        >
          {t(K.change)}
        </Button>
      }
    />
  );
}

/**
 * New lead (KICKOFF §6.3; `leads.md:75–90, 138–150, 246–262`, H:1883–1961) on
 * the shared record drawer, 640px, "New lead" over "Name and mobile are enough
 * to start". Without a contact: step 1 Contact — the search, Quick start and
 * "New contact" — and step 2 Lead details, locked ("After contact"; a tap toasts
 * "Pick or add the contact first"). With one — picked, typed in the contact
 * editor, or prefilled — the person's strip with "Change", and Lead details
 * as step 1: Source, Interested in, Assigned & involved (the signed-in member
 * first; anyone can be assigned). "Create lead" checks for a name and a
 * 10-digit mobile, then creates — for the person picked (`contact_id`), or with
 * the new one (`contact`); the server's 409 names the clash — the person's open
 * lead, with "Open", or the contact a new number belongs to. Every exit closes at
 * once.
 */
export function NewLeadDrawer({
  prefill,
  members,
  viewerId,
  onClose,
  onCreated,
  onOpenLead,
}: NewLeadDrawerProps) {
  const { t } = useTranslation(LEADS_NS);
  const [form, setForm] = useState(() => newLeadForm(prefill, viewerId));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const search = useContactSearch(query);
  const { save, saveState } = useCreate(onCreated, onOpenLead);
  const contactSet = hasNewLeadContact(form);
  // The membership may load after the drawer opens: until someone is assigned, it is them.
  const ownerId = form.ownerId ?? viewerId;

  const pick = (hit: ContactSummary) => {
    setForm((current) => withPickedContact(current, hit));
    setQuery('');
    notify.success(
      hit.patientId
        ? t(K.toasts.existingPatient, { id: displayId.contact(hit.contactNumber) })
        : t(K.toasts.existingContact, { name: hit.name }),
    );
  };
  const details: DrawerStep = {
    id: 'details',
    title: t(LEADS_KEYS.drawer.cards.details),
    content: (
      <NewLeadDetails form={form} ownerId={ownerId} members={members} setForm={setForm} />
    ),
  };
  const contact: DrawerStep = {
    id: 'contact',
    title: t(K.contact),
    content: (
      <NewLeadContactStep
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        hits={search.hits}
        noMatch={search.noMatch}
        pressed={(preset) => presetPressed(form, preset)}
        onPreset={(preset: NewLeadPreset) => {
          setForm((current) => ({ ...current, source: preset.source }));
          notify.success(t(K.toasts.presetApplied, { preset: t(K.presets[preset.id]) }));
        }}
        onPick={pick}
        onOpenLead={onOpenLead}
        onNewContact={() => setEditing(true)}
      />
    ),
  };
  const locked: DrawerStep = {
    ...details,
    summary: t(K.detailsSummary),
    locked: {
      hint: t(K.afterContact),
      onAttempt: () => notify.info(t(K.toasts.pickFirst)),
    },
  };

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(K.title)}
        sub={t(K.sub)}
        largeTitle
        width={640}
        tone="stone"
        steps={contactSet ? [details] : [contact, locked]}
        openStep={contactSet ? 'details' : 'contact'}
        // The open step stays open: a tap on its head changes nothing (H:4135).
        onOpenStepChange={() => {}}
        stepsCollapsible={false}
        initialFocusRef={searchRef}
        summary={t(K.footer)}
        saveLabel={t(K.create)}
        onSave={() => void save({ ...form, ownerId })}
        saveState={saveState}
        testId={LEADS_TEST_IDS.newLead}
      >
        {contactSet ? (
          <NewLeadPerson
            form={form}
            onEdit={() => setEditing(true)}
            onChange={() => setForm((current) => withoutContact(current))}
          />
        ) : null}
      </RecordDrawer>
      <ContactEditor
        open={editing}
        value={form.contact}
        onDone={(value) => {
          setForm((current) => ({ ...current, contact: value }));
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    </>
  );
}
