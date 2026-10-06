import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import type { StaffProfile } from '@/shared/api/clinic/users-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  ChatColumn,
  chatContactOfLead,
  composerShowsLabels,
} from '@/shared/components/ChatColumn/index.ts';
import type { ContactCardActions } from '@/shared/components/PersonCard/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  AppointmentForm,
  type AppointmentFormPrefill,
  leadBookingPrefill,
} from '@/shared/forms/AppointmentForm/index.ts';
import { useThread } from '@/shared/hooks/useThread/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth/index.ts';
import { Users, WhatsAppMark } from '@/shared/icons/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useLeadDraft } from '../../hooks/useLeadDraft/index.ts';
import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import { leadContactCardData } from '../LeadFields/lead-contact.ts';
import type { LeadPeopleFieldProps } from '../LeadFormFields/index.ts';
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
  staff: readonly StaffProfile[];
  staffById: ReadonlyMap<string, StaffProfile>;
  viewer: StaffProfile | null;
  people: Omit<LeadPeopleFieldProps, 'ownerId' | 'involvedIds' | 'staff' | 'viewer'>;
  canEdit: boolean;
  canDelete: boolean;
  /**
   * The composer's "Book an appointment" — the member may create
   * appointments: the appointment form opens stacked over the drawer, the URL
   * staying `/leads/$leadId` (KICKOFF §6.3, A-L7).
   */
  canBook?: boolean;
  onConvert?: () => void;
  /** The person's contact card actions — "+ Lead", "+ Appointment", "+ Patient", the file. */
  contactActions?: ContactCardActions;
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
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    drag.current = { from: event.clientX, width, rtl };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    const moved = event.clientX - start.from;
    setWidth(clampChatWidth(start.width + (start.rtl ? moved : -moved)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
        <div
          role="separator"
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
          className="hover:bg-foreground/8 focus-visible:bg-foreground/8 absolute inset-y-0 start-0 z-5 w-1.75 cursor-col-resize outline-none"
        />
      </TooltipTrigger>
      <TooltipContent side="left">{t(LEADS_KEYS.drawer.resizeHint)}</TooltipContent>
    </Tooltip>
  );
  /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
}

/**
 * The lead drawer (KICKOFF §6.3; `leads.md:124–136`, H:1752–1867) — the record
 * drawer at `round(min(980, 0.94 × vw))`: the details form, then the chat in
 * its column with the resize handle, the form drawers' × floating outside; on
 * a phone the full screen with a Details · Chat switch under the header, one
 * pane at a time (the page keeps the pane between leads). The header: "Edit
 * lead", the ID to copy, "Re-target" and the sub line; the footer: Remove lead
 * · Discard (puts the draft back) or Cancel · Save lead. Focus moves to the
 * title and back; closing with an unsaved draft asks first (Q-P1).
 */
export function LeadDrawer({
  lead,
  staff,
  staffById,
  viewer,
  people,
  canEdit,
  canDelete,
  canBook = false,
  onConvert,
  contactActions,
  onClose,
  pane,
  onPaneChange,
}: LeadDrawerProps) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const phone = useViewportTier() === 'phone';
  const chatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const viewport = useViewportWidth();
  const widths = leadDrawerWidths(viewport, chatWidth);
  const draft = useLeadDraft(lead, viewer?.id ?? null);
  const thread = useThread({ kind: 'lead', leadId: lead.id });
  const [booking, setBooking] = useState<AppointmentFormPrefill | null>(null);
  const [removing, setRemoving] = useState(false);

  const chat = (
    <div
      data-testid={LEADS_TEST_IDS.drawerChat}
      data-slot="surface"
      className="bg-card relative flex min-h-0 flex-1 flex-col"
    >
      {phone ? null : <ChatResizeHandle width={widths.chat} />}
      <ChatColumn
        person={{ kind: 'lead', leadId: lead.id }}
        contact={chatContactOfLead(lead)}
        showModeLabels={!phone && composerShowsLabels(viewport, chatWidth)}
        contactCard={{
          data: leadContactCardData(lead, staffById, {
            role: (role) => tClinic(CLINIC_KEYS.roles[role]),
            source: (source) => tClinic(CLINIC_KEYS.leads.sources[source]),
          }),
        }}
        onBookAppointment={
          canBook
            ? ({ reason }) => setBooking(leadBookingPrefill(lead, reason))
            : undefined
        }
      />
    </div>
  );

  return (
    <TooltipProvider>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(LEADS_KEYS.drawer.title)}
        titleEnd={<LeadTitleChips lead={lead} />}
        sub={t(LEADS_KEYS.drawer.sub)}
        largeTitle
        panelWidth={widths.total}
        aside={{
          content: chat,
          width: widths.chat,
          panes: {
            label: t(LEADS_KEYS.drawer.panels),
            form: { id: 'details', label: t(LEADS_KEYS.drawer.details), icon: Users },
            aside: { id: 'chat', label: t(LEADS_KEYS.drawer.chat), icon: WhatsAppMark },
            value: pane === 'chat' ? 'aside' : 'form',
            onValueChange: (next) => onPaneChange(next === 'aside' ? 'chat' : 'details'),
            testIdPrefix: LEADS_TEST_IDS.drawerPanes,
          },
        }}
        closeStyle="form"
        readOnly={!canEdit && !canDelete}
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
          staff={staff}
          staffById={staffById}
          messages={thread.data?.messages}
          people={{ ...people, viewer }}
          canEdit={canEdit}
          onConvert={onConvert}
          contactActions={contactActions}
        />
      </RecordDrawer>
      <LeadRemoveConfirm
        lead={lead}
        open={removing}
        onOpenChange={setRemoving}
        onRemoved={onClose}
      />
      <AppointmentForm
        open={booking !== null}
        mode="create"
        prefill={booking ?? undefined}
        onClose={() => setBooking(null)}
      />
    </TooltipProvider>
  );
}
