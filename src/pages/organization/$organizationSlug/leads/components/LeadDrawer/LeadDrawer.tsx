import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useRef,
  useState,
} from 'react';
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
import { useUnsavedChangesGuard } from '@/shared/hooks/useUnsavedChangesGuard/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { ChevronLeft, Users, WhatsAppMark, X } from '@/shared/icons/index.ts';
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
import { LeadDetailsPane } from './LeadDetailsPane.tsx';

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
 * The lead drawer (KICKOFF §6.3; `leads.md:124–136`, H:1752–1867): from `md`
 * two fixed panes at the inline end — details, then the chat with its resize
 * handle — over a 28% backdrop that appears at once, sliding in together over
 * 340ms, the 36px × floating 12px outside; on a phone the screen with a 52px
 * bar ("Close lead", Details · Chat), one pane at a time. A modal dialog
 * (§7.3): focus moves to "Edit lead" and back; closing with an unsaved draft
 * asks first (Q-P1).
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
  const tier = useViewportTier();
  const phone = tier === 'phone';
  const chatWidth = useDevicePrefsStore((state) => state.leadChatWidth);
  const [viewport] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth,
  );
  const widths = leadDrawerWidths(viewport, chatWidth);
  const draft = useLeadDraft(lead, viewer?.id ?? null);
  const guard = useUnsavedChangesGuard({ when: draft.dirty });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const thread = useThread({ kind: 'lead', leadId: lead.id });
  const close = () => guard.confirmDiscard(onClose);
  const [booking, setBooking] = useState<AppointmentFormPrefill | null>(null);

  const style = {
    '--lead-total': `${widths.total}px`,
    '--lead-details-w': `${widths.details}px`,
    '--lead-chat-w': `${widths.chat}px`,
  } as CSSProperties;

  const chat = (
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
        canBook ? ({ reason }) => setBooking(leadBookingPrefill(lead, reason)) : undefined
      }
    />
  );
  const details = (
    <LeadDetailsPane
      lead={lead}
      draft={draft}
      staff={staff}
      staffById={staffById}
      messages={thread.data?.messages}
      people={{ ...people, viewer }}
      canEdit={canEdit}
      canDelete={canDelete}
      onConvert={onConvert}
      contactActions={contactActions}
      onRemoved={onClose}
      titleRef={titleRef}
      className="h-full"
    />
  );

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-overlay/28 fixed inset-0 z-39" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          data-testid={LEADS_TEST_IDS.drawer}
          style={style}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          className="pointer-events-none fixed inset-0 z-40 outline-none"
        >
          <TooltipProvider>
            {phone ? (
              <>
                <div
                  data-slot="surface"
                  className="bg-card pointer-events-auto fixed inset-x-0 top-0 z-42 flex h-13 items-center gap-2 border-b px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={close}
                    aria-label={t(LEADS_KEYS.drawer.close)}
                    data-slot="button"
                    className="bg-card text-foreground-soft flex size-9 flex-none items-center justify-center rounded-lg border"
                  >
                    <ChevronLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
                  </button>
                  <div
                    role="tablist"
                    aria-label={t(LEADS_KEYS.drawer.panels)}
                    className="bg-muted flex flex-1 gap-0.5 rounded-lg border p-0.75"
                  >
                    {(['details', 'chat'] as const).map((key) => {
                      const Icon = key === 'details' ? Users : WhatsAppMark;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={pane === key}
                          onClick={() => onPaneChange(key)}
                          data-slot="button"
                          className="text-body text-foreground-soft aria-selected:bg-card aria-selected:text-foreground flex h-7.5 flex-1 items-center justify-center gap-1.5 rounded-md font-medium aria-selected:shadow-(--elevation-sm)"
                        >
                          <Icon aria-hidden="true" className="size-3.5" />
                          {t(
                            key === 'details'
                              ? LEADS_KEYS.drawer.details
                              : LEADS_KEYS.drawer.chat,
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pointer-events-auto fixed inset-x-0 top-13 bottom-0 z-40 flex flex-col">
                  {pane === 'details' ? (
                    details
                  ) : (
                    <div
                      data-testid={LEADS_TEST_IDS.drawerChat}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      {chat}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="animate-drawer-in pointer-events-auto fixed inset-y-0 end-(--lead-chat-w) z-40 flex w-(--lead-details-w) flex-col shadow-[-16px_0_40px_rgb(0_0_0/0.14)] [--drawer-enter-from:calc(var(--lead-total)+40px)] rtl:[--drawer-enter-from:calc(-1*(var(--lead-total)+40px))]">
                  {details}
                </div>
                <aside
                  data-testid={LEADS_TEST_IDS.drawerChat}
                  data-slot="surface"
                  className="animate-drawer-in bg-card pointer-events-auto fixed inset-y-0 end-0 z-40 flex w-(--lead-chat-w) flex-col border-s [--drawer-enter-from:calc(var(--lead-total)+40px)] rtl:[--drawer-enter-from:calc(-1*(var(--lead-total)+40px))]"
                >
                  <ChatResizeHandle width={widths.chat} />
                  {chat}
                </aside>
                <button
                  type="button"
                  onClick={close}
                  aria-label={t(LEADS_KEYS.drawer.close)}
                  data-slot="floating-edge"
                  className="bg-background text-foreground-soft hover:bg-muted animate-pop-in pointer-events-auto fixed end-[calc(var(--lead-total)+0.75rem)] top-3.5 z-41 flex size-9 items-center justify-center rounded-lg border shadow-(--elevation-md)"
                >
                  <X aria-hidden="true" className="size-4.5" />
                </button>
              </>
            )}
          </TooltipProvider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
      {guard.guardDialog}
      <AppointmentForm
        open={booking !== null}
        mode="create"
        prefill={booking ?? undefined}
        onClose={() => setBooking(null)}
      />
    </DialogPrimitive.Root>
  );
}
