import { type ReactNode, useLayoutEffect, useRef } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Channel } from '@/shared/api/clinic/clinic-schema.ts';
import type { ChatAuthor } from '@/shared/api/clinic/messages-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { shortPersonName } from '@/shared/components/Cells/PersonAvatar/index.ts';
import {
  CHAT_COLUMN_KEYS,
  CHAT_COLUMN_TEST_IDS,
} from '@/shared/components/ChatColumn/chat-column.constants.ts';
import {
  type BubbleKind,
  bubbleKind,
  type DeliveryView,
  deliveryView,
  type Starter,
} from '@/shared/components/ChatColumn/chat-composer.ts';
import {
  type ChatFormat,
  type ChatHistoryTarget,
  type HistoryChip,
  messageTimeLabel,
  type ThreadEntry,
} from '@/shared/components/ChatColumn/chat-history.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { TeamCard } from '@/shared/components/PersonCard/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  type AppIcon,
  InstagramMark,
  Mail,
  MessageSquare,
  Phone,
  WhatsAppMark,
} from '@/shared/icons/index.ts';

const keys = CHAT_COLUMN_KEYS;
const ids = CHAT_COLUMN_TEST_IDS;

/**
 * Bubbles (KICKOFF §3.5 Messages), as literal classes: ours in the channel's
 * tone and line — WhatsApp sage, Instagram blush, SMS butter, e-mail lav — a
 * call log sky, a note butter with a dashed line…
 */
const OURS: Readonly<Record<Channel, string>> = {
  whatsapp: 'bg-tone-sage border-tone-sage-border',
  instagram: 'bg-tone-blush border-tone-blush-border',
  sms: 'bg-tone-butter border-tone-butter-border',
  email: 'bg-tone-lav border-tone-lav-border',
  call: 'bg-tone-sky border-tone-sky-border',
  note: 'bg-tone-butter border-tone-butter-border border-dashed',
};

/**
 * …and theirs in the channel's tone mixed 55% with the card (H:1835) — in
 * OKLab: the card is an achromatic `oklch(1 0 0)` whose stated hue would turn
 * an OKLCH mix toward yellow (the prototype mixed with a hex white, whose hue
 * is missing, so it only lightened).
 */
const THEIRS: Readonly<Record<Channel, string>> = {
  whatsapp:
    'bg-[color-mix(in_oklab,var(--color-tone-sage)_55%,var(--color-card))] border-tone-sage-border',
  instagram:
    'bg-[color-mix(in_oklab,var(--color-tone-blush)_55%,var(--color-card))] border-tone-blush-border',
  sms: 'bg-[color-mix(in_oklab,var(--color-tone-butter)_55%,var(--color-card))] border-tone-butter-border',
  email:
    'bg-[color-mix(in_oklab,var(--color-tone-lav)_55%,var(--color-card))] border-tone-lav-border',
  call: 'bg-[color-mix(in_oklab,var(--color-tone-sky)_55%,var(--color-card))] border-tone-sky-border',
  note: 'bg-[color-mix(in_oklab,var(--color-tone-butter)_55%,var(--color-card))] border-tone-butter-border border-dashed',
};

/** The 12px channel glyph in a message's meta line (H:5789). */
const GLYPHS: Readonly<Partial<Record<Channel, { icon: AppIcon; ink: string }>>> = {
  whatsapp: { icon: WhatsAppMark, ink: 'text-success' },
  instagram: { icon: InstagramMark, ink: 'text-channel-instagram-foreground' },
  sms: { icon: MessageSquare, ink: 'text-channel-call-foreground' },
  email: { icon: Mail, ink: 'text-channel-call-foreground' },
  call: { icon: Phone, ink: 'text-channel-call-foreground' },
};

/** A delivered status's ink: "Read" in `success-strong`, "Queued" in butter ink (D22). */
const STATUS_INK = {
  sent: 'text-muted-foreground',
  delivered: 'text-muted-foreground',
  read: 'text-success-strong',
  queued: 'text-tone-butter-foreground',
} as const;

/**
 * A history chip or system line: centred, at most 86% wide, 28px (KICKOFF §3.5) —
 * `rounded-full` is written at each use, beside its `data-slot="pill"`.
 */
const LINE =
  'bg-card text-caption text-muted-foreground-strong inline-flex max-w-[86%] min-h-7 items-center gap-2 border py-1 pe-3.5 text-start';

/** The top divider: 11px between hairlines (`_patterns.md:151`). */
function ThreadDivider({ text, className }: { text: string; className?: string }) {
  return (
    <div
      data-testid={ids.divider}
      className={cn('flex flex-none items-center gap-2.5 pt-1 pb-2', className)}
    >
      <span aria-hidden="true" className="bg-border h-px flex-1" />
      <span className="text-micro text-muted-foreground whitespace-nowrap">{text}</span>
      <span aria-hidden="true" className="bg-border h-px flex-1" />
    </div>
  );
}

/** A contact-history chip: tone circle and icon, text (ellipsis), time; a button when it leads somewhere. */
function HistoryLine({
  chip,
  when,
  onOpen,
}: {
  chip: HistoryChip;
  when: string;
  onOpen: ((target: ChatHistoryTarget) => void) | undefined;
}) {
  const Icon = chip.icon;
  const body = (
    <>
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'flex size-4.5 flex-none items-center justify-center rounded-full',
          TONE_CLASSES[chip.tone].surface,
        )}
      >
        <Icon className="size-3" />
      </span>
      <span className="min-w-0 truncate">{chip.text}</span>
      <span className="text-muted-foreground flex-none tabular-nums">{when}</span>
    </>
  );
  const { target } = chip;
  return (
    <div className="flex justify-center">
      {target && onOpen ? (
        <button
          type="button"
          data-testid={ids.history}
          onClick={() => onOpen(target)}
          data-slot="pill"
          className={cn(
            LINE,
            'hover:border-border-strong hover:text-foreground rounded-full ps-1.25 transition-colors duration-150',
          )}
        >
          {body}
        </button>
      ) : (
        <span
          data-testid={ids.history}
          data-slot="pill"
          className={cn(LINE, 'rounded-full ps-1.25')}
        >
          {body}
        </span>
      )}
    </div>
  );
}

/** A system line ("Status → Contacted (first reply)"): the chip without an icon, not clickable. */
function SystemLine({ text, when }: { text: string; when: string }) {
  return (
    <div className="flex justify-center">
      <span
        data-testid={ids.system}
        data-slot="pill"
        className={cn(LINE, 'rounded-full ps-3.5')}
      >
        <span className="min-w-0 truncate">{text}</span>
        <span className="text-muted-foreground flex-none tabular-nums">{when}</span>
      </span>
    </div>
  );
}

/** The meta line's delivery part (D22): "· Read", "Sending…", "Not sent" + Retry. */
function Delivery({
  view,
  onRetry,
  format,
}: {
  view: DeliveryView;
  onRetry: (() => void) | undefined;
  format: ChatFormat;
}) {
  const { t } = format;
  switch (view.kind) {
    case 'none':
      return null;
    case 'sending':
      return <span>{t(keys.delivery.sending)}</span>;
    case 'failed':
      return (
        <>
          <span className="font-medium">{t(keys.delivery.notSent)}</span>
          {onRetry ? (
            <button
              type="button"
              data-slot="pill"
              data-testid={ids.retry}
              onClick={onRetry}
              className="border-tone-blush-border bg-tone-blush text-tone-blush-foreground text-micro h-5.5 rounded-full border px-2.5 font-medium"
            >
              {t(keys.delivery.retry)}
            </button>
          ) : null}
        </>
      );
    case 'status':
      return (
        <>
          <span aria-hidden="true">·</span>
          <span className={cn('font-medium', STATUS_INK[view.status])}>
            {t(keys.delivery[view.status])}
          </span>
        </>
      );
  }
}

/** What a bubble shows, whether the server has the message or it is still on its way. */
interface BubbleData {
  kind: BubbleKind;
  channel: Channel;
  body: string;
  at: string;
  who: ReactNode;
  delivery: DeliveryView;
  onRetry?: () => void;
}

/** A message: the bubble (max 68%) and its 11px meta line — sender · glyph · time · delivery. */
function MessageBubble({ data, format }: { data: BubbleData; format: ChatFormat }) {
  const ours = data.kind !== 'in';
  const glyph = data.kind === 'note' ? undefined : GLYPHS[data.channel];
  const Glyph = glyph?.icon;
  const channelName = format.t(CLINIC_KEYS.channels[data.channel]);
  return (
    <div
      data-testid={ids.bubble}
      data-kind={data.kind}
      className={cn('flex', ours ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'flex max-w-[68%] flex-col gap-0.75',
          ours ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'text-field rounded-lg border px-3.25 py-2.25 leading-[1.45] wrap-anywhere whitespace-pre-wrap',
            ours ? OURS[data.channel] : THEIRS[data.channel],
          )}
        >
          {data.body}
        </div>
        <div
          className={cn(
            'text-micro flex flex-wrap items-center gap-1.5 px-0.5',
            data.delivery.kind === 'failed'
              ? 'text-tone-blush-foreground'
              : 'text-muted-foreground-strong',
          )}
        >
          {data.who ? (
            <>
              {data.who}
              <span aria-hidden="true">·</span>
            </>
          ) : null}
          {Glyph ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('inline-flex', glyph.ink)}>
                  <Glyph aria-hidden="true" className="size-3" />
                  <span className="sr-only">{channelName}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{channelName}</TooltipContent>
            </Tooltip>
          ) : null}
          <span className="tabular-nums">{data.at}</span>
          <Delivery view={data.delivery} onRetry={data.onRetry} format={format} />
        </div>
      </div>
    </div>
  );
}

/** The sender: a team member's short name — with their "Sent this" card — or their first name. */
function Sender({
  label,
  author,
  format,
}: {
  label: string;
  author: ChatAuthor | undefined;
  format: ChatFormat;
}) {
  if (!author?.roles.length) {
    return <span className="text-foreground-soft font-medium">{label}</span>;
  }
  return (
    <TeamCard
      kind="sentThis"
      triggerClassName="group/sender"
      data={{
        name: author.name,
        initials: author.initials,
        tone: author.tone,
        role: author.roles.map((role) => format.t(CLINIC_KEYS.roles[role])).join(' · '),
        online: author.online,
        phone: author.phone,
        email: author.email,
      }}
    >
      {/* The hover wash is a pill that bleeds 6px past the name (H:1836). */}
      <span
        data-slot="pill"
        className="text-foreground-soft group-hover/sender:bg-muted group-hover/sender:inset-ring-border -mx-1.5 -my-px rounded-full px-1.5 py-px font-medium group-hover/sender:inset-ring"
      >
        {label}
      </span>
    </TeamCard>
  );
}

/** The thread's empty card: its line and three starter chips. */
export interface ChatThreadEmpty {
  line: string;
  starters: readonly Starter[];
  onStarter: (starter: Starter) => void;
}

/** Props for {@link ChatThread}: the merged lines, the divider, the empty card and the actions. */
export interface ChatThreadProps {
  entries: readonly ThreadEntry[];
  /** "Lead created · <time> · via <source>", or a chat-only thread's line. */
  divider: string;
  /** The empty card while there is no conversation yet. */
  empty: ChatThreadEmpty | null;
  authors: Readonly<Record<string, ChatAuthor>>;
  /** Their first name — who wrote their messages. */
  contactFirst: string;
  whatsappDown: boolean;
  format: ChatFormat;
  /** Resend a stored message its provider could not deliver. */
  onResend: (messageId: string) => void;
  /** The stored message being resent, which reads "Sending…". */
  resendingId: string | null;
  /** Send again a message this client could not send. */
  onRetry: (clientId: string) => void;
  /** A history chip with a target was clicked (the host opens it). */
  onOpenHistory?: (target: ChatHistoryTarget) => void;
  /**
   * The signed-in member's short name ("Riya S.") — the sender of a message
   * still sending, before the server names its author.
   */
  selfName?: string | null;
}

/**
 * The thread (KICKOFF §3.5): `bg-canvas`, newest at the bottom, the divider
 * above the first line, contact-history chips merged with the conversation,
 * and the dashed starter card while there is no conversation yet. A polite
 * `log`, so new messages are announced.
 */
export function ChatThread({
  entries,
  divider,
  empty,
  authors,
  contactFirst,
  whatsappDown,
  format,
  onResend,
  resendingId,
  onRetry,
  onOpenHistory,
  selfName = null,
}: ChatThreadProps) {
  const { t } = format;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineCount = entries.length;
  // Newest at the bottom: open there, and follow each new line.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `lineCount` IS the trigger — a new line scrolls to it; the effect reads only the ref
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lineCount]);

  /** A team member as a meta line names them: "Riya S.", "Riya S. · call", "Riya S. · note". */
  const teamLabel = (kind: BubbleKind, name: string): string => {
    if (kind === 'call') return t(keys.sender.call, { name });
    if (kind === 'note') return t(keys.sender.note, { name });
    return name;
  };

  const bubbleOf = (
    entry: Extract<ThreadEntry, { kind: 'message' | 'outbox' }>,
  ): BubbleData => {
    if (entry.kind === 'outbox') {
      const { message } = entry;
      const kind = bubbleKind({ channel: message.channel, direction: 'sent' });
      return {
        kind,
        channel: message.channel,
        body: message.body,
        at: messageTimeLabel(message.at, format.clock, t),
        who: selfName ? (
          <Sender label={teamLabel(kind, selfName)} author={undefined} format={format} />
        ) : null,
        delivery: message.state === 'failed' ? { kind: 'failed' } : { kind: 'sending' },
        onRetry: () => onRetry(message.clientId),
      };
    }
    const { message } = entry;
    const kind = bubbleKind(message);
    const author = message.authorId ? authors[message.authorId] : undefined;
    const name = author ? shortPersonName(author.name) : null;
    let label: string | null = null;
    if (kind === 'in') label = contactFirst || null;
    else if (name) label = teamLabel(kind, name);
    return {
      kind,
      channel: message.channel,
      body: message.body,
      at: messageTimeLabel(message.sentAt, format.clock, t),
      who: label ? (
        <Sender
          label={label}
          author={kind === 'in' ? undefined : author}
          format={format}
        />
      ) : null,
      delivery:
        resendingId === message.id
          ? { kind: 'sending' }
          : deliveryView(message, whatsappDown),
      onRetry: () => onResend(message.id),
    };
  };

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-label={t(keys.thread)}
      data-testid={ids.thread}
      className="bg-canvas flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-(--table-pad-x) py-3.5"
    >
      {empty ? (
        <EmptyState
          variant="card"
          className="my-auto flex-none"
          title={t(keys.empty.title)}
          description={empty.line}
          action={empty.starters.map((starter) => (
            <button
              key={starter.key}
              type="button"
              data-slot="pill"
              data-testid={ids.starter}
              onClick={() => empty.onStarter(starter)}
              className="bg-card hover:bg-muted hover:border-disabled h-7 rounded-full border px-2.75 text-xs font-medium whitespace-nowrap transition-colors duration-150"
            >
              {starter.label}
            </button>
          ))}
        />
      ) : null}
      <ThreadDivider text={divider} className={empty ? undefined : 'mt-auto'} />
      {entries.map((entry) => {
        switch (entry.kind) {
          case 'history':
            return (
              <HistoryLine
                key={entry.key}
                chip={entry.chip}
                when={entry.when}
                onOpen={onOpenHistory}
              />
            );
          case 'system':
            return <SystemLine key={entry.key} text={entry.text} when={entry.when} />;
          default:
            return (
              <MessageBubble key={entry.key} data={bubbleOf(entry)} format={format} />
            );
        }
      })}
    </div>
  );
}
