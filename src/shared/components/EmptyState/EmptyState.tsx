import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Plus, Search } from '@/shared/icons/index.ts';

import { EMPTY_STATE_KEYS, EMPTY_STATE_NS } from './empty-state.constants.ts';

/** Props for {@link EmptyState}: copy, icon and action, plus the room tone and filtered state. */
export interface EmptyStateProps {
  /** Leading icon: the room icon in the illustrated tile (18px), else ~40px and muted. */
  icon?: ReactNode;
  /** Defaults to "Nothing here yet". */
  title?: string;
  description?: ReactNode;
  /** Optional action — `EmptyStateAction` is the design's 36px primary button. */
  action?: ReactNode;
  className?: string;
  /**
   * The room's tone. Draws the design's illustration — a 96px dashed ring, the
   * tinted 68px disc, a 40px card tile holding the icon, a 10px and a 6px dot
   * (H:695; `_patterns.md:283`). Without it the plain icon look stays.
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
   * an action (a link, a button) following the line. Without it, the room or
   * plain look.
   */
  variant?: 'card' | 'inline';
  /** Test id (default `empty-state`). */
  testId?: string;
}

/** The design's 36px primary empty-state button, a 14px `Plus` before the label by default. */
export function EmptyStateAction({
  icon = <Plus className="size-3.5" />,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { icon?: ReactNode }) {
  return (
    <Button
      type="button"
      data-testid="empty-state-action"
      className={cn(
        'text-body h-9 gap-1.5 rounded-lg px-3.5 has-[>svg]:px-3.5',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}

/** The dashed card variant: title, line and a centred, wrapping row of chips. */
function EmptyStateCard({
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
    <div
      data-testid={testId}
      data-variant="card"
      className={cn(
        'border-border-strong bg-card flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-4.5 text-center',
        className,
      )}
    >
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
 * the same paragraph, so "No appointments here · book one" reads as one line
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
 * Centered empty-state for lists/panels with no data yet (no members, no roles,
 * empty search). Pairs with `Skeleton` (loading) and the route error boundary
 * (error) to make every data surface cover loading / empty / error. With a
 * `tone` it is the clinic rooms' illustrated empty state; with
 * `onClearFilters` it is the filtered one; `variant="card"` is a thread's dashed
 * starter card; `variant="inline"` is a list's or a card's one-liner.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  tone,
  onClearFilters,
  variant,
  testId = 'empty-state',
}: EmptyStateProps) {
  const { t } = useTranslation(EMPTY_STATE_NS);
  if (variant === 'card' || variant === 'inline') {
    const Variant = variant === 'card' ? EmptyStateCard : EmptyStateInline;
    return (
      <Variant
        title={title ?? t(EMPTY_STATE_KEYS.fallbackTitle)}
        description={description}
        action={action}
        className={className}
        testId={testId}
      />
    );
  }
  const filtered = onClearFilters !== undefined;
  const shownIcon = filtered ? <Search /> : icon;
  const shownTitle = filtered
    ? t(EMPTY_STATE_KEYS.filteredTitle)
    : (title ?? t(EMPTY_STATE_KEYS.fallbackTitle));
  const shownDescription = filtered ? t(EMPTY_STATE_KEYS.filteredHint) : description;
  const shownAction = filtered ? (
    <EmptyStateAction
      icon={null}
      data-testid="empty-state-clear-filters"
      onClick={onClearFilters}
    >
      {t(EMPTY_STATE_KEYS.clearFilters)}
    </EmptyStateAction>
  ) : (
    action
  );

  if (tone) {
    const toneClasses = TONE_CLASSES[tone];
    return (
      <div
        data-testid={testId}
        data-tone={tone}
        className={cn(
          'flex flex-col items-center gap-2.5 px-(--table-pad-x) pt-16 pb-18 text-center',
          className,
        )}
      >
        <span
          aria-hidden="true"
          data-testid="empty-state-illustration"
          className="relative mb-1.5 flex size-24 items-center justify-center"
        >
          <span
            data-slot="pill"
            className="border-border absolute inset-0 rounded-full border-[1.5px] border-dashed"
          />
          <span
            data-slot="pill"
            className={cn('absolute inset-3.5 rounded-full', toneClasses.bg)}
          />
          <span
            data-slot="empty-state-tile"
            className={cn(
              'bg-card ring-border relative flex size-10 items-center justify-center rounded-xl shadow-xs ring-1 [&_svg]:size-4.5',
              toneClasses.ink,
            )}
          >
            {shownIcon}
          </span>
          <span
            className={cn(
              'absolute end-2 top-2.5 size-2.5 rounded-full',
              toneClasses.dot,
            )}
          />
          <span className="bg-border absolute start-1.5 bottom-3.5 size-1.5 rounded-full" />
        </span>
        <h3 className="text-foreground text-title leading-[1.2] font-semibold">
          {shownTitle}
        </h3>
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
        <h3 className="text-foreground text-base font-medium">{shownTitle}</h3>
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
