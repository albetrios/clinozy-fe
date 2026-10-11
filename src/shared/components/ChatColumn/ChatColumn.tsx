import { useId, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  type ChatPerson,
  chatPersonKey,
  type ChatThread as ChatThreadRecord,
  type ChatThreadRead,
} from '@/shared/api/app/messages-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import {
  ContactCard,
  type ContactCardProps,
} from '@/shared/components/PersonCard/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import {
  useContactHistory,
  useMessagingStatus,
  useResendMessage,
  useSendMessage,
  useThread,
  useThreadOutbox,
} from '@/shared/hooks/useThread/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import { CHAT_COLUMN_KEYS, CHAT_COLUMN_TEST_IDS } from './chat-column.constants.ts';
import {
  bookingReason,
  type ChatContact,
  composerModes,
  composerSuggestions,
  composerTemplates,
  emptyLine,
  firstNameOf,
  initialComposerMode,
  lastInbound,
  preferenceWarning,
  replyHint,
  type Starter,
  starters,
  starterSet,
  visitSummary,
} from './chat-composer.ts';
import { readDraft, writeDraft } from './chat-drafts.ts';
import { useChatFormat, useMessageContext } from './chat-format.ts';
import { type ChatHistoryTarget, threadDivider, threadEntries } from './chat-history.ts';
import { ChatComposer } from './ChatComposer/index.ts';
import { ChatThread } from './ChatThread/index.ts';

const keys = CHAT_COLUMN_KEYS;
const ids = CHAT_COLUMN_TEST_IDS;

/** Props for {@link ChatColumn}: whose conversation, how the host shows it, and where its links lead. */
export interface ChatColumnProps {
  /** Whose conversation: a lead (its thread), or a patient (their lead or contact thread). */
  person: ChatPerson;
  /** The person as the host's record has them: name, phone, reach and preferences. */
  contact: ChatContact;
  /**
   * The lead the host shows the person's chat for — a contact's stream has no thread record, so
   * its divider reads the lead's "Lead created · <time> · via <source>" from here.
   */
  lead?: ChatThreadRecord;
  /**
   * Labels beside the "Send via" glyphs — the lead drawer passes
   * `composerShowsLabels(viewport, dragged width)`. Never on a phone.
   */
  showModeLabels?: boolean;
  /** The patient file's privacy: every ₹ amount in the history reads "₹ ••••". */
  maskMoney?: boolean;
  /**
   * "Book an appointment" (hidden without it): the host opens the booking with
   * the reason from their last message (H:5751).
   */
  onBookAppointment?: (booking: { reason: string | null }) => void;
  /** A history chip was clicked: the host opens the appointment or the patient-file section. */
  onOpenHistory?: (target: ChatHistoryTarget) => void;
  /** A message went out — the server took it (the task drawer reads its task again, D81 T7). */
  onSent?: () => void;
  /** The header's contact card on hover (or a tap on touch): its data or loader and its actions. */
  contactCard?: Omit<
    ContactCardProps,
    'children' | 'triggerVariant' | 'triggerClassName'
  >;
  className?: string;
}

/**
 * The header (KICKOFF §3.5): the host's header height, a 34px avatar, the name
 * and the phone — the name in its own direction, the phone always left to
 * right, both aligned as the header is (a right-to-left page keeps them whole).
 */
function ChatHeader({
  contact,
  contactCard,
  nameId,
}: Pick<ChatColumnProps, 'contact' | 'contactCard'> & { nameId: string }) {
  const identity = (
    <>
      <PersonAvatar
        size="header"
        initials={personInitials(contact.name)}
        tone={contact.isPatient ? 'sage' : 'lav'}
        patient={contact.isPatient}
      />
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <span
          id={nameId}
          dir="auto"
          className="text-field truncate [text-align:match-parent] font-semibold"
        >
          {contact.name}
        </span>
        {contact.phone ? (
          <span
            dir="ltr"
            className="text-caption text-muted-foreground truncate [text-align:match-parent] tabular-nums"
          >
            {formatAppPhone(contact.phone)}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <header
      data-slot="chat-column-header"
      data-testid={ids.header}
      className="bg-card flex h-(--drawer-header-height) flex-none items-center gap-2.5 overflow-hidden border-b px-(--table-pad-x) py-2.5"
    >
      {contactCard ? (
        <ContactCard
          {...contactCard}
          triggerVariant="bare"
          triggerClassName="min-w-0 gap-2.5"
        >
          {identity}
        </ContactCard>
      ) : (
        <div className="flex min-w-0 items-center gap-2.5">{identity}</div>
      )}
    </header>
  );
}

/** What the conversation below the header reads — the header owns the contact card, the column its class. */
type ChatConversationProps = Omit<ChatColumnProps, 'contactCard' | 'className'>;

/** The thread and composer once the thread has loaded — remounted per person. */
function ChatLoaded({
  person,
  contact,
  lead,
  read,
  showModeLabels = false,
  maskMoney = false,
  onBookAppointment,
  onOpenHistory,
  onSent,
}: ChatConversationProps & { read: ChatThreadRead }) {
  const personKey = chatPersonKey(person);
  const tier = useViewportTier();
  const format = useChatFormat(maskMoney);
  const { t, clock } = format;
  const history = useContactHistory(person).data;
  const whatsappDown = useMessagingStatus(person).data?.whatsappDown ?? false;
  const outbox = useThreadOutbox(person);
  const { send, retry } = useSendMessage(person, contact, { onSent });
  const resend = useResendMessage(person);

  const options = composerModes(contact);
  const [mode, setMode] = useState(() => initialComposerMode(read.messages, contact));
  // The draft this person was left with comes back (KICKOFF §3.5 Drafts).
  const [text, setText] = useState(() => readDraft(personKey));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const changeText = (next: string) => {
    setText(next);
    writeDraft(personKey, next);
  };

  const entries = useMemo(
    () => threadEntries(read.messages, outbox, history ?? [], format),
    [read.messages, outbox, history, format],
  );
  const visits = visitSummary(history ?? [], clock);
  const { ctx, fill } = useMessageContext({
    person,
    contact,
    clock,
    upcoming: visits.upcoming,
  });
  const lastFrom = lastInbound(read.messages);
  const first = firstNameOf(contact.name);
  const conversed =
    outbox.length > 0 || read.messages.some((message) => !message.isSystem);
  const set = starterSet(visits, clock);
  const pickStarter = (starter: Starter) => {
    // A starter is a WhatsApp (H:5797).
    if (options.some((option) => option.mode === 'whatsapp')) setMode('whatsapp');
    changeText(starter.text);
    textareaRef.current?.focus();
  };

  return (
    <>
      <ChatThread
        entries={entries}
        divider={threadDivider(read.thread ?? lead ?? null, contact.isPatient, format)}
        empty={
          conversed
            ? null
            : {
                line: emptyLine(set, t, first, visits.upcoming, clock),
                starters: starters(set, t, ctx),
                onStarter: pickStarter,
              }
        }
        authors={read.authors}
        contactFirst={first}
        whatsappDown={whatsappDown}
        format={format}
        onResend={(messageId) => resend.mutate(messageId)}
        resendingId={resend.isPending ? (resend.variables ?? null) : null}
        onRetry={retry}
        onOpenHistory={onOpenHistory}
        selfName={ctx.me.short || null}
      />
      <ChatComposer
        mode={mode}
        onModeChange={setMode}
        modes={options}
        showLabels={showModeLabels && tier !== 'phone'}
        text={text}
        onTextChange={changeText}
        onSend={() => {
          if (!text.trim()) return;
          send(mode, text);
          changeText('');
        }}
        textareaRef={textareaRef}
        first={first}
        hint={replyHint(lastFrom, mode)}
        outage={whatsappDown}
        warning={preferenceWarning(mode, contact.preferences)}
        suggestions={composerSuggestions(lastFrom, ctx, t)}
        templates={composerTemplates(ctx, t)}
        fillValues={fill}
        onBook={
          onBookAppointment
            ? () => onBookAppointment({ reason: bookingReason(lastFrom) })
            : undefined
        }
        format={format}
      />
    </>
  );
}

/** Loads the person's thread: the skeleton, a retry on failure, then the conversation. */
function ChatConversation(props: ChatConversationProps) {
  const thread = useThread(props.person);
  const { t } = useChatFormat(false);
  if (thread.isPending) {
    return (
      <div className="bg-canvas flex min-h-0 flex-1 flex-col justify-end px-(--table-pad-x) py-3.5">
        <SkeletonRows rows={4} label={t(keys.thread)} rowClassName="h-9" />
      </div>
    );
  }
  if (thread.isError) {
    return (
      <div className="bg-canvas flex min-h-0 flex-1 items-center justify-center">
        <RetryError
          onRetry={() => void thread.refetch()}
          isRetrying={thread.isFetching}
        />
      </div>
    );
  }
  return <ChatLoaded {...props} read={thread.data} />;
}

/**
 * The chat column (KICKOFF §3.5; `_patterns.md:143–194`) — one thread per
 * person, shared by the lead drawer, the lead edit form, the appointment form,
 * the task drawer and the patient file's Activity column: the contact header,
 * the thread with the person's contact history merged in, and the composer
 * with its channels, suggestions, templates, starters and per-thread drafts.
 * It fills its host's column; the host sizes it and owns the phone pane.
 */
export function ChatColumn(props: ChatColumnProps) {
  const nameId = useId();
  return (
    <TooltipProvider>
      <section
        aria-labelledby={nameId}
        data-slot="chat-column"
        data-testid={ids.root}
        className={cn(
          'bg-card flex h-full min-h-0 flex-col overflow-hidden',
          props.className,
        )}
      >
        <ChatHeader
          contact={props.contact}
          contactCard={props.contactCard}
          nameId={nameId}
        />
        <ChatConversation key={chatPersonKey(props.person)} {...props} />
      </section>
    </TooltipProvider>
  );
}
