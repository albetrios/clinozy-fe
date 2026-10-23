import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import type { TaskPerson } from '@/shared/api/app/tasks-contracts.ts';
import {
  ChatColumn,
  chatContactOfContact,
  composerShowsLabels,
} from '@/shared/components/ChatColumn/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { useContactActivityAccess } from '@/shared/hooks/useContactActivities/index.ts';
import { useContact } from '@/shared/hooks/useContacts/index.ts';

import { taskContactCard } from '../../tasks.display.ts';

/** Props of {@link TaskDrawerChat}. */
interface TaskDrawerChatProps {
  /** The person the task is about — their contact's one stream. */
  person: TaskPerson;
  /** The lead the task points at — the thread's divider names it and the composer its interests. */
  lead: LeadRecord | null;
  /** The member may read their contact record (`contact:read`): the composer knows their channels. */
  canReadContact: boolean;
  viewportWidth: number;
  /** The width last dragged in the lead drawer — the labels beside "Send via" follow it. */
  chatWidth: number;
  contactActions?: ContactCardActions;
  /** "Book an appointment" — hidden without it (no `appointment:create`). */
  onBookAppointment?: () => void;
  /** A message went out — the task is read again once the rules have run (D81 T7). */
  onSent: () => void;
}

/**
 * The task drawer's chat column (D32; `tasks.md` › Chat column): the person's
 * one stream on clinozy-be, by their contact (`{ kind: 'contact' }`, as the
 * patient file's Activity) — the history, the composer and its channels from
 * their contact record, the lead the task points at on the thread's divider. A message sent here asks the rules to run: a "Reply
 * to" task closes right after (D81 T7), so the drawer reads its task again
 * (`onSent`) and closes itself once it is done. The column loads, fails and
 * retries on its own.
 */
export function TaskDrawerChat({
  person,
  lead,
  canReadContact,
  viewportWidth,
  chatWidth,
  contactActions,
  onBookAppointment,
  onSent,
}: TaskDrawerChatProps) {
  const contact = useContact(canReadContact ? person.id : undefined).data;
  // The composer needs `contact_activity:create` (the codes in force, a View-as preview's too).
  const stream = useContactActivityAccess();
  return (
    <ChatColumn
      person={{ kind: 'contact', contactId: person.id }}
      contact={chatContactOfContact(
        {
          name: person.name,
          phone: person.phone,
          isPatient: person.patientId !== null,
          interests: lead?.interests,
        },
        contact,
      )}
      lead={
        lead
          ? {
              leadId: lead.id,
              kind: lead.kind,
              createdAt: lead.createdAt,
              source: lead.source,
              patientId: lead.patientId,
            }
          : undefined
      }
      showModeLabels={composerShowsLabels(viewportWidth, chatWidth)}
      canSend={stream.writes}
      contactCard={{ data: taskContactCard({ person }) ?? undefined, ...contactActions }}
      onBookAppointment={onBookAppointment ? () => onBookAppointment() : undefined}
      onSent={onSent}
    />
  );
}
