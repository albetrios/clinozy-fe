import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  CONTACT_EDITOR_KEYS,
  CONTACT_EDITOR_NS,
  ContactEditor,
  type ContactEditorValue,
  contactFieldsOf,
  contactValueOf,
} from '@/shared/forms/ContactEditor/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useContact, useUpdateContact } from '@/shared/hooks/useContacts/index.ts';
import {
  useDeleteLead,
  useOpenLeadTasks,
  useRestoreLead,
} from '@/shared/hooks/useLeads/index.ts';
import { Copy, RefreshCw } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { LeadDraftState } from '../../hooks/useLeadDraft/index.ts';
import { LEADS_KEYS, LEADS_NS } from '../../leads.constants.ts';
import { leadContactCardData } from '../LeadFields/lead-contact.ts';
import {
  LeadCard,
  LeadContactStrip,
  LeadInterestsField,
  LeadPeopleField,
  type LeadPeopleFieldProps,
  LeadProgressField,
  LeadSourceField,
} from '../LeadFormFields/index.ts';

/** What the lead drawer's body reads and does beyond the draft. */
export interface LeadDetailsBodyProps {
  lead: LeadRecord;
  draft: LeadDraftState;
  /** The active members (`useTeamDirectory`). */
  members: readonly DirectoryMember[];
  team: ReadonlyMap<string, DirectoryMember>;
  people: Omit<LeadPeopleFieldProps, 'ownerId' | 'involvedIds' | 'members'>;
  canEdit: boolean;
  /** May edit the person (`contact:update`) — the contact card's "Edit contact". */
  canEditContact: boolean;
  /** The contact card's and the contact editor's band actions. */
  contactActions?: ContactCardActions;
}

/**
 * The title's chips (H:1755): the ID to copy — its tooltip names when the lead
 * was created by the rooms' one time rule ("9:20 am" today, "Yesterday 4:10
 * pm", "27 Sep") — and "Re-target" on a re-target lead.
 */
export function LeadTitleChips({ lead }: { lead: LeadRecord }) {
  const { t } = useTranslation(LEADS_NS);
  const clock = useAppClock();
  const seq = String(lead.leadNumber);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(`#${seq}`);
      notify.success(t(LEADS_KEYS.drawer.idCopied, { seq }));
    } catch {
      // A blocked clipboard copies nothing; the ID stays on screen to read.
    }
  };
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void copyId()}
            aria-label={t(LEADS_KEYS.drawer.idAria, { seq })}
            className="group/copy bg-muted text-muted-foreground-strong hover:bg-muted-strong flex h-8 flex-none items-center gap-1 rounded-lg border px-2.5 font-mono text-xs font-medium"
          >
            #{seq}
            <Copy
              aria-hidden="true"
              className="-ms-1 size-0 opacity-0 transition-all duration-150 group-hover/copy:ms-0 group-hover/copy:size-3 group-hover/copy:opacity-100"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {t(LEADS_KEYS.drawer.idTooltip, {
            seq,
            created: clock.moment(lead.createdAt),
          })}
        </TooltipContent>
      </Tooltip>
      {lead.kind === 'retarget' ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={-1}
              data-slot="pill"
              className="bg-tone-mint text-tone-mint-foreground inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap"
            >
              <RefreshCw aria-hidden="true" className="size-3" />
              {t(LEADS_KEYS.drawer.retarget)}
            </span>
          </TooltipTrigger>
          {lead.retargetReason ? (
            <TooltipContent>{lead.retargetReason}</TooltipContent>
          ) : null}
        </Tooltip>
      ) : null}
    </>
  );
}

/**
 * The person's strip over the cards, and "Edit contact" (its contact card's
 * pencil) opening the contact editor on the person (`GET /app/contacts/:contact_id`):
 * Done saves them with the read's `updated_at` — "Contact updated · applies
 * everywhere" — unless the first name or the primary mobile is missing. Their
 * every number and handle shows on the card once the contact is read.
 */
function LeadPerson({
  lead,
  team,
  canEdit,
  actions,
}: {
  lead: LeadRecord;
  team: ReadonlyMap<string, DirectoryMember>;
  canEdit: boolean;
  actions: ContactCardActions;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { t: tEditor } = useTranslation(CONTACT_EDITOR_NS);
  const [editing, setEditing] = useState(false);
  const contact = useContact(lead.contactId).data;
  const save = useUpdateContact({
    successMessage: tEditor(CONTACT_EDITOR_KEYS.updated),
  });
  const done = (value: ContactEditorValue) => {
    const fields = contactFieldsOf(value);
    if (!(contact && fields.firstName && fields.phones.length > 0)) {
      notify.warning(t(LEADS_KEYS.newLead.toasts.missing));
      return;
    }
    setEditing(false);
    save.mutate({ contact, fields });
  };
  return (
    <>
      <LeadContactStrip
        card={leadContactCardData(
          lead,
          team,
          { source: (source) => tApp(APP_KEYS.leads.sources[source]) },
          contact,
        )}
        name={lead.name}
        phone={lead.phone}
        {...actions}
        onEditContact={canEdit && contact ? () => setEditing(true) : undefined}
      />
      {contact ? (
        <ContactEditor
          open={editing}
          value={contactValueOf(contact)}
          record={{
            kind: lead.patientId ? 'patient' : 'lead',
            displayId: displayId.lead(lead.leadNumber),
          }}
          onOpenPatientFile={actions.onOpenPatientFile}
          onNewLead={actions.onNewLead}
          onNewAppointment={actions.onNewAppointment}
          onDone={done}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  );
}

/** One Info cell. */
interface LeadFact {
  key: string;
  label: string;
  value: string;
  full?: boolean;
}

/**
 * Info (H:1813): Created · Last activity (the person's latest, on any record) · Patient —
 * linked once a check-in opened their file; the design's "Convert to patient" went with the
 * backend (route map §4 #5) · Open tasks, for a member who reads tasks (`task:read` — a role
 * without it would get a 403, research-tasks §7 flag 4) · Re-target reason.
 */
function LeadInfoCard({ lead }: { lead: LeadRecord }) {
  const { t } = useTranslation(LEADS_NS);
  const clock = useAppClock();
  const access = useAppAccess();
  const readsTasks = access.isResolved && access.can('tasks', 'view');
  const openTasks = useOpenLeadTasks(lead.id, { enabled: readsTasks });
  const facts: LeadFact[] = [
    {
      key: 'created',
      label: t(LEADS_KEYS.drawer.info.created),
      value: clock.moment(lead.createdAt),
    },
    {
      key: 'last',
      label: t(LEADS_KEYS.drawer.info.lastActivity),
      value: lead.lastActivityAt
        ? clock.moment(lead.lastActivityAt)
        : t(LEADS_KEYS.drawer.info.none),
    },
    {
      key: 'patient',
      label: t(LEADS_KEYS.drawer.info.patient),
      value: t(
        lead.patientId ? LEADS_KEYS.drawer.info.linked : LEADS_KEYS.drawer.info.notYet,
      ),
    },
  ];
  if (readsTasks) {
    facts.push({
      key: 'tasks',
      label: t(LEADS_KEYS.drawer.info.openTasks),
      value: String(openTasks.data ?? 0),
    });
  }
  if (lead.kind === 'retarget' && lead.retargetReason) {
    facts.push({
      key: 'retarget',
      label: t(LEADS_KEYS.drawer.info.retargetReason),
      value: lead.retargetReason,
      full: true,
    });
  }
  return (
    <LeadCard label={t(LEADS_KEYS.drawer.cards.info)}>
      <dl className="bg-canvas grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] overflow-hidden rounded-xl border">
        {facts.map((fact) => (
          <div
            key={fact.key}
            className={cn(
              '-me-px -mb-px flex min-w-0 flex-col gap-0.75 border-e border-b px-3 py-2.5',
              fact.full && 'col-span-full',
            )}
          >
            <dt className="text-caption text-muted-foreground flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="bg-border-strong size-1.5 rounded-full"
              />
              {fact.label}
            </dt>
            <dd className="text-body leading-snug font-medium [overflow-wrap:anywhere]">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </LeadCard>
  );
}

/**
 * "Remove lead?" (H:1818): the reason confirm — duplicate · test entry · spam ·
 * other — then "Removed" with Undo; the drawer closes behind it.
 */
export function LeadRemoveConfirm({
  lead,
  open,
  onOpenChange,
  onRemoved,
}: {
  lead: LeadRecord;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const remove = useDeleteLead();
  const restore = useRestoreLead();
  const seq = String(lead.leadNumber);
  const reasonLabel = (key: string) => `${LEADS_NS}:${key}`;
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(LEADS_KEYS.drawer.remove.title)}
      description={t(LEADS_KEYS.drawer.remove.effect)}
      confirmLabel={t(LEADS_KEYS.drawer.footer.remove)}
      reason={{
        record: lead.name,
        options: [
          {
            value: 'duplicate',
            labelKey: reasonLabel(LEADS_KEYS.drawer.remove.reasons.duplicate),
          },
          {
            value: 'test_entry',
            labelKey: reasonLabel(LEADS_KEYS.drawer.remove.reasons.testEntry),
          },
          {
            value: 'spam',
            labelKey: reasonLabel(LEADS_KEYS.drawer.remove.reasons.spam),
          },
          {
            value: 'other',
            labelKey: reasonLabel(LEADS_KEYS.drawer.remove.reasons.other),
          },
        ],
      }}
      onConfirm={async (choice) => {
        await remove.mutateAsync({
          id: lead.id,
          reason: choice.reason,
          note: choice.note,
        });
        notify.undo(
          t(LEADS_KEYS.drawer.remove.removed, { seq, reason: choice.picked.label }),
          { onUndo: () => restore.mutate(lead.id) },
        );
        onRemoved();
      }}
    />
  );
}

/**
 * The lead drawer's body (`leads.md:133`, H:1754–1821): the person's strip,
 * then the three cards — Lead details · Progress · Info. The record drawer
 * draws the header (its title chips are {@link LeadTitleChips}) and the footer.
 */
export function LeadDetailsBody({
  lead,
  draft,
  members,
  team,
  people,
  canEdit,
  canEditContact,
  contactActions = {},
}: LeadDetailsBodyProps) {
  const { t } = useTranslation(LEADS_NS);
  const { draft: values, update } = draft;
  const detailsDone = values.source !== null && values.interests.length > 0;
  return (
    <>
      <LeadPerson
        lead={lead}
        team={team}
        canEdit={canEditContact}
        actions={contactActions}
      />
      <LeadCard label={t(LEADS_KEYS.drawer.cards.details)} number={1} done={detailsDone}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-4 gap-y-3.5">
          <div className="col-span-full">
            <LeadSourceField
              value={values.source}
              onChange={(source) => update({ source })}
            />
          </div>
          <div className="col-span-full">
            <LeadInterestsField
              value={values.interests}
              onChange={(interests) => update({ interests })}
            />
          </div>
          <LeadPeopleField
            ownerId={lead.ownerId}
            involvedIds={lead.involvedIds}
            members={members}
            readOnly={!canEdit}
            {...people}
          />
        </div>
      </LeadCard>
      <LeadCard label={t(LEADS_KEYS.drawer.cards.progress)} number={2} done>
        <LeadProgressField
          status={values.status}
          onChange={(status) => update({ status })}
        />
      </LeadCard>
      <LeadInfoCard lead={lead} />
    </>
  );
}
