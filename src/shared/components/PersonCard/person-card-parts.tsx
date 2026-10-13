import { type ReactElement, type ReactNode, useId } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';

/** A card control's tooltip — the app's one tooltip (every icon button gets one). */
export function Hint({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A card section: its 11px/600 uppercase label ("Reach", "Team", "About") names
 * the group for assistive technology; `aside` sits at the label row's end.
 */
export function CardGroup({
  label,
  aside,
  className,
  children,
}: {
  label: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <fieldset
      aria-labelledby={id}
      className={cn('m-0 flex min-w-0 flex-col border-0 p-0', className)}
    >
      <div className="flex items-center gap-1.5">
        <span
          id={id}
          className="text-micro text-muted-foreground leading-[1.2] font-semibold tracking-wider uppercase"
        >
          {label}
        </span>
        {aside}
      </div>
      {children}
    </fieldset>
  );
}
