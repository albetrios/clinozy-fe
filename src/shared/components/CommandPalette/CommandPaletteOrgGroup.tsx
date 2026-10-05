import type { NavigateFn } from '@tanstack/react-router';
import { useRef, useState } from 'react';

import { organizationHome, organizationPicker } from '@/lib/routes/index.ts';
import { CommandGroup } from '@/shared/components/ui/command.tsx';
import { mapApiError, reportError } from '@/shared/errors/errorHandler.ts';
import { Building, Check, User } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import type { OrganizationSummary } from '@/shared/tenancy/me-context.ts';
import { useMyOrganizationSummaries } from '@/shared/tenancy/my-organization-summaries.ts';
import { switchToPersonal } from '@/shared/tenancy/switch.ts';

import { matchesCommandQuery } from './command-palette-model.ts';
import { COMMAND_GROUP_CLASS, CommandPaletteHeading } from './CommandPaletteGroup.tsx';
import { CommandItem } from './CommandPaletteItem.tsx';

/** Stable id for the switch-failed toast (house rule 7) — retries replace it. */
export const PALETTE_SWITCH_TOAST_ID = 'command-palette-switch-failed';

interface CommandPaletteOrgGroupProps {
  heading: string;
  currentOrganizationLabel: (name: string) => string;
  switchOrganizationLabel: (name: string) => string;
  /** Dismiss the palette. Held until the switch resolves, not fired on select. */
  closePalette: () => void;
  navigate: NavigateFn;
  /** Whether this deployment has personal workspaces at all. */
  personalOrganizationsEnabled: boolean;
  /** The menu's query: only the workspaces whose row label contains it are listed. */
  query?: string;
}

/** Organization switcher entries for the command palette. */
export function CommandPaletteOrgGroup({
  heading,
  currentOrganizationLabel,
  switchOrganizationLabel,
  closePalette,
  navigate,
  personalOrganizationsEnabled,
  query = '',
}: CommandPaletteOrgGroupProps) {
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const switchingRef = useRef(false);
  const organizations = useMyOrganizationSummaries().data ?? [];

  // A personal workspace has no slug — no `/organization/<slug>` reaches it, so
  // switching to it lands on the `/organization` picker. The old
  // `.filter((org) => org.slug)` therefore dropped it silently: the one
  // workspace a user cannot navigate to by URL was the one the palette would
  // not list (SHELL-12).
  const entries = organizations.filter((org) =>
    org.type === 'PERSONAL' ? personalOrganizationsEnabled : Boolean(org.slug),
  );

  // Gate on what is actually rendered, not on the raw list: with the personal
  // workspace filtered out, the old check still let a group through containing
  // nothing but the current org — a heading over a single dead row.
  if (entries.length <= 1) return null;

  const label = (org: OrganizationSummary & { isActive: boolean }) =>
    org.isActive ? currentOrganizationLabel(org.name) : switchOrganizationLabel(org.name);
  // The menu filters its own rows (cmdk's filter is off): a workspace answers
  // the query by its row label, as every other row does.
  const shown = entries.filter((org) =>
    matchesCommandQuery(label(org), undefined, query),
  );
  if (shown.length === 0) return null;

  const select = (org: OrganizationSummary & { isActive: boolean }) => {
    // Re-picking the current workspace does no work, so it must not arm the
    // latch — it just dismisses the palette.
    if (org.isActive) {
      closePalette();
      return;
    }
    // Synchronous single-flight latch (house rule 1). Switching re-mints the
    // GLOBAL access token, and dismissing the palette does NOT prevent a
    // same-frame double-fire: both handlers run before React unmounts the row.
    // Measured at 2 POSTs for one gesture before this latch.
    if (switchingRef.current) return;
    switchingRef.current = true;
    setSwitchingId(org.id);

    const go = async () => {
      if (org.type === 'PERSONAL') {
        await switchToPersonal();
        // No slug to drive the guard, so the switch has to happen first —
        // mirrors what OrganizationSwitcher does for the same destination.
        await navigate(organizationPicker());
      } else {
        if (!org.slug) return;
        await navigate(organizationHome(org.slug));
      }
      // Dismiss only once the destination is actually mounted. Dismissing on
      // select is what made a switch look like nothing at all: the palette
      // vanished and the screen sat unchanged for the whole round trip.
      closePalette();
    };

    go().catch((error: unknown) => {
      // Only a failure re-arms: a successful switch is replacing this screen.
      switchingRef.current = false;
      setSwitchingId(null);
      reportError(error, {
        scope: 'command-palette-org-switch',
        organizationId: org.id,
        organizationType: org.type,
      });
      notify.error(mapApiError(error), { id: PALETTE_SWITCH_TOAST_ID });
    });
  };

  return (
    <CommandGroup
      heading={<CommandPaletteHeading>{heading}</CommandPaletteHeading>}
      className={COMMAND_GROUP_CLASS}
    >
      {shown.map((org) => {
        let icon = Building;
        if (org.isActive) icon = Check;
        else if (org.type === 'PERSONAL') icon = User;
        return (
          <CommandItem
            key={org.id}
            value={`workspace:${org.id}`}
            onSelect={() => select(org)}
            icon={icon}
            busy={switchingId === org.id}
            // While one switch is in flight the others are not choices: the
            // latch would drop them silently, which reads as a dead click.
            disabled={switchingId !== null && switchingId !== org.id}
            testId={`command-palette-org-${org.slug ?? 'personal'}`}
          >
            {label(org)}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
