import { type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentStatus, Tone } from '@/shared/api/app/app-schema.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { appPhoneDigits, appPhoneProblem } from '@/shared/app/app-phone-field.ts';
import { LEAD_STATUS_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { appointmentContactCard } from '@/shared/app/appointment-display.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import { ContactQuickPick } from '@/shared/components/ContactQuickPick/index.ts';
import {
  DrawerField,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { ContactCard } from '@/shared/components/PersonCard/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useLead } from '@/shared/hooks/useLeads/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import {
  APPOINTMENT_FORM_LIMITS,
  type AppointmentDraft,
  type AppointmentFormChange,
  movesAtCheckIn,
  type WhoDraft,
  whoOfContact,
} from './appointment-form-model.ts';

const K = APPOINTMENT_FORM_KEYS.who;
const L = APPOINTMENT_FORM_KEYS.links;
const IDS = APPOINTMENT_FORM_TEST_IDS;

/** The search shows at most five people (`appointments.md:61`). */
const HIT_LIMIT = 5;

/** The who card's avatar (H:5984): a patient sage, a lead lav, anyone else butter. */
const WHO_TONES: Readonly<Record<WhoDraft['kind'], Tone>> = {
  patient: 'sage',
  lead: 'lav',
  contact: 'butter',
  new: 'butter',
};

/** What the inline editor saves: the person's name and mobile digits. */
export interface WhoEdit {
  name: string;
  /** Ten digits, or empty to keep none. */
  phone: string;
}

/** Props for {@link WhoSection}. */
export interface WhoSectionProps {
  draft: AppointmentDraft;
  onChange: (change: AppointmentFormChange) => void;
  /** "Change" clears the person (New only). */
  canChange: boolean;
  disabled: boolean;
  /** "Connected lead" chip — the lead drawer, closing the form (H:4139). */
  onOpenLead: (leadId: string) => void;
  /** The inline editor's Save — the person's contact; resolves when saved. */
  onSaveContact: (who: WhoDraft, edit: WhoEdit) => Promise<void>;
}

/**
 * The person search (H:2749–2753; `GET /app/contacts?q=`) on the shared contact picker
 * (change-contact-quick-pick): Recent before typing, then from 3 letters or 4 digits, five
 * hits — a patient says so, anyone else shows their number — the typed words marked, ↑ ↓ ↵;
 * the add row's quick add takes the new person's name and mobile together.
 */
function WhoSearch({
  onChange,
  disabled,
}: {
  onChange: (change: AppointmentFormChange) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  return (
    <ContactQuickPick
      searchPlaceholder={t(K.search)}
      searchLabel={t(K.searchLabel)}
      limit={HIT_LIMIT}
      disabled={disabled}
      // A new person here is a name and a mobile; a typed handle is left out (D6).
      takesInstagram={false}
      describe={(contact) => {
        const who = whoOfContact(contact);
        return {
          line: contact.patientId ? t(K.patient) : formatAppPhone(contact.primaryPhone),
          tone: WHO_TONES[who.kind],
        };
      }}
      onPick={(contact) => onChange({ kind: 'who', who: whoOfContact(contact) })}
      onQuickAdd={({ name, phone }) => {
        // A who change clears the new mobile, so the mobile follows it.
        onChange({
          kind: 'who',
          who: {
            kind: 'new',
            contactId: null,
            name: name.slice(0, APPOINTMENT_FORM_LIMITS.name),
            phone: null,
            patientId: null,
            leadId: null,
            contactNumber: null,
          },
        });
        if (phone) onChange({ kind: 'newPhone', digits: phone });
      }}
      testId={IDS.who}
      testIds={{
        search: IDS.whoSearch,
        hit: () => IDS.whoHit,
        add: IDS.whoCreate,
        noMatch: IDS.whoNoMatch,
      }}
    />
  );
}

/** The inline Name · Mobile editor (H:2748, "Edit" on the contact card). */
function WhoEditor({
  who,
  onCancel,
  onSave,
}: {
  who: WhoDraft;
  onCancel: () => void;
  onSave: (edit: WhoEdit) => Promise<void>;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const id = useId();
  const [name, setName] = useState(who.name);
  const [phone, setPhone] = useState(who.phone ? appPhoneDigits(who.phone) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) {
      notify.warning(t(K.addName));
      return;
    }
    const problem = phone ? appPhoneProblem(phone) : null;
    if (problem) {
      notify.warning(t(problem === 'start' ? K.mobileStart : K.mobileDigits));
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), phone });
    } finally {
      setSaving(false);
    }
  };
  // Esc in a field closes the editor, not the drawer.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    onCancel();
  };
  return (
    <div
      data-testid={IDS.whoEdit}
      className="grid grid-cols-[minmax(0,1fr)_minmax(150px,190px)_auto] items-end gap-2 @max-[480px]:grid-cols-1"
    >
      <DrawerField label={t(K.name)} htmlFor={`${id}-name`}>
        <DrawerInput
          id={`${id}-name`}
          value={name}
          maxLength={APPOINTMENT_FORM_LIMITS.name}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          data-testid={IDS.whoEditName}
        />
      </DrawerField>
      <DrawerField label={t(K.mobileLabel)} htmlFor={`${id}-mobile`}>
        <DrawerPhoneInput
          id={`${id}-mobile`}
          value={phone}
          onChange={setPhone}
          onKeyDown={onKeyDown}
          aria-invalid={appPhoneProblem(phone) === 'start' || undefined}
          data-testid={IDS.whoEditMobile}
        />
      </DrawerField>
      <Button
        type="button"
        disabled={saving}
        data-testid={IDS.whoEditSave}
        onClick={() => void save()}
      >
        {t(K.save)}
      </Button>
    </div>
  );
}

/**
 * "Connected lead" (H:2754, H:4139): the person's open lead (`lead_id`, A1) as its chip —
 * "#2371 · Contacted", its source and owner on hover — and the moves-at-check-in note. The
 * server links the one open lead, so there are no "Lead" radios to pick from.
 */
function ConnectedLead({
  leadId,
  status,
  onOpenLead,
}: {
  leadId: string;
  status: AppointmentStatus;
  onOpenLead: (leadId: string) => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, APP_NS]);
  const lead = useLead(leadId).data;
  const team = useTeamDirectory();
  if (!lead) return null;
  const id = `#${lead.leadNumber}`;
  const tone: Tone = LEAD_STATUS_TONES[lead.status];
  const source = lead.source
    ? t(APP_KEYS.leads.sources[lead.source], { ns: APP_NS })
    : '—';
  const owner = (lead.ownerId && team.byId.get(lead.ownerId)?.name) || '—';
  return (
    <div className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span>{t(L.connected)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-slot="pill"
            data-testid={IDS.connectedLead}
            onClick={() => onOpenLead(lead.id)}
            className={cn(
              'text-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold whitespace-nowrap',
              TONE_CLASSES[tone].surface,
            )}
          >
            <span
              aria-hidden="true"
              data-slot="pill"
              className="size-1.5 rounded-full bg-current"
            />
            {t(L.chip, {
              id,
              status: t(APP_KEYS.leads.statuses[lead.status], { ns: APP_NS }),
            })}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t(L.chipHint, { id, source, owner })}</TooltipContent>
      </Tooltip>
      {movesAtCheckIn(leadId, status) ? <span>{t(L.movesAtCheckIn)}</span> : null}
    </div>
  );
}

/** The person's line under their name: a new contact's note, else the mobile. */
function whoSubline(who: WhoDraft, newContact: string): string {
  if (who.kind === 'new') return newContact;
  return who.phone ? formatAppPhone(who.phone) : '';
}

/**
 * The who card's avatar, name and line (H:2748): the name in its own
 * direction, the mobile left to right — whole on a right-to-left page.
 */
function WhoIdentity({ who }: { who: WhoDraft }) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <PersonAvatar
        size="field"
        initials={personInitials(who.name)}
        tone={WHO_TONES[who.kind]}
        patient={who.kind === 'patient'}
      />
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <span
          dir="auto"
          className="truncate [text-align:match-parent] text-sm font-semibold"
        >
          {who.name}
        </span>
        <span
          dir={who.kind === 'new' ? undefined : 'ltr'}
          className="text-muted-foreground-strong truncate [text-align:match-parent] text-xs tabular-nums"
        >
          {whoSubline(who, t(K.newContact))}
        </span>
      </span>
    </span>
  );
}

/**
 * Who the booking is for (H:2748–2755; `appointments.md:61–65`): the person
 * search, or the person's card — hover for the contact card with "Change" and
 * "Edit", the inline Name · Mobile editor, a new contact's "+91" mobile — then
 * their open lead.
 */
export function WhoSection({
  draft,
  onChange,
  canChange,
  disabled,
  onOpenLead,
  onSaveContact,
}: WhoSectionProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const [editing, setEditing] = useState(false);
  const who = draft.who;
  if (!who) {
    return (
      <div className="flex flex-none flex-col gap-2">
        <WhoSearch disabled={disabled} onChange={onChange} />
      </div>
    );
  }
  const card = appointmentContactCard({
    kind: who.kind === 'new' ? 'contact' : who.kind,
    contactId: who.contactId ?? '',
    name: who.name,
    phone: who.phone,
    patientId: who.patientId,
    leadId: who.leadId,
    contactNumber: who.contactNumber,
  });
  const identity = <WhoIdentity who={who} />;
  return (
    <>
      <div className="flex flex-none flex-col gap-2">
        <div
          data-testid={IDS.whoCard}
          className="bg-canvas flex flex-col gap-2.5 rounded-xl border px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5">
            {who.kind === 'new' || disabled ? (
              identity
            ) : (
              <ContactCard
                data={card}
                triggerVariant="chip"
                triggerClassName="min-w-0 rounded-lg"
                onChangeContact={
                  canChange ? () => onChange({ kind: 'who', who: null }) : undefined
                }
                onEditContact={() => setEditing(true)}
              >
                {identity}
              </ContactCard>
            )}
          </div>
          {editing ? (
            <WhoEditor
              who={who}
              onCancel={() => setEditing(false)}
              onSave={async (edit) => {
                await onSaveContact(who, edit);
                setEditing(false);
              }}
            />
          ) : null}
          {who.kind === 'new' ? (
            <DrawerPhoneInput
              value={draft.newPhone}
              onChange={(digits) => onChange({ kind: 'newPhone', digits })}
              placeholder={t(K.mobile)}
              aria-label={t(K.mobile)}
              aria-invalid={appPhoneProblem(draft.newPhone) === 'start' || undefined}
              disabled={disabled}
              data-testid={IDS.whoMobile}
            />
          ) : null}
        </div>
      </div>
      {who.leadId ? (
        <ConnectedLead
          leadId={who.leadId}
          status={draft.status}
          onOpenLead={onOpenLead}
        />
      ) : null}
    </>
  );
}
