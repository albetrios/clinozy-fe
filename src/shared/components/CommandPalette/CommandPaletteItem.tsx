import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { CommandItem as CommandRow } from '@/shared/components/ui/command.tsx';
import { Spinner } from '@/shared/components/ui/spinner.tsx';
import type { AppIcon } from '@/shared/icons/index.ts';

/**
 * One command-menu row (H:2674): 40px, `rounded-lg` — a 15px muted icon, the
 * title (13.5px / 500) and an optional sub at the inline end (12px, muted, at
 * most 45%). The active row takes `bg-muted`; a destructive row (Log out) is
 * red, icon included, on the destructive tint when active — the Account menu's
 * Log out. It keeps cmdk's own `command-item` slot, as the Picker's rows do:
 * the `menu-item` slot's `--radius-md` would round it 6px, not the design's
 * 8px. The title and the sub read in their own direction — a patient's name,
 * "#3508 · •••• 3212" — the title still aligned as the row is.
 */
export function CommandItem({
  children,
  icon: Icon,
  onSelect,
  value,
  sub,
  destructive = false,
  mirrored = false,
  busy = false,
  disabled = false,
  testId,
}: {
  children: ReactNode;
  icon: AppIcon;
  onSelect: () => void;
  /** cmdk's value — unique across the menu; the active row follows it. */
  value?: string;
  /** The muted text at the row's inline end ("Leads", "#3508 · •••• 3212"). */
  sub?: string;
  destructive?: boolean;
  /** Mirror the icon under RTL (a chevron that points along the reading direction). */
  mirrored?: boolean;
  /** This row's own work is in flight: swaps the icon for a spinner. */
  busy?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <CommandRow
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      aria-busy={busy || undefined}
      data-testid={testId}
      className={cn(
        'text-field h-10 cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 font-medium transition-colors duration-120',
        'data-[selected=true]:bg-muted data-[selected=true]:text-foreground',
        'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
        destructive &&
          'text-destructive data-[selected=true]:bg-destructive-tint data-[selected=true]:text-destructive',
      )}
    >
      {busy ? (
        <Spinner data-testid="command-palette-item-spinner" />
      ) : (
        <Icon
          aria-hidden="true"
          className={cn(
            'size-3.75',
            destructive ? 'text-destructive' : 'text-muted-foreground',
            mirrored && 'rtl:rotate-180',
          )}
        />
      )}
      <span dir="auto" className="min-w-0 flex-1 truncate [text-align:match-parent]">
        {children}
      </span>
      {sub ? (
        <span
          dir="auto"
          className="text-muted-foreground max-w-[45%] flex-none truncate text-xs font-normal tabular-nums"
        >
          {sub}
        </span>
      ) : null}
    </CommandRow>
  );
}
