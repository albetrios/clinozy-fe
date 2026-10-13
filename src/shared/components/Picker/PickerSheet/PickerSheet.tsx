import type { KeyboardEventHandler, ReactElement, ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/components/ui/drawer.tsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

/**
 * The phone bottom sheets that share this surface (KICKOFF §3.5 Bottom sheet):
 * the picker list rises to 72% over a dimmed layer; Filters to 82% over a
 * transparent one. Either way a tap outside closes it.
 */
const SHEET_VARIANTS = {
  picker: {
    height: 'data-[vaul-drawer-direction=bottom]:max-h-[72%]',
    layer: 'bg-overlay/40',
  },
  filters: {
    height: 'data-[vaul-drawer-direction=bottom]:max-h-[82%]',
    layer: 'bg-transparent',
  },
  /** The patient file's sections: 85vh over a transparent layer (H:139–140). */
  sections: {
    height: 'data-[vaul-drawer-direction=bottom]:max-h-[85vh]',
    layer: 'bg-transparent',
  },
} as const;

/** Which bottom sheet {@link PickerSheet} becomes below `md`. */
type PickerSheetVariant = keyof typeof SHEET_VARIANTS;

/** Props for {@link PickerSheet}. */
export interface PickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The trigger button; it receives the open/close wiring (`asChild`). */
  trigger: ReactElement;
  /** Extra key handling merged onto the trigger (e.g. ↓ opens). */
  onTriggerKeyDown?: KeyboardEventHandler<HTMLElement>;
  /** The surface's accessible name (the sheet's sr-only title). */
  title: string;
  align?: 'start' | 'end';
  /** Popover classes (width, max height, padding). */
  panelClassName?: string;
  /** Extra bottom-sheet classes. */
  sheetClassName?: string;
  /**
   * The phone sheet: the picker's 72% (dimmed), Filters' 82% or the patient
   * file's sections' 85vh (both undimmed); `picker` by default.
   */
  sheet?: PickerSheetVariant;
  /** The popover's gap below its trigger in px (6 by default; the file's sections 8). */
  sideOffset?: number;
  /** Focus placement on open (the default focuses nothing). */
  onOpenAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  /** The panel's test id (the same at every tier). */
  testId?: string;
  children: ReactNode;
}

/**
 * The picker's surface: a `popover` from `md` up, below it the 72% bottom
 * sheet (shadcn `drawer`) over a dimmed `bg-overlay/40` layer that closes on a
 * tap (H:39–40; `_patterns.md:81`) — or, as `sheet="filters"`, the Filters
 * sheet: 82% over a transparent layer (H:41–42; `_patterns.md:110`), and as
 * `sheet="sections"` the patient file's sections, 85vh, also undimmed
 * (H:139–140). The sheet
 * is full width with a 16px top radius, no bottom border, safe-area padding
 * and the 260ms `sheet-up` rise; its title is sr-only because the design draws
 * none. Both surfaces are modal, so an outside click or tap closes it without
 * reaching what is underneath — the design's "Close list" / "Close filters"
 * layer. Both open at the overlays' own z-50 and stack by portal order, so a
 * list inside a drawer or a dialog lands on top of it.
 */
export function PickerSheet({
  open,
  onOpenChange,
  trigger,
  onTriggerKeyDown,
  title,
  align = 'start',
  panelClassName,
  sheetClassName,
  sheet = 'picker',
  sideOffset = 6,
  onOpenAutoFocus,
  onEscapeKeyDown,
  testId,
  children,
}: PickerSheetProps) {
  const tier = useViewportTier();
  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
    onOpenAutoFocus?.(event);
  };

  if (tier === 'phone') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} handleOnly>
        <DrawerTrigger asChild onKeyDown={onTriggerKeyDown}>
          {trigger}
        </DrawerTrigger>
        <DrawerContent
          showHandle={false}
          aria-describedby={undefined}
          data-testid={testId}
          data-picker-surface="sheet"
          onOpenAutoFocus={handleOpenAutoFocus}
          onEscapeKeyDown={onEscapeKeyDown}
          overlayClassName={cn(SHEET_VARIANTS[sheet].layer, 'animate-none!')}
          className={cn(
            'data-[state=open]:animate-sheet-up! pb-[env(safe-area-inset-bottom)] data-[state=closed]:animate-none! data-[vaul-drawer-direction=bottom]:rounded-t-2xl',
            SHEET_VARIANTS[sheet].height,
            sheetClassName,
          )}
        >
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        aria-label={title}
        data-testid={testId}
        data-picker-surface="popover"
        onOpenAutoFocus={handleOpenAutoFocus}
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          'data-[state=open]:data-[side=bottom]:animate-dropdown-in data-[state=open]:data-[side=top]:animate-dropdown-up flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg p-0 data-[state=closed]:data-[side]:animate-none',
          panelClassName,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
