import type { TFunction } from 'i18next';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Plus, Search } from '@/shared/icons/index.ts';

import { EMPTY_STATE_KEYS, EMPTY_STATE_NS } from './empty-state.constants.ts';
import { EMPTY_STATE_ART_ACCENTS } from './empty-state-art.ts';

/** Props for {@link EmptyState}: copy, icon and action, plus the room tone and filtered state. */
export interface EmptyStateProps {
  /**
   * Leading icon: the list's own glyph in the illustrated tile (24px in the room
   * look, 18px compact), else ~40px and muted.
   */
  icon?: ReactNode;
  /** Defaults to "Nothing here yet". */
  title?: string;
  /**
   * The title's heading level — 3 inside a room or panel; 1 when the empty state
   * IS the page (the suspended screen, an invitation's outcome), so it names
   * the page. The dashed `card` variant lives inside a thread and keeps its `h3`;
   * the `inline` one-liner is a paragraph, not a heading.
   */
  headingLevel?: 1 | 2 | 3;
  description?: ReactNode;
  /** Optional action — `EmptyStateAction` is the design's 36px primary button. */
  action?: ReactNode;
  className?: string;
  /**
   * The list's tone. Draws the colourful illustration (change-empty-states):
   * a 96px ring dashed in the tone's border, the tinted 68px disc, a 44px tile
   * filled with the tone's bright dot colour with the icon knocked out, and three dots — the
   * tone's own and two accents. The room look takes `my-auto`, so a growing
   * column centres it. Without a tone the plain icon look stays.
   */
  tone?: Tone;
  /**
   * Filters are applied: the `Search` icon, "No matches", the fixed hint and a
   * "Clear filters" button that calls this (KICKOFF §6.0 Filtered empty).
   */
  onClearFilters?: () => void;
  /**
   * `card`: the dashed card a thread shows before its first message (KICKOFF
   * §3.5 Chat column › Empty) — a 12.5px title, a 12px line and the actions
   * in a wrapping, centred row of chips. `inline`: the muted one-liner in
   * place of a list's or a card's rows ("No notes yet", "No snoozed tasks") —
   * 12.5px by default, sized, spaced and aligned to its spec by `className`,
   * an action (a link, a button) following the line — kept for lines that are
   * not an empty list (search results, notices). `compact`: an empty list inside
   * a populated screen — the 48px art (needs `tone` and `icon`) over a one-line
   * title, centred. Without it, the room or plain look.
   */
  variant?: 'card' | 'inline' | 'compact';
  /**
   * The empty state sits on its own tone's tint (a Today lane panel): the art's
   * disc takes the card colour so it still reads against the tint.
   */
  tinted?: boolean;
  /** Test id (default `empty-state`). */
  testId?: string;
}

/** The title's element per `headingLevel`. */
const HEADING_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3' } as const;

/**
 * The design's 36px primary empty-state button, a 14px `Plus` before the label by
 * default. `asChild` lends its look to a link (`<Link>` as the only child) and
 * draws no icon — a navigation, not a create.
 */
export function EmptyStateAction({
  icon = <Plus className="size-3.5" />,
  className,
  children,
  asChild = false,
  ...props
}: ComponentProps<typeof Button> & { icon?: ReactNode }) {
  return (
    <Button
      type={asChild ? undefined : 'button'}
      asChild={asChild}
      data-testid="empty-state-action"
      // The button's 36px, 13px, rounded-lg default; the design's 6px gap.
      className={cn('gap-1.5', className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}

/** Which illustration to draw: the room's, the compact one, or the card's (no ring). */
export type EmptyStateArtSize = 'room' | 'compact' | 'card';

/**
 * Each size's box, disc, tile and icon (change-empty-states, `preset.md`), all
 * steps the app already ships, so the art adds no first-paint CSS (the size
 * budget, KICKOFF §8): the room's 96px ring, 68px disc and 44px tile; the
 * compact 48px dashed disc and 32px tile; the card's 44px disc and 28px tile.
 */
const ART_SIZES: Readonly<
  Record<EmptyStateArtSize, { box: string; disc: string; tile: string }>
> = {
  room: {
    box: 'mb-1 size-24',
    disc: 'inset-3.5',
    tile: 'size-11 rounded-2xl [&_svg]:size-6',
  },
  compact: { box: 'size-12', disc: '', tile: 'size-8 rounded-lg [&_svg]:size-4.5' },
  card: { box: 'size-11', disc: '', tile: 'size-7 rounded-md [&_svg]:size-3.5' },
};

/**
 * The decorative illustration in a tone: the ring dashed in its border colour,
 * the tinted disc, the tile filled with its bright dot colour holding the icon
 * in the page's background colour, and its dots — the room look scatters three (its own and
 * two accents), the smaller ones one accent. Exported for an empty state that
 * is itself a control (the patient overview's "log feedback" card), which draws
 * the art inside its own button.
 */
export function EmptyStateArt({
  tone,
  icon,
  size,
  tinted = false,
}: {
  tone: Tone;
  icon: ReactNode;
  size: EmptyStateArtSize;
  tinted?: boolean;
}) {
  const paint = TONE_CLASSES[tone];
  const [first, second] = EMPTY_STATE_ART_ACCENTS[tone];
  const box = ART_SIZES[size];
  const disc = tinted ? 'bg-card' : paint.bg;
  return (
    <span
      aria-hidden="true"
      data-testid="empty-state-illustration"
      data-size={size}
      className={cn('relative flex shrink-0 items-center justify-center', box.box)}
    >
      {size === 'room' ? (
        <>
          <span
            data-slot="pill"
            className={cn(
              'absolute inset-0 rounded-full border-[1.5px] border-dashed',
              paint.border,
            )}
          />
          <span
            data-slot="pill"
            className={cn('absolute rounded-full', box.disc, disc)}
          />
        </>
      ) : (
        // The smaller looks fold the ring and the disc into one: the compact
        // disc keeps the dashed edge, the card's (inside a dashed card) has none.
        <span
          data-slot="pill"
          className={cn(
            'absolute inset-0 rounded-full',
            disc,
            size === 'compact' && cn('border-[1.5px] border-dashed', paint.border),
          )}
        />
      )}
      <span
        data-slot="empty-state-tile"
        className={cn(
          'text-background relative flex items-center justify-center shadow-xs',
          box.tile,
          paint.dot,
        )}
      >
        {icon}
      </span>
      {size === 'room' ? (
        <>
          <span
            className={cn('absolute end-2 top-2.5 size-2.5 rounded-full', paint.dot)}
          />
          <span
            className={cn(
              'absolute start-1.5 bottom-3.5 size-1.75 rounded-full',
              TONE_CLASSES[first].dot,
            )}
          />
          <span
            className={cn(
              'absolute start-4 top-2 size-1.25 rounded-full',
              TONE_CLASSES[second].dot,
            )}
          />
        </>
      ) : (
        <span
          className={cn(
            'absolute end-0.5 top-0.5 size-1.75 rounded-full',
            TONE_CLASSES[first].dot,
          )}
        />
      )}
    </span>
  );
}

/** The dashed card variant: title, line and a centred, wrapping row of chips. */
function EmptyStateCard({
  title,
  description,
  action,
  className,
  testId,
  tone,
  icon,
}: Pick<EmptyStateProps, 'description' | 'action' | 'className' | 'tone' | 'icon'> & {
  title: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      data-variant="card"
      className={cn(
        'border-border-strong bg-card flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-4.5 text-center',
        className,
      )}
    >
      {tone && icon ? <EmptyStateArt tone={tone} icon={icon} size="card" /> : null}
      <h3 className="text-detail text-foreground-soft leading-[1.3] font-semibold">
        {title}
      </h3>
      {description ? (
        <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="flex flex-wrap justify-center gap-1.5 pt-0.5">{action}</div>
      ) : null}
    </div>
  );
}

/**
 * The inline variant: one muted line — its action, when it has one, inside
 * the same paragraph, so "No results · clear the search" reads as one line
 * and a column layout (`flex flex-col`) stacks it under the words.
 */
function EmptyStateInline({
  title,
  description,
  action,
  className,
  testId,
}: Pick<EmptyStateProps, 'description' | 'action' | 'className'> & {
  title: string;
  testId: string;
}) {
  return (
    <p
      data-testid={testId}
      data-variant="inline"
      className={cn('text-detail text-muted-foreground', className)}
    >
      {title}
      {description ? <span className="block">{description}</span> : null}
      {action}
    </p>
  );
}

/**
 * The compact variant: an empty list inside a populated screen — the 48px art
 * in the list's tone over a one-line title (a paragraph, not a heading), an
 * optional muted line and action, centred in its card (`my-auto` in a growing
 * column). Without a tone or an icon it falls back to the muted one-liner.
 */
function EmptyStateCompact({
  title,
  description,
  action,
  className,
  testId,
  tone,
  icon,
}: Pick<EmptyStateProps, 'description' | 'action' | 'className' | 'tone' | 'icon'> & {
  title: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      data-variant="compact"
      data-tone={tone}
      className={cn(
        'my-auto flex flex-col items-center gap-2 px-4 py-6 text-center',
        className,
      )}
    >
      {tone && icon ? <EmptyStateArt tone={tone} icon={icon} size="compact" /> : null}
      <p className="text-body text-foreground-soft leading-snug font-medium text-pretty">
        {title}
      </p>
      {description ? (
        <p className="text-muted-foreground max-w-80 text-xs leading-normal text-pretty">
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="flex flex-wrap justify-center gap-1.5">{action}</div>
      ) : null}
    </div>
  );
}

/**
 * What the room and plain looks show: with `onClearFilters`, the filtered
 * state's fixed copy and its "Clear filters" button; otherwise the caller's
 * icon, title (else "Nothing here yet"), line and action.
 */
function shownContent(
  {
    icon,
    title,
    description,
    action,
    onClearFilters,
  }: Pick<
    EmptyStateProps,
    'icon' | 'title' | 'description' | 'action' | 'onClearFilters'
  >,
  t: TFunction,
) {
  if (onClearFilters === undefined) {
    return {
      shownIcon: icon,
      shownTitle: title ?? t(EMPTY_STATE_KEYS.fallbackTitle),
      shownDescription: description,
      shownAction: action,
    };
  }
  return {
    shownIcon: <Search />,
    shownTitle: t(EMPTY_STATE_KEYS.filteredTitle),
    shownDescription: t(EMPTY_STATE_KEYS.filteredHint),
    shownAction: (
      <EmptyStateAction
        icon={null}
        data-testid="empty-state-clear-filters"
        onClick={onClearFilters}
      >
        {t(EMPTY_STATE_KEYS.clearFilters)}
      </EmptyStateAction>
    ),
  };
}

/**
 * Centered empty-state for lists/panels with no data yet (no members, no roles,
 * empty search). Pairs with `Skeleton` (loading) and the route error boundary
 * (error) to make every data surface cover loading / empty / error. With a
 * `tone` it is the clinic rooms' colourful illustrated empty state, centred in
 * a growing column; with `onClearFilters` it is the filtered one;
 * `variant="compact"` is an empty list inside a populated screen;
 * `variant="card"` is a thread's dashed starter card; `variant="inline"` is a
 * one-liner for lines that are not an empty list.
 */
export function EmptyState({
  icon,
  title,
  headingLevel = 3,
  description,
  action,
  className,
  tone,
  onClearFilters,
  variant,
  tinted,
  testId = 'empty-state',
}: EmptyStateProps) {
  const { t } = useTranslation(EMPTY_STATE_NS);
  const Heading = HEADING_TAGS[headingLevel];
  if (variant === 'card' || variant === 'compact') {
    const Variant = variant === 'card' ? EmptyStateCard : EmptyStateCompact;
    return (
      <Variant
        title={title ?? t(EMPTY_STATE_KEYS.fallbackTitle)}
        description={description}
        action={action}
        className={className}
        testId={testId}
        tone={tone}
        icon={icon}
      />
    );
  }
  if (variant === 'inline') {
    return (
      <EmptyStateInline
        title={title ?? t(EMPTY_STATE_KEYS.fallbackTitle)}
        description={description}
        action={action}
        className={className}
        testId={testId}
      />
    );
  }
  const { shownIcon, shownTitle, shownDescription, shownAction } = shownContent(
    { icon, title, description, action, onClearFilters },
    t,
  );

  if (tone) {
    return (
      <div
        data-testid={testId}
        data-tone={tone}
        className={cn(
          'my-auto flex flex-col items-center gap-2.5 px-(--table-pad-x) py-12 text-center',
          className,
        )}
      >
        <EmptyStateArt tone={tone} icon={shownIcon} size="room" tinted={tinted} />
        <Heading className="text-foreground text-title leading-[1.2] font-semibold">
          {shownTitle}
        </Heading>
        {shownDescription ? (
          <p className="text-muted-foreground text-detail max-w-80 leading-normal text-pretty">
            {shownDescription}
          </p>
        ) : null}
        {shownAction ? <div className="mt-1.5">{shownAction}</div> : null}
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {shownIcon ? (
        <div
          className="text-muted-foreground [&_svg]:h-10 [&_svg]:w-10"
          aria-hidden="true"
        >
          {shownIcon}
        </div>
      ) : null}
      <div className="space-y-1">
        <Heading className="text-foreground text-base font-medium">{shownTitle}</Heading>
        {shownDescription ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
            {shownDescription}
          </p>
        ) : null}
      </div>
      {shownAction ? <div className="mt-1">{shownAction}</div> : null}
    </div>
  );
}
