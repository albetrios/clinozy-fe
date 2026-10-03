import type { ReactNode } from 'react';

import { CommandGroup } from '@/shared/components/ui/command.tsx';

import type { CommandRowGroup } from './command-palette-model.ts';
import { CommandItem } from './CommandPaletteItem.tsx';

/**
 * A command-menu group: the rows sit flush in the list's 6px padding, no
 * separators between groups. The heading wrapper keeps the primitive's 8px /
 * 6px padding and muted ink; only its bottom drops to the design's 4px.
 */
export const COMMAND_GROUP_CLASS = 'overflow-visible p-0 [&_[cmdk-group-heading]]:pb-1';

/**
 * The design's group header (H:2674): 11px / 600 uppercase with 0.05em
 * tracking, padded 10px 10px 4px with its wrapper — 27px, its 13px line the
 * prototype's `normal` (the self-hosted Inter's own `normal` sets 14px).
 */
export function CommandPaletteHeading({ children }: { children: ReactNode }) {
  return (
    <span className="text-micro block px-0.5 pt-1 leading-[1.2] font-semibold tracking-[0.05em] uppercase">
      {children}
    </span>
  );
}

/** One headed group of command-menu rows. */
export function CommandPaletteGroup({ group }: { group: CommandRowGroup }) {
  return (
    <CommandGroup
      heading={<CommandPaletteHeading>{group.heading}</CommandPaletteHeading>}
      className={COMMAND_GROUP_CLASS}
      data-testid={`command-palette-group-${group.id}`}
    >
      {group.rows.map((row) => (
        <CommandItem
          key={row.value}
          value={row.value}
          icon={row.icon}
          sub={row.sub}
          onSelect={row.onSelect}
          destructive={row.destructive}
          testId={row.testId}
        >
          {row.label}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
