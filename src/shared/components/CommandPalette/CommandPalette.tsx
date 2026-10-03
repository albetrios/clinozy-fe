import { useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { logout } from '@/shared/auth/service.ts';
import { SETTINGS_NS } from '@/shared/components/SettingsModal/settings.constants.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/shared/components/ui/command.tsx';
import { mapApiError, reportError } from '@/shared/errors/errorHandler.ts';
import { useAppNav } from '@/shared/hooks/useAppNav/index.ts';
import { useDeploymentFlags } from '@/shared/hooks/useDeploymentFlags/index.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useVisibleSettingsSections } from '@/shared/hooks/useSettingsNav/index.ts';
import {
  Building,
  LogOut,
  Monitor,
  Moon,
  Search,
  Settings,
  Sun,
} from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  COMMAND_SEARCH_CLASS,
  useCommandPaletteSearch,
} from './command-palette-context.ts';
import { CommandItem } from './CommandPaletteItem.tsx';
import { CommandPaletteOrgGroup } from './CommandPaletteOrgGroup.tsx';
import { CommandPaletteShell } from './CommandPaletteShell.tsx';

/**
 * Stable id for the logout-failed toast (house rule 7): a user whose sign-out
 * failed will try again, and the second failure should replace the first
 * message rather than stack another copy of it.
 */
export const PALETTE_LOGOUT_TOAST_ID = 'command-palette-logout-failed';

/**
 * cmdk matches a row against its rendered label, and these three labels are
 * translated — so a search for "theme" reached them in English and nowhere
 * else. Keywords are locale-independent, which is what the dashboard's
 * "Change theme" suggestion seeds the palette with.
 */
const THEME_KEYWORDS = ['theme', 'appearance', 'light', 'dark', 'system'] as const;

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

/** Deferred command engine and results inside the persistent search shell. */
export function CommandPaletteContent() {
  const { t } = useTranslation(LAYOUT_NS);
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  // The same entries as the shell's nav: manifest-driven, and narrowed by the
  // member's clinic access and any View-as preview.
  const { entries: navEntries } = useAppNav(
    organizationSlug ? 'organization' : 'personal',
  );
  const setTheme = useThemeStore((s) => s.setTheme);
  const { data: meContext } = useMeContext();
  // Organization settings only has sections for a team workspace; on a personal
  // workspace the command would just fall back to account/profile — so hide it.
  const isTeamOrg = meContext?.activeOrganization?.type === 'TEAM';
  // Settings destinations, gated exactly like the Settings modal nav (permission +
  // org type + deployment) so ⌘K can jump straight to e.g. Billing or Members.
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const deploymentFlags = useDeploymentFlags();
  const settingsItems = useVisibleSettingsSections();
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const closePalette = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const runCommand = useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );

  if (!open) return null;

  const cp = LAYOUT_KEYS.app.commandPalette;

  return (
    <Command
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <CommandPaletteInput />

      <CommandList className="max-h-[300px] overflow-y-auto p-2">
        <CommandEmpty className="text-muted-foreground py-6 text-center text-sm">
          {t(cp.empty)}
        </CommandEmpty>

        <CommandGroup
          heading={t(cp.groups.navigation)}
          className="text-muted-foreground px-1 py-1.5 text-xs font-medium"
        >
          {navEntries.map((entry) => (
            <CommandItem
              key={entry.id}
              onSelect={() =>
                runCommand(() => navigate({ to: entry.to, params: { organizationSlug } }))
              }
              icon={entry.icon}
            >
              {t(entry.labelKey, { ns: entry.labelNs })}
            </CommandItem>
          ))}
          <CommandItem
            onSelect={() =>
              runCommand(() =>
                navigate({ to: '.', hash: settingsHash('account', 'profile') }),
              )
            }
            icon={Settings}
          >
            {t(cp.userSettings)}
          </CommandItem>
          {isTeamOrg ? (
            <CommandItem
              onSelect={() =>
                runCommand(() =>
                  navigate({
                    to: '.',
                    hash: settingsHash('organization', 'general'),
                  }),
                )
              }
              icon={Building}
            >
              {t(cp.organizationSettings)}
            </CommandItem>
          ) : null}
        </CommandGroup>

        {settingsItems.length > 0 ? (
          <CommandGroup
            heading={t(cp.settings)}
            className="text-muted-foreground px-1 py-1.5 text-xs font-medium"
          >
            {settingsItems.map((item) => (
              <CommandItem
                key={`${item.scope}/${item.section}`}
                icon={item.icon}
                keywords={item.keywords}
                onSelect={() =>
                  runCommand(() =>
                    navigate({
                      to: '.',
                      hash: settingsHash(item.scope, item.section),
                    }),
                  )
                }
              >
                {tSettings(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {meContext ? (
          <CommandPaletteOrgGroup
            personalOrganizationsEnabled={deploymentFlags.personalOrganizations}
            heading={t(cp.groups.organizations)}
            currentOrganizationLabel={(name) => t(cp.currentOrganization, { name })}
            switchOrganizationLabel={(name) => t(cp.switchOrganization, { name })}
            closePalette={closePalette}
            navigate={navigate}
          />
        ) : null}

        <CommandSeparator className="bg-border my-1 h-px" />

        <CommandGroup
          heading={t(cp.groups.shortcuts)}
          className="text-muted-foreground px-1 py-1.5 text-xs font-medium"
        >
          <CommandItem
            onSelect={() => runCommand(() => setShortcutsOpen(true))}
            icon={Settings}
          >
            {t(cp.openShortcuts)}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-border my-1 h-px" />

        <CommandGroup
          heading={t(cp.groups.theme)}
          className="text-muted-foreground px-1 py-1.5 text-xs font-medium"
        >
          <CommandItem
            onSelect={() => runCommand(() => setTheme('light'))}
            icon={Sun}
            keywords={THEME_KEYWORDS}
          >
            {t(cp.lightMode)}
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setTheme('dark'))}
            icon={Moon}
            keywords={THEME_KEYWORDS}
          >
            {t(cp.darkMode)}
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setTheme('system'))}
            icon={Monitor}
            keywords={THEME_KEYWORDS}
          >
            {t(cp.systemTheme)}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="bg-border my-1 h-px" />

        <CommandGroup
          heading={t(cp.groups.account)}
          className="text-muted-foreground px-1 py-1.5 text-xs font-medium"
        >
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                logout().catch((error: unknown) => {
                  // `.catch(() => {})` meant a sign-out that did not happen
                  // looked exactly like one that did: the palette closed,
                  // nothing else moved, and the user was still signed in
                  // with nothing said and nothing reported (SHELL-12).
                  reportError(error, { scope: 'command-palette-logout' });
                  notify.error(mapApiError(error), {
                    id: PALETTE_LOGOUT_TOAST_ID,
                  });
                });
              })
            }
            icon={LogOut}
            destructive
          >
            {t(cp.logOut)}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CommandPaletteInput() {
  const { t } = useTranslation(LAYOUT_NS);
  const cp = LAYOUT_KEYS.app.commandPalette;
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
      wrapperClassName="h-auto gap-0"
      icon={<Search className="text-muted-foreground me-2 h-4 w-4 shrink-0" />}
      data-slot="input"
      placeholder={t(cp.placeholder)}
      aria-label={t(cp.placeholder)}
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
