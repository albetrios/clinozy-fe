import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils.ts';
import { roomToolbarTestIds } from '@/shared/components/RoomToolbar/room-toolbar.constants.ts';

/** One sub-view of the selected tab. */
export interface RoomView {
  /** The view's value — the React key and the test id (`<prefix>-view-<id>`). */
  id: string;
  label: string;
}

/** Props for {@link RoomViewBar}. */
export interface RoomViewBarProps {
  /** The tablist's accessible name ("Invoice type"). */
  label: string;
  views: readonly RoomView[];
  /** The current view's id. */
  value: string;
  onValueChange: (id: string) => void;
  /** The id of the list the views filter (each tab's `aria-controls`). */
  controls?: string;
  /** That view's chips (e.g. `FilterChip`s), after a 1px divider. */
  children?: ReactNode;
  /** The chips group's accessible name ("Expiring within"). */
  chipsLabel?: string;
  /** Test-id prefix — the room's table id. */
  testIdPrefix: string;
}

/**
 * The view bar under a room toolbar (KICKOFF §3.5 View bar; H:971, H:1365,
 * `_patterns.md:104`): the selected tab's sub-views as underlined 36px text
 * tabs (13px; the current one 600 with a 2px rule) 20px apart on a hairline,
 * then that view's chips after a divider. Wraps in place on a phone. In-page
 * views, so tabs — the Radix `Tabs` shadcn's `tabs` wraps, drawn as the
 * design's underline: arrows move, Enter or Space opens a view.
 */
export function RoomViewBar({
  label,
  views,
  value,
  onValueChange,
  controls,
  children,
  chipsLabel,
  testIdPrefix,
}: RoomViewBarProps) {
  const ids = roomToolbarTestIds(testIdPrefix);
  return (
    <div
      data-slot="room-view-bar"
      data-testid={ids.viewBar}
      className="mx-(--room-header-pad-x) mb-3 flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-b"
    >
      <TabsPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        activationMode="manual"
        className="min-w-0"
      >
        <TabsPrimitive.List aria-label={label} className="flex flex-wrap gap-x-5">
          {views.map((view) => (
            <TabsPrimitive.Trigger
              key={view.id}
              value={view.id}
              aria-controls={controls}
              data-testid={ids.view(view.id)}
              data-slot="room-view"
              className={cn(
                'text-body -mb-px h-9 flex-none border-b-2 px-0.5 transition-colors duration-120',
                view.id === value
                  ? 'border-primary text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground border-transparent font-medium',
              )}
            >
              {view.label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>
      </TabsPrimitive.Root>
      {children ? (
        <div
          role="group"
          aria-label={chipsLabel}
          className="flex flex-wrap items-center gap-1.5 border-s ps-4"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
