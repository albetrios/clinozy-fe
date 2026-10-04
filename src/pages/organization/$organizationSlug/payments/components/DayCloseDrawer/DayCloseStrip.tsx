import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';

/**
 * A Day close strip (`payments.md:73–80`; H:5110): cells of 150px and up that
 * fill the row (`auto-fit`) on 1px dividers, `rounded-xl`; below `md` two
 * equal columns — an odd last cell spans the row (H:156–157) through its own
 * `max-md:col-span-full`.
 */
export function DayCloseStrip({
  children,
  testId,
  className,
}: {
  children: ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One strip cell: the 11px uppercase label over its content, padded 10px 12px. */
export function StripCell({
  label,
  children,
  testId,
  className,
}: {
  label: string;
  children: ReactNode;
  testId: string;
  className?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn('bg-background flex min-w-0 flex-col gap-1 px-3 py-2.5', className)}
    >
      <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** A cell's 16px/600 figure. */
export function StripFigure({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('text-base leading-tight font-semibold tabular-nums', className)}>
      {children}
    </span>
  );
}

/** A cell's 11.5px sub line, one line with an ellipsis. */
export function StripSub({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('text-caption text-muted-foreground truncate', className)}>
      {children}
    </span>
  );
}
