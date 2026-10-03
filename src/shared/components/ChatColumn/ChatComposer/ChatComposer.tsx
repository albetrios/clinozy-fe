import {
  type KeyboardEvent,
  type RefObject,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  type ComposerMode,
  MESSAGE_MAX_LENGTH,
} from '@/shared/api/clinic/messages-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
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
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/shared/components/ui/popover.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
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
  Record<ComposerMode, { tint: string; line: string; fill: string; ink: string }>
> = {
  whatsapp: {
    tint: 'bg-tone-sage',
    line: 'border-tone-sage-foreground',
    fill: 'bg-channel-whatsapp',
    ink: 'text-tone-sage-foreground',
  },
  instagram: {
    tint: 'bg-tone-blush',
    line: 'border-tone-blush-foreground',
    fill: 'bg-channel-instagram',
    ink: 'text-channel-instagram-foreground',
  },
  call: {
    tint: 'bg-tone-sky',
    line: 'border-tone-sky-foreground',
    fill: 'bg-channel-call',
    ink: 'text-tone-sky-foreground',
  },
  note: {
    tint: 'bg-tone-butter',
    line: 'border-tone-butter-foreground',
    fill: 'bg-channel-note',
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
  const channel = t(CLINIC_KEYS.channels[mode]);
  return first
    ? t(keys.placeholder.message, { first, channel })
    : t(keys.placeholder.messageNoName, { channel });
}

/** The tab a key moves to, in reading order (←/→ swap under RTL), Home and End. */
function tabFromKey(
  key: string,
  usable: readonly ComposerMode[],
  current: ComposerMode,
  rtl: boolean,
): ComposerMode | undefined {
  const at = usable.indexOf(current);
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward) return usable[(at + 1) % usable.length];
  if (key === back) return usable[(at - 1 + usable.length) % usable.length];
  if (key === 'Home') return usable[0];
  if (key === 'End') return usable.at(-1);
  return undefined;
}

/** The "Send via" tabs: a roving `tablist`, the selected tab solid in its channel colour. */
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
  const { direction } = useLocaleFormat();
  const listRef = useRef<HTMLDivElement>(null);
  const usable = modes.filter((option) => !option.disabled).map((option) => option.mode);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = tabFromKey(event.key, usable, mode, direction === 'rtl');
    if (!next) return;
    event.preventDefault();
    onModeChange(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t(keys.sendVia)}
      data-slot="chat-modes"
      data-testid={ids.modes}
      className="bg-card flex w-full items-center gap-0.75 rounded-lg border p-0.75 shadow-(--elevation-control)"
    >
      {modes.map((option) => {
        const Icon = MODE_ICONS[option.mode];
        const selected = option.mode === mode;
        const label = t(keys.modes[option.mode]);
        const paint = MODE_PAINT[option.mode];
        return (
          <Tooltip key={option.mode}>
            <TooltipTrigger asChild>
              <button
                type="button"
                role="tab"
                data-mode={option.mode}
                data-testid={`${ids.mode}-${option.mode}`}
                aria-selected={selected}
                aria-controls={controls}
                aria-disabled={option.disabled || undefined}
                aria-label={label}
                tabIndex={selected ? 0 : -1}
                onKeyDown={onKeyDown}
                onClick={() => {
                  if (!option.disabled) onModeChange(option.mode);
                }}
                className={cn(
                  'text-detail flex h-8 min-w-0 flex-1 basis-0 items-center justify-center gap-1.5 rounded-md px-2.5 transition-[background-color,color,box-shadow] duration-150',
                  selected
                    ? cn(
                        paint.fill,
                        'text-background font-semibold shadow-(--elevation-control)',
                      )
                    : cn(paint.ink, 'font-medium', !option.disabled && 'hover:bg-muted'),
                  option.disabled && 'text-disabled cursor-not-allowed opacity-45',
                )}
              >
                <Icon aria-hidden="true" className="size-3.5 flex-none" />
                {showLabels ? <span className="min-w-0 truncate">{label}</span> : null}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {option.disabled ? t(keys.noInstagram) : label}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** The notes after the tabs: the reply hint or the mismatch chip, the outage line, the preference warning. */
function ComposerNotes({
  hint,
  first,
  outage,
  warning,
  onSwitch,
  t,
}: {
  hint: ReplyHint;
  first: string;
  outage: boolean;
  warning: 'noCalls' | 'afterSix' | null;
  onSwitch: (mode: ComposerMode) => void;
  t: Translate;
}) {
  return (
    <>
      {hint?.kind === 'here' ? (
        <span className="text-caption text-muted-foreground min-w-0 flex-1 truncate">
          {t(keys.replyHint, { first })}
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
          {t(keys.mismatch, { first, channel: t(CLINIC_KEYS.channels[hint.channel]) })}
        </button>
      ) : null}
      {outage ? (
        <span className="text-caption text-tone-blush-foreground min-w-0 truncate">
          {t(keys.outage)}
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
    const seen = new Map<string, number>();
    return templateVariables(text).map((variable) => {
      const nth = (seen.get(variable) ?? 0) + 1;
      seen.set(variable, nth);
      return { variable, key: `${variable}:${nth}` };
    });
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
        <button
          type="button"
          aria-label={t(keys.closeSuggestions)}
          onClick={onClose}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 flex-none items-center justify-center rounded-md"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
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
            <button
              type="button"
              aria-label={t(keys.suggestions)}
              aria-haspopup="dialog"
              aria-expanded={suggestOpen}
              data-testid={ids.suggest}
              onClick={onToggleSuggest}
              className={cn(
                'hover:bg-tone-lav inline-flex h-7.5 items-center gap-1.25 rounded-lg ps-2 pe-2.5 text-xs font-semibold whitespace-nowrap',
                suggestOpen
                  ? 'bg-tone-lav text-tone-lav-foreground'
                  : 'text-muted-foreground-strong',
              )}
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              {t(keys.suggest)}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t(keys.suggestHint)}</TooltipContent>
        </Tooltip>
      ) : null}
      {messaging && onBook ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t(keys.book)}
              data-testid={ids.book}
              onClick={onBook}
              className="text-muted-foreground-strong hover:bg-muted hover:text-foreground flex size-7.5 items-center justify-center rounded-lg"
            >
              <Calendar aria-hidden="true" className="size-3.75" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t(keys.bookHint)}</TooltipContent>
        </Tooltip>
      ) : null}
      <span className="flex-1" />
      <button
        type="button"
        data-testid={ids.send}
        onClick={onSend}
        className={cn(
          'text-background text-detail inline-flex h-7.5 items-center gap-1.5 rounded-lg ps-2.5 pe-3 font-medium whitespace-nowrap transition-colors duration-200',
          MODE_PAINT[mode].fill,
        )}
      >
        <Send aria-hidden="true" className="size-3.25" />
        {t(SEND_LABELS[mode])}
      </button>
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
