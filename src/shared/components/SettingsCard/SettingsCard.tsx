import { type ComponentProps, type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { AppIcon } from '@/shared/icons/index.ts';

/** Props of {@link SettingsCard}. */
export interface SettingsCardProps extends Omit<ComponentProps<'section'>, 'title'> {
  /** The card's heading — 13.5px/600, as a drawer step card's title. */
  title?: ReactNode;
  /** One line under the title — 12px, muted, as a step card's hint. */
  description?: ReactNode;
  /** What sits at the head's inline end: a status pill, a button, a shuffle. */
  action?: ReactNode;
  /** `danger`: the destructive hairline and title (an irreversible action). */
  variant?: 'default' | 'danger';
}

/**
 * One block of a settings surface (the Settings modal's panels, the Appearance
 * panel) in the launch's card anatomy: the list card's frame — a hairline,
 * 12px corners and the card elevation through the `card` slot, so every theme
 * axis reaches it — padded and headed like an open drawer step card
 * (`_patterns.md:44–45`: 14px 16px, compact 12px 14px; title 13.5px/600, hint
 * 12px muted). The head names the section for assistive tech.
 */
export function SettingsCard({
  title,
  description,
  action,
  variant = 'default',
  className,
  children,
  ...props
}: SettingsCardProps) {
  const titleId = useId();
  const hasHead = title !== undefined || action !== undefined;
  return (
    <section
      data-slot="card"
      aria-labelledby={title === undefined ? undefined : titleId}
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-(--step-pad)',
        variant === 'danger' && 'border-destructive-border',
        className,
      )}
      {...props}
    >
      {hasHead ? (
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            {title === undefined ? null : (
              <h3
                id={titleId}
                className={cn(
                  'text-field flex items-center gap-2 leading-[1.3] font-semibold',
                  variant === 'danger' && 'text-destructive',
                )}
              >
                {title}
              </h3>
            )}
            {description ? (
              <p className="text-muted-foreground text-xs leading-[1.45] text-pretty">
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Props of {@link SettingsList}. */
export interface SettingsListProps extends ComponentProps<'ul'> {
  /** Classes for the card frame around the list — the refresh dim, a top margin. */
  frameClassName?: string;
}

/**
 * A settings list (sessions, members, keys, webhooks, passkeys) as the launch's
 * list card: the card frame around rows split by the table's 1px `muted`
 * hairlines. The rows are {@link SettingsListRow}s.
 */
export function SettingsList({ frameClassName, className, ...props }: SettingsListProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground overflow-hidden rounded-xl border',
        frameClassName,
      )}
    >
      <ul className={cn('flex flex-col', className)} {...props} />
    </div>
  );
}

/**
 * A list row's leading tile — where a table row's primary cell has its 32px
 * avatar (`_patterns.md:125`), a device, key or endpoint row has its glyph on
 * a tone tile (stone by default, the design's fallback tone).
 */
export function SettingsRowTile({
  icon: Icon,
  tone = 'stone',
}: {
  icon: AppIcon;
  tone?: Tone;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        TONE_CLASSES[tone].surface,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

/**
 * One row of a {@link SettingsList}, as a table row (`_patterns.md:125`): 10px
 * top and bottom, the table's sides, a `muted` hairline under it and the
 * `canvas` hover (120ms).
 */
export function SettingsListRow({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      className={cn(
        'border-b-muted hover:bg-canvas flex min-w-0 items-center gap-3 border-b px-(--table-pad-x) py-2.5 transition-colors duration-120 last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}
