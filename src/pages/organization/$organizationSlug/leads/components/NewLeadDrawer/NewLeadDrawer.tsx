import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { findOpenLeadByPhone } from '@/shared/api/clinic/leads-api.ts';
import type { LeadContactHit, LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import type { ContactCardData } from '@/shared/components/PersonCard/index.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import type { ContactEditorRecord } from '@/shared/forms/ContactEditor/index.ts';
import {
  ContactEditor,
  contactFieldsOf,
  extraReachCount,
  primaryPhoneOf,
} from '@/shared/forms/ContactEditor/index.ts';
import { useCreateLead, useLeadContactSearch } from '@/shared/hooks/useLeads/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { leadReach } from '../LeadFields/lead-contact.ts';
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
  withoutOrigin,
  withPickedContact,
} from './new-lead-form.ts';
import { NewLeadContactStep } from './NewLeadContactStep.tsx';

const K = LEADS_KEYS.newLead;

/** Props of {@link NewLeadDrawer}. */
export interface NewLeadDrawerProps {
  /** `?name=&phone=` — ⌘K's "New lead", the contact card's "+ Lead". */
  prefill: NewLeadPrefill;
  staff: readonly StaffProfile[];
  /** The signed-in member — the owner until someone else is assigned. */
  viewer: StaffProfile | null;
  /** Cancel, ×, the backdrop, Esc — nothing asks first (`leads.md:90`, Q-P1). */
  onClose: () => void;
  /** Created: the drawer closes over the list, which picks the new lead out (D28). */
  onCreated: (lead: LeadRecord) => void;
  /** A 409's "Open": the lead already on this mobile. */
  onOpenLead: (leadId: string) => void;
}

/** The record the form's person came from, as the card and the editor name it ("#3508"). */
function originRecordOf(form: NewLeadForm): ContactEditorRecord | null {
  const { origin } = form;
  if (!origin) return null;
  return origin.kind === 'patient'
    ? { kind: 'patient', displayId: displayId.patient(origin.seq) }
    : { kind: 'lead', displayId: displayId.lead(origin.seq) };
}

/** The contact card for the form's person — a patient's once one was picked, else a lead's. */
function contactCardOf(form: NewLeadForm): ContactCardData {
  const record = originRecordOf(form);
  return {
    kind: record?.kind === 'patient' ? 'patient' : 'lead',
    name: form.contact.name.trim(),
    displayId: record?.displayId ?? null,
    reach: leadReach({
      phone: primaryPhoneOf(form.contact) ?? '',
      contact: contactFieldsOf(form.contact).contact,
    }),
  };
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
      const existing =
        isHttpError(error) && error.status === 409
          ? await findOpenLeadByPhone(input.phone)
          : null;
      if (!existing) {
        notify.error(mapApiError(error));
        return;
      }
      // The mobile is already on an open lead (`S:1593`): "Open" goes to it (Q-P7).
      notify.error(t(K.toasts.duplicate, { id: displayId.lead(existing.seq) }), {
        action: { label: t(K.toasts.open), onClick: () => onOpenLead(existing.id) },
      });
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
  staff,
  viewer,
  setForm,
}: {
  form: NewLeadForm;
  ownerId: string | null;
  staff: readonly StaffProfile[];
  viewer: StaffProfile | null;
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
          value={{ interests: form.interests, customInterests: form.customInterests }}
          onChange={(next) =>
            setForm((current) => ({
              ...current,
              interests: [...next.interests],
              customInterests: [...next.customInterests],
            }))
          }
        />
      </div>
      <LeadPeopleField
        ownerId={ownerId}
        involvedIds={form.involvedIds}
        staff={staff}
        viewer={viewer}
        anyoneAssignable
        onAssign={(person) =>
          setForm((current) => ({
            ...current,
            ownerId: person.id,
            involvedIds: current.involvedIds.filter((id) => id !== person.id),
          }))
        }
        onToggleInvolved={(person, involved) =>
          setForm((current) => ({
            ...current,
            involvedIds: involved
              ? [...current.involvedIds, person.id]
              : current.involvedIds.filter((id) => id !== person.id),
          }))
        }
      />
    </div>
  );
}

/** The person's strip in place of the Contact step (`leads.md:252–256`), with "Change". */
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
  const extra = extraReachCount(form.contact);
  return (
    <LeadContactStrip
      card={contactCardOf(form)}
      name={form.contact.name.trim()}
      phone={primaryPhoneOf(form.contact) ?? form.contact.phones[0]?.digits ?? null}
      more={extra > 0 ? t(K.more, { count: extra }) : undefined}
      onEditContact={onEdit}
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
 * 10-digit mobile, then creates; a mobile already on an open lead toasts with
 * "Open". Every exit closes at once.
 */
export function NewLeadDrawer({
  prefill,
  staff,
  viewer,
  onClose,
  onCreated,
  onOpenLead,
}: NewLeadDrawerProps) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tCard } = useTranslation(PERSON_CARD_NS);
  const [form, setForm] = useState(() => newLeadForm(prefill, viewer?.id ?? null));
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const search = useLeadContactSearch(query);
  const { save, saveState } = useCreate(onCreated, onOpenLead);
  const contactSet = hasNewLeadContact(form);
  // The member may load after the drawer opens: until someone is assigned, it is them.
  const ownerId = form.ownerId ?? viewer?.id ?? null;
  const record = originRecordOf(form);

  const pick = (hit: LeadContactHit) => {
    setForm((current) => withPickedContact(current, hit));
    setQuery('');
    notify.success(
      hit.kind === 'patient'
        ? t(K.toasts.existingPatient, { id: displayId.patient(hit.seq) })
        : t(K.toasts.existingContact, { name: hit.name }),
    );
  };
  const details: DrawerStep = {
    id: 'details',
    title: t(LEADS_KEYS.drawer.cards.details),
    content: (
      <NewLeadDetails
        form={form}
        ownerId={ownerId}
        staff={staff}
        viewer={viewer}
        setForm={setForm}
      />
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
          setForm((current) => ({
            ...current,
            source: preset.source,
            status: preset.status,
          }));
          notify.success(t(K.toasts.presetApplied, { preset: t(K.presets[preset.id]) }));
        }}
        onPick={pick}
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
        record={record}
        linked={
          record
            ? {
                text: t(K.linked, {
                  name: isolateText(form.contact.name.trim()),
                  kind: `${tCard(PERSON_CARD_KEYS.kind[record.kind])} ${isolateText(record.displayId)}`,
                }),
                onUndo: () => setForm((current) => withoutOrigin(current)),
              }
            : undefined
        }
        onDone={(value) => {
          setForm((current) => ({ ...current, contact: value }));
          setEditing(false);
        }}
        onClose={() => setEditing(false)}
      />
    </>
  );
}
