import type { ComponentProps, Ref } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import type { AppIcon } from '@/shared/icons/index.ts';

/** Props of {@link RoomViewAction}. */
export interface RoomViewActionProps extends ComponentProps<'button'> {
  /** Stable id — the test id (`<table id>-view-action-<id>`). */
  actionId: string;
  icon: AppIcon;
  label: string;
  /** The room's table id — the test-id prefix. */
  tableId: string;
  /**
   * Below `xl` the icon alone, named by its tooltip and accessible name — a
   * Medical view action, where the toolbar is short (default). Off, the label
   * always shows (Clinic stock's "Stock check").
   */
  collapse?: boolean;
  /** The glyph's size and ink (default 14px in the label's ink). */
  iconClassName?: string;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A room's own toolbar button (`medical.md:17`, `clinic-stock.md:17`; H:1299,
 * H:5438–5443): 36px, outline, 13px/500, its icon 6px before the label —
 * Medical's view action for the filter state, Clinic stock's "Stock check".
 * With `collapse` it is the icon alone below `xl`.
 */
export function RoomViewAction({
  actionId,
  icon: Icon,
  label,
  tableId,
  collapse = true,
  iconClassName,
  className,
  ...props
}: RoomViewActionProps) {
  const button = (
    <button
      type="button"
      aria-label={collapse ? label : undefined}
      data-testid={`${tableId}-view-action-${actionId}`}
      {...props}
      className={cn(
        'text-body text-foreground bg-background hover:bg-muted border-border flex h-9 flex-none items-center justify-center gap-1.5 rounded-lg border leading-none font-medium whitespace-nowrap transition-colors duration-120',
        collapse ? 'max-xl:w-9 xl:ps-2.5 xl:pe-3' : 'ps-2.5 pe-3',
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn('size-3.5 flex-none', iconClassName)} />
      <span className={cn(collapse && 'max-xl:sr-only')}>{label}</span>
    </button>
  );
  if (!collapse) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent className="xl:hidden">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
