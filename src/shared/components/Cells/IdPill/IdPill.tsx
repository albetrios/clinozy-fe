import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils.ts';

/**
 * A record's display id ("#3508", "PAY-5512") as the design's 22px `bg-muted`
 * pill: 11.5px/500, tabular figures, `rounded-md` (H:684). Format the id with
 * `displayId` from `@/shared/api/app/app-display-id.ts`.
 */
export function IdPill({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="id-pill"
      className={cn(
        'bg-muted text-muted-foreground-strong text-caption inline-flex h-5.5 w-fit shrink-0 items-center rounded-md px-1.75 font-medium whitespace-nowrap tabular-nums',
        className,
      )}
      {...props}
    />
  );
}
