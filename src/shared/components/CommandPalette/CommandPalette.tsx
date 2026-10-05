import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { isCommandSearchQuery } from '@/shared/api/clinic/command-search-api.ts';
import type { ClinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command.tsx';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useDeploymentFlags } from '@/shared/hooks/useDeploymentFlags/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { Search } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  type ClinicCommandGroups,
  NO_CLINIC_COMMANDS,
  useClinicCommandGroups,
} from './clinic-command-groups.ts';
import { COMMAND_MENU_KEYS, COMMAND_MENU_NS } from './command-palette.constants.ts';
import {
  COMMAND_SEARCH_CLASS,
  COMMAND_SEARCH_ICON_CLASS,
  COMMAND_SEARCH_MAX_LENGTH,
  COMMAND_SEARCH_ROW_CLASS,
  useCommandPaletteSearch,
} from './command-palette-context.ts';
import { isSelectionMove, useCommandSelection } from './command-palette-model.ts';
import { CommandPaletteFooter } from './CommandPaletteFooter.tsx';
import { CommandPaletteGroup } from './CommandPaletteGroup.tsx';
import { CommandPaletteKbd } from './CommandPaletteKbd.tsx';
import { CommandPaletteOrgGroup } from './CommandPaletteOrgGroup.tsx';
import { CommandPaletteShell } from './CommandPaletteShell.tsx';
import { usePlatformCommandGroups } from './platform-command-groups.ts';

/** The empty line (H:2675): 32px 16px, centred, 13px muted. */
const EMPTY_CLASS = 'text-muted-foreground text-body px-4 py-8 text-center';

/**
 * Global command palette powered by cmdk.
 * Activated via Cmd+K (Mac) or Ctrl+K (Windows/Linux).
 */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  if (!open) return null;
  return (
    <CommandPaletteShell>
      <CommandPaletteContent />
    </CommandPaletteShell>
  );
}

/**
 * Deferred command engine and results inside the persistent search shell — the
 * design's command menu (KICKOFF §6.0; `_patterns.md:195–207`; H:4598–4611).
 * Inside an organization the clinic groups lead; a personal workspace has no
 * clinic, so it lists the platform rows alone and runs no clinic query.
 */
export function CommandPaletteContent() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const { organizationSlug = '' } = useParams({ strict: false });
  if (!open) return null;
  return organizationSlug ? (
    <OrganizationCommandMenu organizationSlug={organizationSlug} />
  ) : (
    <PersonalCommandMenu />
  );
}

/** Close the palette, then run a command — or navigate. */
function usePaletteCommands() {
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );
  const go = useCallback(
    (navigation: ClinicCommandNavigation) => runCommand(() => navigate(navigation)),
    [navigate, runCommand],
  );
  return { runCommand, go };
}

function OrganizationCommandMenu({ organizationSlug }: { organizationSlug: string }) {
  const { query } = useCommandPaletteSearch();
  // The same entries as the shell's nav: manifest-driven, and narrowed by the
  // member's clinic access and any View-as preview.
  const { entries } = useAppNav();
  const { go } = usePaletteCommands();
  const clinic = useClinicCommandGroups({
    query,
    organizationSlug,
    navEntries: entries,
    go,
  });
  return <CommandMenu organizationSlug={organizationSlug} clinic={clinic} />;
}

function PersonalCommandMenu() {
  return <CommandMenu organizationSlug="" clinic={NO_CLINIC_COMMANDS} />;
}

/**
 * The menu itself. The clinic groups lead: "Actions" alone until something is
 * typed, then "Go to" and, from two characters, Patients / Leads / Invoices.
 * The platform rows (settings, workspaces, shortcuts, theme, sign out) follow
 * once typing — the relocation table keeps them here (§3.2) — or at once
 * where the clinic offers nothing.
 */
function CommandMenu({
  organizationSlug,
  clinic,
}: {
  organizationSlug: string;
  clinic: ClinicCommandGroups;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tMenu } = useTranslation(COMMAND_MENU_NS);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const { query } = useCommandPaletteSearch();
  const { data: meContext } = useMeContext();
  const deploymentFlags = useDeploymentFlags();
  const { runCommand } = usePaletteCommands();
  const inOrganization = organizationSlug !== '';
  const platform = usePlatformCommandGroups({ query, runCommand });
  const selection = useCommandSelection(query, clinic.groups[0]?.rows[0]?.value);
  const closePalette = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const cp = LAYOUT_KEYS.app.commandPalette;
  const typed = query.trim();
  // The design's empty query shows Actions alone (H:4600); the platform rows
  // join once typing — or at once, when the clinic has nothing to offer.
  const showPlatform = typed !== '' || clinic.groups.length === 0;
  // The clinic's empty line names what it searches, and waits for the search
  // to answer — "No matches" never flashes ahead of the rows.
  let empty: string | null = t(cp.empty);
  if (clinic.searchable) {
    empty = typed && !clinic.isSearching ? tMenu(COMMAND_MENU_KEYS.empty) : null;
  }
  const hint =
    clinic.searchable && !isCommandSearchQuery(typed)
      ? tMenu(COMMAND_MENU_KEYS.hint)
      : null;

  return (
    <Command
      // cmdk names its input through this label (an `aria-labelledby` that
      // outranks `aria-label`): the design's "Search" (H:2672).
      label={t(LAYOUT_KEYS.app.search)}
      shouldFilter={false}
      loop
      value={selection.value}
      onValueChange={selection.onValueChange}
      // Esc belongs to the shell's dialog — the top-most layer takes it.
      onKeyDown={(event) => {
        if (isSelectionMove(event)) selection.markMoved();
      }}
      className="flex min-h-0 flex-1 flex-col rounded-none bg-transparent"
    >
      <CommandPaletteInput searching={clinic.isSearching} />

      <CommandList
        label={inOrganization ? tMenu(COMMAND_MENU_KEYS.results) : undefined}
        onPointerMove={selection.markMoved}
        className="max-h-none min-h-0 flex-1 scroll-py-1.5 p-1.5"
      >
        {empty ? (
          <CommandEmpty data-testid="command-palette-empty" className={EMPTY_CLASS}>
            {empty}
          </CommandEmpty>
        ) : null}

        {clinic.groups.map((group) => (
          <CommandPaletteGroup key={group.id} group={group} />
        ))}

        {showPlatform ? (
          <>
            {platform.leading.map((group) => (
              <CommandPaletteGroup key={group.id} group={group} />
            ))}
            {meContext ? (
              <CommandPaletteOrgGroup
                personalOrganizationsEnabled={deploymentFlags.personalOrganizations}
                heading={t(cp.groups.organizations)}
                currentOrganizationLabel={(name) => t(cp.currentOrganization, { name })}
                switchOrganizationLabel={(name) => t(cp.switchOrganization, { name })}
                closePalette={closePalette}
                navigate={navigate}
                query={typed}
              />
            ) : null}
            {platform.trailing.map((group) => (
              <CommandPaletteGroup key={group.id} group={group} />
            ))}
          </>
        ) : null}
      </CommandList>

      {inOrganization ? <CommandPaletteFooter hint={hint} /> : null}
    </Command>
  );
}

/** The 52px input row (H:2672): search mark · input ("Search or jump to…") · "esc". */
function CommandPaletteInput({ searching }: { searching: boolean }) {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const { query, setQuery, searchFocus, rememberFocus } = useCommandPaletteSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (searchFocus.current.focused && input) {
      input.focus();
      if (searchFocus.current.start !== null) {
        input.setSelectionRange(searchFocus.current.start, searchFocus.current.end);
      }
    }
  }, [searchFocus]);

  return (
    <CommandInput
      wrapperClassName={COMMAND_SEARCH_ROW_CLASS}
      icon={<Search aria-hidden="true" className={COMMAND_SEARCH_ICON_CLASS} />}
      trailing={
        <>
          {searching ? (
            <span
              aria-hidden="true"
              data-slot="pill"
              data-testid="command-palette-searching"
              className="border-border border-t-foreground animate-spinner size-3.5 flex-none rounded-full border-2"
            />
          ) : null}
          <CommandPaletteKbd>{tPicker(PICKER_KEYS.escKey)}</CommandPaletteKbd>
        </>
      }
      data-slot="input"
      data-testid="command-palette-search"
      placeholder={t(LAYOUT_KEYS.app.commandPalette.placeholder)}
      maxLength={COMMAND_SEARCH_MAX_LENGTH}
      className={COMMAND_SEARCH_CLASS}
      ref={inputRef}
      value={query}
      onValueChange={setQuery}
      onFocus={() => {
        rememberFocus(true);
      }}
      onBlur={() => {
        rememberFocus(false);
      }}
    />
  );
}
