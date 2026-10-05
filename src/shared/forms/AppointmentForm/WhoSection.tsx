import { type KeyboardEvent, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateJoin, isolateValues } from '@/lib/bidi-isolate.ts';
import { cn } from '@/lib/utils.ts';
import type { AppointmentConnectedLead } from '@/shared/api/clinic/appointments-contracts.ts';
import type { AppointmentStatus, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { appointmentContactCard } from '@/shared/clinic/appointment-display.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { clinicPhoneDigits } from '@/shared/clinic/clinic-phone-field.ts';
import { LEAD_STATUS_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerInput,
  DrawerPhoneInput,
} from '@/shared/components/DrawerField/index.ts';
import { ContactCard } from '@/shared/components/PersonCard/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useCommandSearch } from '@/shared/hooks/useCommandSearch/index.ts';
import { Search } from '@/shared/icons/index.ts';
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
  leadChoices,
  linkedLeadId,
  movesAtCheckIn,
  type WhoDraft,
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

/** A lead's status tone, its pills' (`LSTAT`, H:3346); a contact thread has no status. */
const leadTone = (lead: AppointmentConnectedLead): Tone =>
  lead.status ? LEAD_STATUS_TONES[lead.status] : 'lav';

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
  /** The person's connected leads. */
  leads: readonly AppointmentConnectedLead[];
  /** "Change" clears the person (New only). */
  canChange: boolean;
  disabled: boolean;
  /** "Connected lead" chip — the lead drawer, closing the form (H:4139). */
  onOpenLead: (leadId: string) => void;
  /** The inline editor's Save — the patient or lead record (D32); resolves when saved. */
  onSaveContact: (who: WhoDraft, edit: WhoEdit) => Promise<void>;
}

/** The person search (H:2749–2753): from two characters, five hits, or "+ Create contact". */
function WhoSearch({
  onPick,
  disabled,
}: {
  onPick: (who: WhoDraft) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const [query, setQuery] = useState('');
  const search = useCommandSearch(query);
  const typed = query.trim();
  const hits: { who: WhoDraft; sub: string }[] = [];
  for (const patient of search.data?.patients ?? []) {
    const care = patient.types
      .map((type) => t(CLINIC_KEYS.patients.types[type], { ns: CLINIC_NS }))
      .join(' · ');
    hits.push({
      who: {
        kind: 'patient',
        name: patient.name,
        phone: patient.phone,
        patientId: patient.id,
        leadId: null,
        seq: patient.seq,
      },
      sub: care ? t(K.patientCare, { care }) : t(K.patient),
    });
  }
  for (const lead of search.data?.leads ?? []) {
    hits.push({
      who: {
        kind: 'lead',
        name: lead.name,
        phone: lead.phone,
        patientId: null,
        leadId: lead.id,
        seq: lead.seq,
      },
      sub: t(
        K.lead,
        isolateValues({ id: `#${lead.seq}`, phone: formatClinicPhone(lead.phone) }),
      ),
    });
  }
  const pick = (who: WhoDraft) => {
    onPick(who);
    setQuery('');
  };
  return (
    <>
      <div
        data-slot="who-search"
        className="bg-card text-muted-foreground flex h-11 items-center gap-2 rounded-xl border px-3 shadow-xs"
      >
        <Search aria-hidden="true" className="size-3.75 flex-none" />
        <input
          type="search"
          value={query}
          maxLength={80}
          disabled={disabled}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t(K.search)}
          aria-label={t(K.searchLabel)}
          data-testid={IDS.whoSearch}
          className="text-field text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent outline-none"
        />
      </div>
      {typed.length >= 2
        ? hits.slice(0, HIT_LIMIT).map(({ who, sub }) => (
            <button
              key={`${who.kind}:${who.patientId ?? who.leadId}`}
              type="button"
              data-testid={IDS.whoHit}
              onClick={() => pick(who)}
              className="hover:bg-muted flex items-center gap-2.5 rounded-lg px-2.5 py-1.75 text-start transition-colors"
            >
              <PersonAvatar
                size="cell"
                initials={personInitials(who.name)}
                tone={WHO_TONES[who.kind]}
                patient={who.kind === 'patient'}
              />
              <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                <span
                  dir="auto"
                  className="text-field [text-align:match-parent] font-semibold"
                >
                  {who.name}
                </span>
                <span className="text-caption text-muted-foreground-strong truncate tabular-nums">
                  {sub}
                </span>
              </span>
              <span
                data-slot="button"
                className="bg-card flex h-6.5 flex-none items-center rounded-lg border px-2.5 text-xs font-medium"
              >
                {t(K.useContact)}
              </span>
            </button>
          ))
        : null}
      {typed.length >= 2 ? (
        <button
          type="button"
          data-testid={IDS.whoCreate}
          onClick={() =>
            pick({
              kind: 'new',
              name: typed.slice(0, APPOINTMENT_FORM_LIMITS.name),
              phone: null,
              patientId: null,
              leadId: null,
              seq: null,
            })
          }
          data-slot="button"
          className="border-border-strong bg-card hover:bg-muted text-body flex h-8 items-center gap-1.5 self-start rounded-lg border border-dashed px-3 font-medium transition-colors"
        >
          {t(K.createContact, { query: typed })}
        </button>
      ) : null}
    </>
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
  const [phone, setPhone] = useState(who.phone ? clinicPhoneDigits(who.phone) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) {
      notify.warning(t(K.addName));
      return;
    }
    if (phone && phone.length !== 10) {
      notify.warning(t(K.mobileDigits));
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
          data-testid={IDS.whoEditMobile}
        />
      </DrawerField>
      <button
        type="button"
        disabled={saving}
        data-testid={IDS.whoEditSave}
        onClick={() => void save()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 text-body h-9 rounded-lg px-3.5 font-medium transition-colors disabled:opacity-50"
      >
        {t(K.save)}
      </button>
    </div>
  );
}

/** "Connected lead" chips and the moves-at-check-in note (H:2754, H:4139). */
function ConnectedLeads({
  leads,
  status,
  onOpenLead,
}: {
  leads: readonly AppointmentConnectedLead[];
  status: AppointmentStatus;
  onOpenLead: (leadId: string) => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  return (
    <div className="text-muted-foreground -mt-2 flex flex-wrap items-center gap-1.5 text-xs">
      <span>{t(L.connected)}</span>
      {leads.map((lead) => {
        const statusText = lead.status
          ? t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS })
          : '';
        const source = lead.source
          ? t(CLINIC_KEYS.leads.sources[lead.source], { ns: CLINIC_NS })
          : '—';
        return (
          <Tooltip key={lead.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-slot="pill"
                data-testid={IDS.connectedLead}
                onClick={() => onOpenLead(lead.id)}
                className={cn(
                  'text-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold whitespace-nowrap',
                  TONE_CLASSES[leadTone(lead)].surface,
                )}
              >
                <span
                  aria-hidden="true"
                  data-slot="pill"
                  className="size-1.5 rounded-full bg-current"
                />
                {statusText
                  ? t(L.chip, { id: `#${lead.seq}`, status: statusText })
                  : `#${lead.seq}`}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {t(L.chipHint, {
                id: `#${lead.seq}`,
                source,
                owner: lead.ownerName ?? '—',
              })}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {movesAtCheckIn(leads, status) ? <span>{t(L.movesAtCheckIn)}</span> : null}
    </div>
  );
}

/** The "Lead" radios — two or more open leads not on a patient record (H:2755, `S:330`). */
function LeadRadios({
  draft,
  leads,
  disabled,
  onChange,
}: {
  draft: AppointmentDraft;
  leads: readonly AppointmentConnectedLead[];
  disabled: boolean;
  onChange: (change: AppointmentFormChange) => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const clock = useClinicClock();
  const picked = linkedLeadId(draft, leads);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {t(L.lead)}
      </span>
      <div
        role="radiogroup"
        aria-label={t(L.lead)}
        className="flex flex-col overflow-hidden rounded-lg border"
      >
        {leads.map((lead, index) => {
          const on = lead.id === picked;
          const sub = isolateJoin([
            lead.source
              ? t(CLINIC_KEYS.leads.sources[lead.source], { ns: CLINIC_NS })
              : '',
            lead.interests.join(', '),
            // When the lead came in, by the rooms' one time rule (days alone).
            clock.moment(lead.createdAt, { withTime: false }),
          ]);
          return (
            <button
              key={lead.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              data-testid={IDS.leadOption}
              onClick={() => onChange({ kind: 'lead', leadId: lead.id })}
              className={cn(
                'hover:bg-canvas flex items-center gap-2.5 px-3 py-2.25 text-start transition-colors',
                index > 0 && 'border-t',
                on ? 'bg-canvas' : 'bg-card',
              )}
            >
              <span
                aria-hidden="true"
                data-slot="pill"
                className={cn(
                  'flex size-4 flex-none items-center justify-center rounded-full border-[1.5px]',
                  on ? 'border-foreground' : 'border-border-strong',
                )}
              >
                {on ? (
                  <span data-slot="pill" className="bg-foreground size-2 rounded-full" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-[1.3]">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-body font-medium">
                    {t(L.leadOption, { id: `#${lead.seq}` })}
                  </span>
                  {lead.status ? (
                    <span
                      data-slot="pill"
                      className={cn(
                        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
                        TONE_CLASSES[leadTone(lead)].surface,
                      )}
                    >
                      {t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS })}
                    </span>
                  ) : null}
                </span>
                <span className="text-caption text-muted-foreground truncate">{sub}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The person's line under their name: a new contact's note, else the mobile. */
function whoSubline(who: WhoDraft, newContact: string): string {
  if (who.kind === 'new') return newContact;
  return who.phone ? formatClinicPhone(who.phone) : '';
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
 * the connected leads and, when two or more are open, the "Lead" radios.
 */
export function WhoSection({
  draft,
  onChange,
  leads,
  canChange,
  disabled,
  onOpenLead,
  onSaveContact,
}: WhoSectionProps) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const [editing, setEditing] = useState(false);
  const who = draft.who;
  const choices = leadChoices(leads);
  if (!who) {
    return (
      <div className="flex flex-none flex-col gap-2">
        <WhoSearch
          disabled={disabled}
          onPick={(next) => onChange({ kind: 'who', who: next })}
        />
      </div>
    );
  }
  const card = appointmentContactCard({
    kind: who.kind === 'new' ? 'contact' : who.kind,
    name: who.name,
    phone: who.phone,
    patientId: who.patientId,
    leadId: who.leadId,
    seq: who.seq,
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
              disabled={disabled}
              data-testid={IDS.whoMobile}
            />
          ) : null}
        </div>
      </div>
      {leads.length > 0 ? (
        <ConnectedLeads leads={leads} status={draft.status} onOpenLead={onOpenLead} />
      ) : null}
      {choices.length >= 2 ? (
        <LeadRadios
          draft={draft}
          leads={choices}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}
    </>
  );
}
