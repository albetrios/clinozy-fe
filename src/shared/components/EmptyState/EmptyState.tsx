import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';

export interface EmptyStateProps {
  /** Optional leading icon (rendered ~40px, muted). */
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  /** Optional primary action (e.g. an "Invite member" button). */
  action?: ReactNode;
  className?: string;
}

/**
 * Centered empty-state for lists/panels with no data yet (no members, no roles,
 * empty search). Pairs with `Skeleton` (loading) and the route error boundary
 * (error) to make every data surface cover loading / empty / error.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-testid="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div
          className="text-muted-foreground [&_svg]:h-10 [&_svg]:w-10"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-foreground text-base font-medium">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-sm text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
