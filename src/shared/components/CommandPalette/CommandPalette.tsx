import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { isCommandSearchQuery } from '@/shared/api/app/command-search-api.ts';
import type { AppCommandNavigation } from '@/shared/app/app-command-targets.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command.tsx';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useDeploymentFlags } from '@/shared/hooks/useDeploymentFlags/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { Pill, Search, X } from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  type AppCommandGroups,
  NO_APP_COMMANDS,
  type PrescribeMode,
  useAppCommandGroups,
} from './app-command-groups.ts';
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
  const navigate = useAppNavigate();
  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );
  const go = useCallback(
    (navigation: AppCommandNavigation) => runCommand(() => navigate(navigation)),
    [navigate, runCommand],
  );
  return { runCommand, go };
}

function OrganizationCommandMenu({ organizationSlug }: { organizationSlug: string }) {
  const { query, setQuery } = useCommandPaletteSearch();
  // The same entries as the shell's nav: manifest-driven, and narrowed by the
  // member's clinic access and any View-as preview.
  const { entries } = useAppNav();
  const { go, runCommand } = usePaletteCommands();
  // "Write prescription" turns the menu into a patient finder until it is left
  // (feat-prescription-composer §6.1); every opening starts on the full menu.
  const [prescribing, setPrescribing] = useState(false);
  const appCommands = useAppCommandGroups({
    query,
    organizationSlug,
    navEntries: entries,
    go,
    run: runCommand,
    prescribing,
    onPrescribe: () => {
      setQuery('');
      setPrescribing(true);
    },
  });
  return (
    <CommandMenu
      organizationSlug={organizationSlug}
      appCommands={appCommands}
      onLeaveMode={() => {
        setQuery('');
        setPrescribing(false);
      }}
    />
  );
}

function PersonalCommandMenu() {
  return <CommandMenu organizationSlug="" appCommands={NO_APP_COMMANDS} />;
}

/**
 * What the menu shows around its rows. The design's empty query shows Actions alone (H:4600);
 * the platform rows join once typing — or at once, when the clinic has nothing to offer — and
 * the patient finder lists patients alone. The clinic's empty line names what it searches, and
 * waits for the search to answer: "No matches" never flashes ahead of the rows.
 */
function useMenuLines(appCommands: AppCommandGroups, typed: string) {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tMenu } = useTranslation(COMMAND_MENU_NS);
  const { prescribe } = appCommands;
  if (prescribe) {
    return {
      showPlatform: false,
      empty: typed && !appCommands.isSearching ? prescribe.empty : null,
      hint: isCommandSearchQuery(typed) ? null : prescribe.hint,
    };
  }
  const searching = appCommands.searchable;
  let empty: string | null = t(LAYOUT_KEYS.app.commandPalette.empty);
  if (searching) {
    empty = typed && !appCommands.isSearching ? tMenu(COMMAND_MENU_KEYS.empty) : null;
  }
  return {
    showPlatform: typed !== '' || appCommands.groups.length === 0,
    empty,
    hint:
      searching && !isCommandSearchQuery(typed) ? tMenu(COMMAND_MENU_KEYS.hint) : null,
  };
}

/**
 * The menu itself. The clinic groups lead: "Actions" alone until something is
 * typed, then "Go to" and, once the contacts search takes the query, People.
 * The platform rows (settings, workspaces, shortcuts, theme, sign out) follow
 * once typing — the relocation table keeps them here (§3.2) — or at once
 * where the clinic offers nothing.
 */
function CommandMenu({
  organizationSlug,
  appCommands,
  onLeaveMode,
}: {
  organizationSlug: string;
  appCommands: AppCommandGroups;
  /** Leaves the patient finder for the full menu. */
  onLeaveMode?: () => void;
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
  // The finder is a new list: its first row leads, whatever was hovered before it opened.
  const selection = useCommandSelection(
    appCommands.prescribe ? `prescribe:${query}` : query,
    appCommands.groups[0]?.rows[0]?.value,
  );
  const closePalette = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const cp = LAYOUT_KEYS.app.commandPalette;
  const typed = query.trim();
  const { prescribe } = appCommands;
  const { showPlatform, empty, hint } = useMenuLines(appCommands, typed);

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
      <CommandPaletteInput
        searching={appCommands.isSearching}
        mode={
          prescribe && onLeaveMode ? { ...prescribe, onLeave: onLeaveMode } : undefined
        }
      />

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

        {appCommands.groups.map((group) => (
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

/** The patient finder's chip before the line: "Write prescription" and its × back to every command. */
function ModeChip({ mode }: { mode: PrescribeMode & { onLeave: () => void } }) {
  return (
    <span
      data-slot="pill"
      data-testid="command-palette-mode"
      className={cn(
        TONE_CLASSES.sage.surface,
        'inline-flex h-6.5 flex-none items-center gap-1 rounded-full ps-2 pe-0.5 text-xs font-medium whitespace-nowrap',
      )}
    >
      <Pill aria-hidden="true" className="size-3" />
      {mode.chip}
      <button
        type="button"
        aria-label={mode.leave}
        title={mode.leave}
        onClick={mode.onLeave}
        data-testid="command-palette-mode-leave"
        data-slot="pill"
        className="hover:bg-background/60 grid size-5.5 place-items-center rounded-full"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  );
}

/**
 * The 52px input row (H:2672): search mark · input ("Search or jump to…") · "esc" — with the
 * patient finder's chip and placeholder while "Write prescription" holds the menu, where
 * Backspace on an empty line leaves it.
 */
function CommandPaletteInput({
  searching,
  mode,
}: {
  searching: boolean;
  mode?: PrescribeMode & { onLeave: () => void };
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tPicker } = useTranslation(PICKER_NS);
  const { query, setQuery, searchFocus, rememberFocus } = useCommandPaletteSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const inMode = mode !== undefined;
  // Entering or leaving the finder keeps the cursor in the line (a row's click may have taken it).
  useEffect(() => {
    if (inMode) inputRef.current?.focus();
  }, [inMode]);
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
      icon={
        <>
          <Search aria-hidden="true" className={COMMAND_SEARCH_ICON_CLASS} />
          {mode ? <ModeChip mode={mode} /> : null}
        </>
      }
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
      placeholder={mode?.placeholder ?? t(LAYOUT_KEYS.app.commandPalette.placeholder)}
      maxLength={COMMAND_SEARCH_MAX_LENGTH}
      className={COMMAND_SEARCH_CLASS}
      ref={inputRef}
      value={query}
      onValueChange={setQuery}
      onKeyDown={(event) => {
        if (mode && event.key === 'Backspace' && query === '') {
          event.preventDefault();
          mode.onLeave();
        }
      }}
      onFocus={() => {
        rememberFocus(true);
      }}
      onBlur={() => {
        rememberFocus(false);
      }}
    />
  );
}
