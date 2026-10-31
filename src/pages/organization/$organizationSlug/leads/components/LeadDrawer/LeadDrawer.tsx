import { useParams } from '@tanstack/react-router';
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PATIENT_FILE_DEFAULT_SECTION } from '@/shared/app/patient-file-sections.ts';
import {
  ChatColumn,
  chatContactOfContact,
  composerShowsLabels,
} from '@/shared/components/ChatColumn/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import {
  RecordDrawer,
  type RecordDrawerProps,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  AppointmentForm,
  CancelVisitConfirm,
} from '@/shared/forms/AppointmentForm/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useContactActivityAccess } from '@/shared/hooks/useContactActivities/index.ts';
import { useContact } from '@/shared/hooks/useContacts/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth/index.ts';
import { Users, WhatsAppMark } from '@/shared/icons/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useLeadBooking } from '../../hooks/useLeadBooking/index.ts';
import { useLeadDraft } from '../../hooks/useLeadDraft/index.ts';
import { useLeadProgress } from '../../hooks/useLeadProgress/index.ts';
import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { leadContactCardData } from '../LeadFields/lead-contact.ts';
import type { LeadPeopleFieldProps } from '../LeadFormFields/index.ts';
import type { LeadComposeMode } from '../LeadNextStep/index.ts';
import {
  CHAT_WIDTH_STEP,
  clampChatWidth,
  leadDrawerWidths,
} from './lead-drawer-widths.ts';
import {
  LeadDetailsBody,
  LeadRemoveConfirm,
  LeadTitleChips,
} from './LeadDetailsPane.tsx';

/** The phone's one pane at a time. */
export type LeadDrawerPane = 'details' | 'chat';

/** Props of {@link LeadDrawer}. */
export interface LeadDrawerProps {
  lead: LeadRecord;
  /** The active members (`useTeamDirectory`). */
  members: readonly DirectoryMember[];
  team: ReadonlyMap<string, DirectoryMember>;
  people: Omit<LeadPeopleFieldProps, 'ownerId' | 'involvedIds' | 'members'>;
  canEdit: boolean;
  canDelete: boolean;
  /** May edit the person (`contact:update`). */
  canEditContact: boolean;
  /** The person's contact card actions — "+ Lead", "+ Appointment", the file. */
  contactActions?: ContactCardActions;
  /** May book (`appointment:create`) — the chat's "Book an appointment". */
  canBook: boolean;
  /** Closing settled (nothing unsaved, or "Discard"): back to the list. */
  onClose: () => void;
  /** The phone pane — the Leads page keeps it between leads (Chat first). */
  pane: LeadDrawerPane;
  onPaneChange: (pane: LeadDrawerPane) => void;
}

/**
 * The chat's 7px resize handle (`leads.md:131`; A-L3 — a small separator, not
 * the percentage-keyed `resizable`): drag 360–680px, ← / → 20px in the
 * reading direction, double-click back to 420, one clamp for all three.
 */
function ChatResizeHandle({ width }: { width: number }) {
  const { t } = useTranslation(LEADS_NS);
  const setWidth = useDevicePrefsStore((state) => state.setLeadChatWidth);
  const reset = useDevicePrefsStore((state) => state.resetLeadChatWidth);
  const drag = useRef<{ from: number; width: number; rtl: boolean } | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLHRElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    drag.current = { from: event.clientX, width, rtl };
  };
  const onPointerMove = (event: PointerEvent<HTMLHRElement>) => {
    const start = drag.current;
    if (!start) return;
    const moved = event.clientX - start.from;
    setWidth(clampChatWidth(start.width + (start.rtl ? moved : -moved)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    // The handle sits on the chat's inline-start edge: towards the start widens it.
    const widen = rtl ? 'ArrowRight' : 'ArrowLeft';
    const narrow = rtl ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === widen) setWidth(clampChatWidth(width + CHAT_WIDTH_STEP));
    else if (event.key === narrow) setWidth(clampChatWidth(width - CHAT_WIDTH_STEP));
    else return;
    event.preventDefault();
  };
  /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- a focusable window splitter (ARIA 1.2: a separator with aria-valuenow) is a widget */
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <hr
          aria-orientation="vertical"
          aria-label={t(LEADS_KEYS.drawer.resize)}
          aria-valuenow={width}
          aria-valuemin={360}
          aria-valuemax={680}
          tabIndex={0}
          data-testid={LEADS_TEST_IDS.drawerResize}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => {
            drag.current = null;
          }}
          onDoubleClick={reset}
          onKeyDown={onKeyDown}
          className="hover:bg-foreground/8 focus-visible:bg-foreground/8 absolute inset-y-0 start-0 z-5 m-0 h-auto w-1.75 cursor-col-resize border-0 outline-none"
        />
      </TooltipTrigger>
      <TooltipContent side="left">{t(LEADS_KEYS.drawer.resizeHint)}</TooltipContent>
    </Tooltip>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

/**
 * The lead drawer's chat column (`leads.md:131`): the person's one stream by their contact, the
 * lead on its divider, "Book an appointment" for a member who books, and on a phone the
 * Details · Chat switch. It shows only to a member who reads the stream
 * (`contact_activity:read`), its composer to one who writes it (`contact_activity:create`) — the
 * codes in force, a View-as preview's too. Without the stream the drawer is the details alone,
 * at their own width.
 */
function useLeadChatAside({
  lead,
  team,
  pane,
  onPaneChange,
  onBook,
  compose,
}: Pick<LeadDrawerProps, 'lead' | 'team' | 'pane' | 'onPaneChange'> & {
  /** "Book an appointment" with the reason from their last message — absent without it. */
  onBook?: (reason: string | null) => void;
  /** The Next step card's ask for the composer (D25). */
  compose?: { mode: LeadComposeMode; at: number };
}): { panelWidth: number; aside: RecordDrawerProps['aside']; canCompose: boolean } {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const phone = useViewportTier() === 'phone';
  const chatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const viewport = useViewportWidth();
  const widths = leadDrawerWidths(viewport, chatWidth);
  const stream = useContactActivityAccess();
  const contact = useContact(lead.contactId).data;
  if (!stream.reads) {
    return { panelWidth: widths.details, aside: undefined, canCompose: false };
  }
  const content = (
    <div
      data-testid={LEADS_TEST_IDS.drawerChat}
      data-slot="surface"
      className="bg-card relative flex min-h-0 flex-1 flex-col"
    >
      {phone ? null : <ChatResizeHandle width={widths.chat} />}
      <ChatColumn
        person={{ kind: 'contact', contactId: lead.contactId }}
        contact={chatContactOfContact(
          {
            name: lead.name,
            phone: lead.phone,
            isPatient: lead.patientId !== null,
            interests: lead.interests,
          },
          contact,
        )}
        lead={{
          leadId: lead.id,
          kind: lead.kind,
          createdAt: lead.createdAt,
          source: lead.source,
          patientId: lead.patientId,
        }}
        showModeLabels={!phone && composerShowsLabels(viewport, chatWidth)}
        canSend={stream.writes}
        contactCard={{
          data: leadContactCardData(
            lead,
            team,
            { source: (source) => tApp(APP_KEYS.leads.sources[source]) },
            contact,
          ),
        }}
        onBookAppointment={onBook ? ({ reason }) => onBook(reason) : undefined}
        compose={compose}
      />
    </div>
  );
  return {
    panelWidth: widths.total,
    canCompose: stream.writes,
    aside: {
      content,
      width: widths.chat,
      panes: {
        label: t(LEADS_KEYS.drawer.panels),
        form: { id: 'details', label: t(LEADS_KEYS.drawer.details), icon: Users },
        aside: { id: 'chat', label: t(LEADS_KEYS.drawer.chat), icon: WhatsAppMark },
        value: pane === 'chat' ? 'aside' : 'form',
        onValueChange: (next) => onPaneChange(next === 'aside' ? 'chat' : 'details'),
        testIdPrefix: LEADS_TEST_IDS.drawerPanes,
      },
    },
  };
}

/**
 * The Next step card's ways out of the details (D25): the chat's composer — asked for a mode, the
 * phone's chat pane brought forward — and the patient file a check-in opened.
 */
function useLeadDrawerLinks({
  lead,
  onPaneChange,
}: Pick<LeadDrawerProps, 'lead' | 'onPaneChange'>) {
  const [asked, setAsked] = useState<{ mode: LeadComposeMode; at: number }>();
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const patientId = lead.patientId;
  return {
    /** The composer's last ask — each a new `at`. */
    asked,
    ask: (mode: LeadComposeMode) => {
      setAsked({ mode, at: Date.now() });
      onPaneChange('chat');
    },
    openPatient: patientId
      ? () =>
          void navigate(
            organizationPatientSection(
              organizationSlug,
              patientId,
              PATIENT_FILE_DEFAULT_SECTION,
            ),
          )
      : undefined,
  };
}

/**
 * The lead drawer (KICKOFF §6.3; `leads.md:124–136`, H:1752–1867) — the record
 * drawer at `round(min(980, 0.94 × vw))`: the details form, then the chat in
 * its column with the resize handle, the form drawers' × floating outside; on
 * a phone the full screen with a Details · Chat switch under the header, one
 * pane at a time (the page keeps the pane between leads). The header: "Edit
 * lead", the ID to copy, "Re-target" and the sub line; the footer: Remove lead
 * · Discard (puts the draft back) or Cancel · Save lead. Focus moves to the
 * title and back; closing with an unsaved draft asks first (Q-P1). Progress's
 * Booked step and the chat's "Book an appointment" open the
 * booking form over it; the person's booking still to happen shows on the
 * Next step card with Reschedule (the form again) and Cancel (its confirm) — clinozy-be L11.
 */
export function LeadDrawer({
  lead,
  members,
  team,
  people,
  canEdit,
  canDelete,
  canEditContact,
  contactActions,
  canBook,
  onClose,
  pane,
  onPaneChange,
}: LeadDrawerProps) {
  const { t } = useTranslation(LEADS_NS);
  const draft = useLeadDraft(lead);
  const progress = useLeadProgress(lead);
  const [removing, setRemoving] = useState(false);
  const links = useLeadDrawerLinks({ lead, onPaneChange });
  const booking = useLeadBooking({ lead, canBook });
  const chat = useLeadChatAside({
    lead,
    team,
    pane,
    onPaneChange,
    onBook: booking.book,
    compose: links.asked,
  });

  return (
    <TooltipProvider>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(LEADS_KEYS.drawer.title)}
        titleEnd={<LeadTitleChips lead={lead} />}
        sub={t(LEADS_KEYS.drawer.sub)}
        largeTitle
        panelWidth={chat.panelWidth}
        aside={chat.aside}
        closeStyle="form"
        readOnly={!(canEdit || canDelete)}
        dirty={draft.dirty}
        // "Discard" puts the draft back while it is dirty (H:1821); else "Cancel" closes.
        dismissLabel={draft.dirty ? t(LEADS_KEYS.drawer.footer.discard) : undefined}
        onDismiss={draft.dirty ? draft.discard : undefined}
        saveLabel={t(LEADS_KEYS.drawer.footer.save)}
        onSave={canEdit ? draft.save : undefined}
        saveState={draft.saveState}
        saveDisabled={!draft.dirty}
        saveTestId={LEADS_TEST_IDS.drawerSave}
        deleteLabel={t(LEADS_KEYS.drawer.footer.remove)}
        onDelete={canDelete ? () => setRemoving(true) : undefined}
        deleteTestId={LEADS_TEST_IDS.drawerRemove}
        testId={LEADS_TEST_IDS.drawer}
      >
        <LeadDetailsBody
          lead={lead}
          draft={draft}
          members={members}
          team={team}
          people={people}
          canEdit={canEdit}
          canEditContact={canEditContact}
          contactActions={contactActions}
          booking={booking.progress}
          progress={progress}
          onCompose={chat.canCompose ? links.ask : undefined}
          onOpenPatient={links.openPatient}
        />
      </RecordDrawer>
      <LeadRemoveConfirm
        lead={lead}
        open={removing}
        onOpenChange={setRemoving}
        onRemoved={onClose}
      />
      {booking.form?.mode === 'reschedule' ? (
        <AppointmentForm
          open
          mode="reschedule"
          appointmentId={booking.form.appointment.id}
          appointment={booking.form.appointment}
          onClose={booking.closeForm}
        />
      ) : (
        <AppointmentForm
          open={booking.form !== null}
          mode="create"
          prefill={booking.form?.prefill}
          onClose={booking.closeForm}
        />
      )}
      {booking.cancelling ? (
        <CancelVisitConfirm row={booking.cancelling} open onClose={booking.closeCancel} />
      ) : null}
    </TooltipProvider>
  );
}
