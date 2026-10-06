import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { logout } from '@/shared/auth/service.ts';
import {
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import type { SettingsScope } from '@/shared/components/SettingsModal/settings-sections.ts';
import { mapApiError, reportError } from '@/shared/errors/errorHandler.ts';
import { useMeContext } from '@/shared/hooks/useMeContext/index.ts';
import { useVisibleSettingsSections } from '@/shared/hooks/useSettingsNav/index.ts';
import {
  type AppIcon,
  Building,
  ChevronLeft,
  Keyboard,
  Monitor,
  Moon,
  Settings,
  Sun,
} from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  type CommandRow,
  type CommandRowGroup,
  matchesCommandQuery,
} from './command-palette-model.ts';

/**
 * Stable id for the logout-failed toast (house rule 7): a user whose sign-out
 * failed will try again, and the second failure should replace the first
 * message rather than stack another copy of it.
 */
export const PALETTE_LOGOUT_TOAST_ID = 'command-palette-logout-failed';

/**
 * The theme rows' labels are translated, so a search for "theme" would reach
 * them in English and nowhere else. Keywords are locale-independent, so the
 * rows answer it in every language.
 */
const THEME_KEYWORDS = ['theme', 'appearance', 'light', 'dark', 'system'] as const;

const cp = LAYOUT_KEYS.app.commandPalette;

const THEME_MODES = [
  { mode: 'light', labelKey: cp.lightMode, icon: Sun },
  { mode: 'dark', labelKey: cp.darkMode, icon: Moon },
  { mode: 'system', labelKey: cp.systemTheme, icon: Monitor },
] as const;

/** Rows that answer the query; groups left empty drop out. */
function matching(groups: CommandRowGroup[], query: string): CommandRowGroup[] {
  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) =>
        matchesCommandQuery(row.label, row.keywords, query),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}

/** The platform rows, split around the workspace group (a component of its own). */
export interface PlatformCommandGroups {
  /** Settings. */
  leading: CommandRowGroup[];
  /** Shortcuts, Theme and Account. */
  trailing: CommandRowGroup[];
}

/**
 * The palette's platform rows, kept by the relocation table (KICKOFF §3.2):
 * Settings (user, organization and every section the Settings modal would
 * show), Keyboard shortcuts, the three theme modes and Log out. The rooms are
 * the clinic's "Go to" group. Each row answers the query by its label or its
 * keywords. They are the clinic rows' anatomy: a settings row names its scope
 * in the sub ("Account", "Organization" — as an action names its room), unless
 * that would repeat its own label; shortcuts and Log out take the Account
 * menu's glyphs (the keyboard, the mirrored chevron).
 *
 * @param runCommand Closes the palette, then runs the command.
 */
export function usePlatformCommandGroups({
  query,
  runCommand,
}: {
  query: string;
  runCommand: (command: () => void) => void;
}): PlatformCommandGroups {
  const { t } = useTranslation(LAYOUT_NS);
  const { t: tSettings } = useTranslation(SETTINGS_NS);
  const navigate = useNavigate();
  const setTheme = useThemeStore((s) => s.setTheme);
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen);
  const { data: meContext } = useMeContext();
  // Settings destinations, gated exactly like the Settings modal nav (permission +
  // org type + deployment) so ⌘K can jump straight to e.g. Billing or Members.
  const settingsItems = useVisibleSettingsSections();
  // Organization settings only has sections for a team workspace; on a personal
  // workspace the command would just fall back to account/profile — so hide it.
  const isTeamOrg = meContext?.activeOrganization?.type === 'TEAM';

  const settingsRow = (
    value: string,
    label: string,
    scope: SettingsScope,
    hash: string,
    icon: AppIcon,
    keywords?: readonly string[],
  ): CommandRow => {
    const scopeLabel = tSettings(SETTINGS_GROUP_LABEL_KEYS[scope]);
    return {
      value,
      label,
      sub: scopeLabel === label ? undefined : scopeLabel,
      icon,
      keywords,
      // A same-route navigation states its hash: the Settings modal lives there.
      onSelect: () => runCommand(() => navigate({ to: '.', hash })),
    };
  };

  const leading: CommandRowGroup[] = [
    {
      id: 'settings',
      heading: t(cp.settings),
      rows: [
        settingsRow(
          'settings:user',
          t(cp.userSettings),
          'account',
          settingsHash('account', 'profile'),
          Settings,
        ),
        ...(isTeamOrg
          ? [
              settingsRow(
                'settings:organization',
                t(cp.organizationSettings),
                'organization',
                settingsHash('organization', 'general'),
                Building,
              ),
            ]
          : []),
        ...settingsItems.map((item) =>
          settingsRow(
            `settings:${item.scope}/${item.section}`,
            tSettings(item.labelKey),
            item.scope,
            settingsHash(item.scope, item.section),
            item.icon,
            item.keywords,
          ),
        ),
      ],
    },
  ];

  const trailing: CommandRowGroup[] = [
    {
      id: 'shortcuts',
      heading: t(cp.groups.shortcuts),
      rows: [
        {
          value: 'shortcuts',
          label: t(cp.openShortcuts),
          icon: Keyboard,
          onSelect: () => runCommand(() => setShortcutsOpen(true)),
        },
      ],
    },
    {
      id: 'theme',
      heading: t(cp.groups.theme),
      rows: THEME_MODES.map(({ mode, labelKey, icon }) => ({
        value: `theme:${mode}`,
        label: t(labelKey),
        icon,
        keywords: THEME_KEYWORDS,
        onSelect: () => runCommand(() => setTheme(mode)),
      })),
    },
    {
      id: 'account',
      heading: t(cp.groups.account),
      rows: [
        {
          value: 'account:log-out',
          label: t(cp.logOut),
          icon: ChevronLeft,
          mirrored: true,
          destructive: true,
          onSelect: () =>
            runCommand(() => {
              logout().catch((error: unknown) => {
                // `.catch(() => {})` meant a sign-out that did not happen
                // looked exactly like one that did: the palette closed,
                // nothing else moved, and the user was still signed in
                // with nothing said and nothing reported (SHELL-12).
                reportError(error, { scope: 'command-palette-logout' });
                notify.error(mapApiError(error), { id: PALETTE_LOGOUT_TOAST_ID });
              });
            }),
        },
      ],
    },
  ];

  const typed = query.trim();
  return { leading: matching(leading, typed), trailing: matching(trailing, typed) };
}
