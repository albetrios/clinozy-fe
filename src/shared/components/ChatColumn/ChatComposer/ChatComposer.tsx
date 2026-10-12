import { type KeyboardEvent, type RefObject, useId, useMemo, useState } from 'react';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import {
  type ComposerMode,
  MESSAGE_MAX_LENGTH,
} from '@/shared/api/app/messages-contracts.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import {
  CHAT_COLUMN_KEYS,
  CHAT_COLUMN_TEST_IDS,
} from '@/shared/components/ChatColumn/chat-column.constants.ts';
import {
  type ComposerModeOption,
  type ComposerSuggestion,
  type ComposerTemplate,
  fillFirstVariable,
  type ReplyHint,
  slashQuery,
  templateMatches,
  templateVariables,
} from '@/shared/components/ChatColumn/chat-composer.ts';
import type { ChatFormat } from '@/shared/components/ChatColumn/chat-history.ts';
import {
  type RoomViewTab,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/RoomTabs/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/shared/components/ui/popover.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import {
  type AppIcon,
  Calendar,
  InstagramMark,
  PenLine,
  Phone,
  Send,
  Sparkles,
  WhatsAppMark,
  X,
} from '@/shared/icons/index.ts';

const keys = CHAT_COLUMN_KEYS;
const ids = CHAT_COLUMN_TEST_IDS;

type Translate = ChatFormat['t'];

/** Each mode's glyph on its tab (H:5770): WhatsApp, Instagram, `Phone`, `PenLine`. */
const MODE_ICONS: Readonly<Record<ComposerMode, AppIcon>> = {
  whatsapp: WhatsAppMark,
  instagram: InstagramMark,
  call: Phone,
  note: PenLine,
};

/**
 * Each mode's paint, as literal classes (KICKOFF §3.5 Composer; `CHT` H:3363):
 * the composer's tint, the box's line in the tone's ink, the solid fill of the
 * selected tab and of Send, and an unselected tab's ink — Instagram's in its
 * AA foreground (§7.3).
 */
const MODE_PAINT: Readonly<
  Record<
    ComposerMode,
    { tint: string; line: string; fill: string; press: string; ink: string }
  >
> = {
  whatsapp: {
    tint: 'bg-tone-sage',
    line: 'border-tone-sage-foreground',
    fill: 'bg-channel-whatsapp',
    press: 'hover:bg-channel-whatsapp/90',
    ink: 'text-tone-sage-foreground',
  },
  instagram: {
    tint: 'bg-tone-blush',
    line: 'border-tone-blush-foreground',
    fill: 'bg-channel-instagram',
    press: 'hover:bg-channel-instagram/90',
    ink: 'text-channel-instagram-foreground',
  },
  call: {
    tint: 'bg-tone-sky',
    line: 'border-tone-sky-foreground',
    fill: 'bg-channel-call',
    press: 'hover:bg-channel-call/90',
    ink: 'text-tone-sky-foreground',
  },
  note: {
    tint: 'bg-tone-butter',
    line: 'border-tone-butter-foreground',
    fill: 'bg-channel-note',
    press: 'hover:bg-channel-note/90',
    ink: 'text-tone-butter-foreground',
  },
};

/** Send's label per mode: "Send WhatsApp" · "Send Instagram" · "Log call" · "Add note". */
const SEND_LABELS = keys.send;

/** A smart chip's hover ring and a template row's hover wash, per tone (literal classes). */
const TONE_HOVERS: Readonly<Partial<Record<Tone, { chip: string; row: string }>>> = {
  butter: {
    chip: 'hover:ring-1 hover:ring-tone-butter-foreground',
    row: 'hover:bg-tone-butter',
  },
  sky: { chip: 'hover:ring-1 hover:ring-tone-sky-foreground', row: 'hover:bg-tone-sky' },
  lav: { chip: 'hover:ring-1 hover:ring-tone-lav-foreground', row: 'hover:bg-tone-lav' },
  mint: {
    chip: 'hover:ring-1 hover:ring-tone-mint-foreground',
    row: 'hover:bg-tone-mint',
  },
  sage: {
    chip: 'hover:ring-1 hover:ring-tone-sage-foreground',
    row: 'hover:bg-tone-sage',
  },
};

/** The box's placeholder per mode (`_patterns.md:160–162`). */
function placeholderFor(mode: ComposerMode, first: string, t: Translate): string {
  if (mode === 'call') return t(keys.placeholder.call);
  if (mode === 'note') {
    return first ? t(keys.placeholder.note, { first }) : t(keys.placeholder.noteNoName);
  }
  const channel = t(APP_KEYS.channels[mode]);
  return first
    ? t(keys.placeholder.message, { first, channel })
    : t(keys.placeholder.messageNoName, { channel });
}

/**
 * The "Send via" tabs (H:5770) — the room view tabs' `card` look: four equal
 * 32px segments on the card, the selected one solid in its channel's colour
 * (D93), the others in the channel's ink; each names itself as its tooltip, a
 * disabled one says why. The arrows open the mode they reach (mirrored
 * right-to-left), Home / End jump, a disabled mode is passed by.
 */
function ModeTabs({
  mode,
  modes,
  showLabels,
  onModeChange,
  controls,
  t,
}: {
  mode: ComposerMode;
  modes: readonly ComposerModeOption[];
  showLabels: boolean;
  onModeChange: (mode: ComposerMode) => void;
  controls: string;
  t: Translate;
}) {
  const tabs: RoomViewTab[] = modes.map((option) => {
    const label = t(keys.modes[option.mode]);
    const paint = MODE_PAINT[option.mode];
    return {
      id: option.mode,
      label,
      icon: MODE_ICONS[option.mode],
      iconOnly: !showLabels,
      hint: option.disabled ? t(keys.noInstagram) : label,
      disabled: option.disabled,
      selectedClassName: cn(
        paint.fill,
        'text-background font-semibold shadow-(--elevation-control)',
      ),
      idleClassName: option.disabled ? 'text-disabled' : cn(paint.ink, 'font-medium'),
    };
  });
  return (
    <RoomViewTabs
      look="card"
      fill
      activation="automatic"
      label={t(keys.sendVia)}
      tabs={tabs}
      value={mode}
      onValueChange={(next) => {
        const picked = modes.find((option) => option.mode === next);
        if (picked && !picked.disabled) onModeChange(picked.mode);
      }}
      controls={controls}
      testIds={{ list: ids.modes, tab: (id) => `${ids.mode}-${id}` }}
    />
  );
}

/**
 * The notes after the tabs: the reply hint or the mismatch chip, the outage or not-connected line,
 * the preference warning.
 */
function ComposerNotes({
  hint,
  first,
  outage,
  notConnected,
  warning,
  onSwitch,
  t,
}: {
  hint: ReplyHint;
  first: string;
  outage: boolean;
  notConnected: boolean;
  warning: 'noCalls' | 'afterSix' | null;
  onSwitch: (mode: ComposerMode) => void;
  t: Translate;
}) {
  return (
    <>
      {/* The notes sit on the composer's channel tint: the strong muted ink keeps them AA. */}
      {hint?.kind === 'here' ? (
        <span className="text-caption text-muted-foreground-strong min-w-0 flex-1 truncate">
          {t(keys.replyHint, { first: isolateText(first) })}
        </span>
      ) : null}
      {hint?.kind === 'mismatch' ? (
        <button
          type="button"
          data-slot="pill"
          data-testid={ids.mismatch}
          onClick={() => onSwitch(hint.channel)}
          className="border-tone-blush-border bg-tone-blush text-tone-blush-foreground hover:ring-tone-blush-foreground inline-flex h-6 max-w-full items-center truncate rounded-full border px-2.5 text-xs font-medium whitespace-nowrap hover:ring-1"
        >
          {t(keys.mismatch, {
            first: isolateText(first),
            channel: t(APP_KEYS.channels[hint.channel]),
          })}
        </button>
      ) : null}
      {outage ? (
        <span className="text-caption text-tone-blush-foreground min-w-0 truncate">
          {t(keys.outage)}
        </span>
      ) : null}
      {notConnected ? (
        <span className="text-caption text-muted-foreground-strong min-w-0 truncate">
          {t(keys.notConnected)}
        </span>
      ) : null}
      {warning ? (
        <span className="text-caption text-tone-blush-foreground min-w-0 truncate">
          {t(warning === 'noCalls' ? keys.prefersNoCalls : keys.prefersAfterSix)}
        </span>
      ) : null}
    </>
  );
}

/** "Fill in": one dashed butter chip per placeholder; each fills the first one left (H:5750). */
function FillInRow({
  text,
  values,
  onChange,
  t,
}: {
  text: string;
  values: Readonly<Record<string, string>>;
  onChange: (text: string) => void;
  t: Translate;
}) {
  // One chip per placeholder; a message can hold the same one twice, so the
  // key counts its occurrences.
  const chips = useMemo(() => {
    const variables = templateVariables(text);
    const keys = occurrenceKeys(variables);
    return variables.map((variable, index) => ({ variable, key: keys[index] }));
  }, [text]);
  if (!chips.length) return null;
  return (
    <div className="text-caption text-muted-foreground flex flex-wrap items-center gap-1.5 px-3 pb-1">
      <span>{t(keys.fillIn)}</span>
      {chips.map(({ variable, key }) => (
        <button
          key={key}
          type="button"
          data-testid={ids.fillIn}
          onClick={() => onChange(fillFirstVariable(text, values))}
          className="border-tone-butter-dot bg-tone-butter-tint text-tone-butter-foreground text-caption h-5.5 rounded-md border border-dashed px-2 font-semibold"
        >
          {variable}
        </button>
      ))}
    </div>
  );
}

/** The suggestions popover's body: header, smart chips, the templates and the "/" search. */
function Suggestions({
  title,
  query,
  suggestions,
  templates,
  onPick,
  onClose,
  t,
}: {
  title: string;
  query: string;
  suggestions: readonly ComposerSuggestion[];
  templates: readonly ComposerTemplate[];
  onPick: (text: string) => void;
  onClose: () => void;
  t: Translate;
}) {
  const shown = templates.filter((template) =>
    templateMatches(query, template.name, template.text),
  );
  return (
    <>
      <div className="flex items-center gap-2">
        <Sparkles aria-hidden="true" className="text-assist size-3.5 flex-none" />
        <span className="text-detail min-w-0 flex-1 truncate font-semibold">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t(keys.closeSuggestions)}
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground size-6 rounded-md"
        >
          <X aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((chip) => {
          const Icon = chip.icon;
          return (
            <Tooltip key={chip.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  data-slot="pill"
                  data-testid={ids.suggestionChip}
                  onClick={() => onPick(chip.text)}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap',
                    TONE_CLASSES[chip.tone].surface,
                    TONE_HOVERS[chip.tone]?.chip,
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.25" />
                  {chip.label}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-72 whitespace-normal">
                {chip.hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <span className="text-tiny text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {t(keys.templatesLabel)}
      </span>
      <div className="-mx-1.5 flex flex-col gap-0.5">
        {shown.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.key}
              type="button"
              data-testid={`${ids.template}-${template.key}`}
              onClick={() => onPick(template.text)}
              className={cn(
                'grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2.5 rounded-lg p-1.5 text-start transition-colors duration-150',
                TONE_HOVERS[template.tone]?.row,
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-6 items-center justify-center rounded-md',
                  TONE_CLASSES[template.tone].surface,
                )}
              >
                <Icon className="size-3.25" />
              </span>
              <span className="flex min-w-0 flex-col leading-[1.3]">
                <span className="text-detail font-semibold">{template.name}</span>
                <span className="text-caption text-muted-foreground truncate">
                  {template.text}
                </span>
              </span>
            </button>
          );
        })}
        {shown.length ? null : (
          <span className="text-muted-foreground p-1.5 text-xs">
            {t(keys.noTemplate, { query })}
          </span>
        )}
      </div>
    </>
  );
}

/** The box's bottom bar: Suggest and Book (messaging channels only), then Send in the channel colour. */
function ComposerActions({
  mode,
  suggestOpen,
  onToggleSuggest,
  onBook,
  onSend,
  t,
}: {
  mode: ComposerMode;
  suggestOpen: boolean;
  onToggleSuggest: () => void;
  onBook: (() => void) | undefined;
  onSend: () => void;
  t: Translate;
}) {
  const messaging = mode === 'whatsapp' || mode === 'instagram';
  return (
    <div className="flex items-center gap-0.5 px-1.5 pt-1 pb-1.5">
      {messaging ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={t(keys.suggestions)}
              aria-haspopup="dialog"
              aria-expanded={suggestOpen}
              data-testid={ids.suggest}
              onClick={onToggleSuggest}
              className={cn(
                'hover:bg-tone-lav dark:hover:bg-tone-lav h-7.5 gap-1.25 ps-2 pe-2.5 text-xs font-semibold',
                suggestOpen
                  ? 'bg-tone-lav text-tone-lav-foreground hover:text-tone-lav-foreground'
                  : 'text-muted-foreground-strong hover:text-muted-foreground-strong',
              )}
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              {t(keys.suggest)}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(keys.suggestHint)}</TooltipContent>
        </Tooltip>
      ) : null}
      {messaging && onBook ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t(keys.book)}
              data-testid={ids.book}
              onClick={onBook}
              className="text-muted-foreground-strong hover:bg-muted hover:text-foreground size-7.5"
            >
              <Calendar aria-hidden="true" className="size-3.75" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t(keys.bookHint)}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="flex-1" />
      <Button
        type="button"
        size="xs"
        data-testid={ids.send}
        onClick={onSend}
        className={cn(
          'text-background text-detail h-7.5 gap-1.5 ps-2.5 pe-3 duration-200',
          MODE_PAINT[mode].fill,
          MODE_PAINT[mode].press,
        )}
      >
        <Send aria-hidden="true" className="size-3.25" />
        {t(SEND_LABELS[mode])}
      </Button>
    </div>
  );
}

/** Props for {@link ChatComposer}. */
export interface ChatComposerProps {
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
  modes: readonly ComposerModeOption[];
  /** Labels beside the tab glyphs (`composerShowsLabels`); icons only otherwise. */
  showLabels: boolean;
  text: string;
  onTextChange: (text: string) => void;
  /** Send what the box holds (the caller ignores blank text). */
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Their first name ('' without one). */
  first: string;
  hint: ReplyHint;
  outage: boolean;
  /** No messaging service delivers this thread: what is sent waits in the outbox. */
  notConnected?: boolean;
  warning: 'noCalls' | 'afterSix' | null;
  /** "Suggested for <First>": the smart chips and the eight templates. */
  suggestions: readonly ComposerSuggestion[];
  templates: readonly ComposerTemplate[];
  /** What each "Fill in" placeholder becomes. */
  fillValues: Readonly<Record<string, string>>;
  /** "Book an appointment" — hidden without it. */
  onBook?: () => void;
  format: Pick<ChatFormat, 't'>;
}

/**
 * The composer (KICKOFF §3.5): tinted in the chosen channel's tone, the
 * "Send via" tabs with the reply hint or the mismatch chip, the outage line
 * and the preference warning; the box — a 3-row textarea (↵ sends, Shift+↵
 * breaks a line), "Fill in" chips for {{placeholders}}, Suggest and Book, and
 * Send in the channel colour. The suggestions popover sits above the box at
 * its full width; typing "/" first opens it and searches the templates.
 */
export function ChatComposer({
  mode,
  onModeChange,
  modes,
  showLabels,
  text,
  onTextChange,
  onSend,
  textareaRef,
  first,
  hint,
  outage,
  notConnected = false,
  warning,
  suggestions,
  templates,
  fillValues,
  onBook,
  format: { t },
}: ChatComposerProps) {
  const boxId = useId();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const query = slashQuery(text);
  const open =
    (mode === 'whatsapp' || mode === 'instagram') && (suggestOpen || query !== null);

  const close = () => {
    setSuggestOpen(false);
    // Dismissing a "/" search clears it (H:5750).
    if (query !== null) onTextChange('');
  };
  const pick = (picked: string) => {
    onTextChange(picked);
    setSuggestOpen(false);
    textareaRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onSend();
  };

  return (
    <div
      data-testid={ids.composer}
      data-mode={mode}
      className={cn(
        'flex flex-none flex-col gap-2 border-t px-(--table-pad-x) pt-2.5 pb-3 transition-[background-color,border-color] duration-200',
        MODE_PAINT[mode].tint,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ModeTabs
          mode={mode}
          modes={modes}
          showLabels={showLabels}
          onModeChange={onModeChange}
          controls={boxId}
          t={t}
        />
        <ComposerNotes
          hint={hint}
          first={first}
          outage={outage}
          notConnected={notConnected}
          warning={warning}
          onSwitch={onModeChange}
          t={t}
        />
      </div>
      <Popover
        open={open}
        onOpenChange={(next) => (next ? setSuggestOpen(true) : close())}
      >
        <PopoverAnchor asChild>
          <div
            id={boxId}
            role="tabpanel"
            aria-label={t(keys.modes[mode])}
            data-slot="chat-composer-box"
            className={cn(
              'bg-card focus-within:ring-ring/50 relative flex flex-col rounded-xl border shadow-(--elevation-control) transition-[border-color] duration-200 focus-within:ring-[3px]',
              MODE_PAINT[mode].line,
            )}
          >
            <textarea
              ref={textareaRef}
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              aria-label={t(keys.message)}
              data-testid={ids.textarea}
              placeholder={placeholderFor(mode, first, t)}
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              onKeyDown={onKeyDown}
              className="text-field placeholder:text-muted-foreground min-h-15 w-full resize-none bg-transparent px-3.5 pt-2.5 pb-0.5 leading-normal outline-none"
            />
            <FillInRow text={text} values={fillValues} onChange={onTextChange} t={t} />
            <ComposerActions
              mode={mode}
              suggestOpen={open}
              onToggleSuggest={() => (open ? close() : setSuggestOpen(true))}
              onBook={onBook}
              onSend={onSend}
              t={t}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          data-testid={ids.suggestions}
          aria-label={t(keys.suggestedFor, { first })}
          // Typing goes on in the box (initial focus: none, `leads.md:224`).
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Closed by ×, a pick, Esc or clearing the "/" — not by a click elsewhere.
          onInteractOutside={(event) => event.preventDefault()}
          className="data-[state=open]:animate-dropdown-up flex max-h-[min(340px,var(--radix-popover-content-available-height))] w-(--radix-popover-trigger-width) flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-xl p-3 shadow-(--elevation-menu) data-[state=closed]:animate-none"
        >
          <Suggestions
            title={t(keys.suggestedFor, { first })}
            query={query ?? ''}
            suggestions={suggestions}
            templates={templates}
            onPick={pick}
            onClose={close}
            t={t}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
