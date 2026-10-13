import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { platformConfig } from '@/core/config/env.ts';
import { cn } from '@/lib/utils.ts';
import type { Presence } from '@/shared/api/app/app-schema.ts';
import { logout } from '@/shared/auth/service.ts';
import { CountBadge } from '@/shared/components/Cells/CountBadge/index.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { OrganizationSwitcher } from '@/shared/components/OrganizationSwitcher/index.ts';
import { settingsHash } from '@/shared/components/SettingsModal/settings-hash-grammar.ts';
import { isSettingsModuleEnabled } from '@/shared/components/SettingsModal/settings-modules.ts';
import type { AccountSettingsSection } from '@/shared/components/SettingsModal/settings-sections.ts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu.tsx';
import { useRoleLabel, useRolesInForce } from '@/shared/hooks/useAppRoles/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useUnreadCount } from '@/shared/hooks/useNotifications/index.ts';
import { usePresence } from '@/shared/hooks/usePresence/index.ts';
import {
  type AppIcon,
  Bell,
  ChevronLeft,
  CreditCard,
  Keyboard,
  Monitor,
  MonitorSmartphone,
  Moon,
  Palette,
  Settings,
  Shield,
  Sun,
} from '@/shared/icons/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { useMyInvitations } from '@/shared/tenancy/my-invitations.ts';

const keys = LAYOUT_KEYS.app.sectionBar;

/** Presence dot colours (KICKOFF §3.2 slot 10; Appendix E: Busy = `--k89`). */
const PRESENCE_DOT: Readonly<Record<Presence, string>> = {
  online: 'bg-presence-online',
  away: 'bg-tone-butter-dot',
  busy: 'bg-now-indicator',
};

const PRESENCE_ORDER: readonly Presence[] = ['online', 'away', 'busy'];

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, labelKey: LAYOUT_KEYS.app.theme.light },
  { value: 'dark', icon: Moon, labelKey: LAYOUT_KEYS.app.theme.dark },
  { value: 'system', icon: Monitor, labelKey: LAYOUT_KEYS.app.theme.system },
] as const;

/**
 * The rows that open an Account settings section, in menu order. Each follows
 * its section's module gate exactly as the Settings rail does
 * (`isSettingsModuleEnabled`, from `VITE_DISABLED_MODULES`): a deployment
 * without billing shows no Billing row.
 */
const SETTINGS_ROWS: readonly {
  section: AccountSettingsSection;
  icon: AppIcon;
  labelKey: string;
  testId: string;
}[] = [
  {
    section: 'profile',
    icon: Settings,
    labelKey: LAYOUT_KEYS.app.settings,
    testId: 'user-menu-settings',
  },
  {
    section: 'security',
    icon: Shield,
    labelKey: keys.security,
    testId: 'account-menu-security',
  },
  {
    section: 'billing',
    icon: CreditCard,
    labelKey: keys.billing,
    testId: 'account-menu-billing',
  },
  {
    section: 'sessions',
    icon: MonitorSmartphone,
    labelKey: keys.devices,
    testId: 'account-menu-devices',
  },
];

/** A radio pill: the menu's radio item laid out as a 28px chip (its dot indicator hidden). */
const radioPillClassName =
  'data-[state=checked]:bg-muted data-[state=checked]:border-disabled h-7 gap-1.5 rounded-full border border-border px-2.5 text-xs font-medium focus:bg-muted [&>span:first-child]:hidden';

function MenuRow({
  icon: Icon,
  label,
  onSelect,
  testId,
  trailing,
}: {
  icon: AppIcon;
  label: string;
  onSelect: () => void;
  testId: string;
  trailing?: ReactNode;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      data-testid={testId}
      className="text-body h-9 gap-2.5 rounded-lg px-2.5 font-medium"
    >
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </DropdownMenuItem>
  );
}

/** "<role> · <branch>", or just the role, or nothing for a member without a clinic role. */
function useRoleLine(): string | null {
  const { t } = useTranslation(LAYOUT_NS);
  const label = useRoleLabel();
  const [mainRole] = useRolesInForce();
  const { openBranches } = useBranches();
  if (!mainRole) return null;
  const role = label(mainRole);
  const branch = openBranches.find((candidate) => candidate.isMain) ?? openBranches[0];
  return branch ? t(keys.identityRole, { role, branch: branch.name }) : role;
}

/** The identity block — avatar, name, role · branch, email — which opens the profile. */
function IdentityBlock({
  name,
  email,
  avatar,
  onOpenProfile,
}: {
  name: string;
  email: string | undefined;
  avatar: ReactNode;
  onOpenProfile: () => void;
}) {
  const roleLine = useRoleLine();
  return (
    <DropdownMenuItem
      onSelect={onOpenProfile}
      data-testid="account-menu-identity"
      className="rounded-none border-b px-3.5 py-3"
    >
      {avatar}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-field truncate leading-[1.3] font-semibold">{name}</span>
        {roleLine ? (
          <span className="text-muted-foreground-strong truncate text-xs leading-[1.3]">
            {roleLine}
          </span>
        ) : null}
        {email ? (
          <span className="text-muted-foreground text-caption truncate leading-[1.3]">
            {email}
          </span>
        ) : null}
      </span>
    </DropdownMenuItem>
  );
}

/** A labelled row of radio pills (Status, Appearance). */
function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenuGroup className="flex flex-col gap-1.5 px-3.5 py-2.5">
      <DropdownMenuLabel className="text-muted-foreground text-micro p-0 font-semibold tracking-[0.05em] uppercase">
        {label}
      </DropdownMenuLabel>
      {children}
    </DropdownMenuGroup>
  );
}

/** Online · Away · Busy (H:548); a change toasts "Status · <label>". */
function StatusPills() {
  const { t } = useTranslation(LAYOUT_NS);
  const { presence, setPresence } = usePresence();
  return (
    <PillGroup label={t(keys.status)}>
      <DropdownMenuRadioGroup
        value={presence}
        onValueChange={(value) => {
          const next = value as Presence;
          setPresence(next);
          notify.success(t(keys.statusToast, { status: t(keys.presence[next]) }));
        }}
        aria-label={t(keys.status)}
        className="flex gap-1.5"
      >
        {PRESENCE_ORDER.map((value) => (
          <DropdownMenuRadioItem
            key={value}
            value={value}
            onSelect={(event) => event.preventDefault()}
            data-testid={`account-menu-status-${value}`}
            className={radioPillClassName}
          >
            <span
              aria-hidden
              data-slot="pill"
              className={cn('size-2 rounded-full', PRESENCE_DOT[value])}
            />
            {t(keys.presence[value])}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </PillGroup>
  );
}

/** Light · Dark · System (H:549), written to the theme store's mode (D32). */
function AppearancePills() {
  const { t } = useTranslation(LAYOUT_NS);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const label = t(keys.appearance);
  return (
    <PillGroup label={label}>
      <DropdownMenuRadioGroup
        value={theme}
        onValueChange={(value) =>
          setTheme(value as (typeof THEME_OPTIONS)[number]['value'])
        }
        aria-label={label}
        className="flex gap-1.5"
      >
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            onSelect={(event) => event.preventDefault()}
            data-testid={`account-menu-theme-${option.value}`}
            className={radioPillClassName}
          >
            <option.icon className="size-3.25" aria-hidden />
            {t(option.labelKey)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </PillGroup>
  );
}

/** The platform rows relocated into the menu (KICKOFF §3.2 relocation table). */
function PlatformRows({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const { t } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const setShortcutsOpen = useUIStore((state) => state.setShortcutsOpen);
  const { data: unread = 0 } = useUnreadCount();
  const openSettings = (section: AccountSettingsSection) =>
    void navigate({ to: '.', hash: settingsHash('account', section) });
  return (
    <DropdownMenuGroup className="flex flex-col p-1.5">
      <MenuRow
        icon={Bell}
        label={t(LAYOUT_KEYS.app.notifications.title)}
        testId="account-menu-notifications"
        onSelect={onOpenNotifications}
        trailing={unread > 0 ? <CountBadge count={unread} /> : null}
      />
      {SETTINGS_ROWS.filter(({ section }) =>
        isSettingsModuleEnabled({ scope: 'account', section }),
      ).map((row) => (
        <MenuRow
          key={row.section}
          icon={row.icon}
          label={t(row.labelKey)}
          testId={row.testId}
          onSelect={() => openSettings(row.section)}
        />
      ))}
      <MenuRow
        icon={Keyboard}
        label={t(LAYOUT_KEYS.app.shortcuts.title)}
        testId="account-menu-shortcuts"
        onSelect={() => setShortcutsOpen(true)}
      />
    </DropdownMenuGroup>
  );
}

/**
 * Header slot 10 and the Account menu (`shell.md:27, 56–62`; H:545–551,
 * H:4151): the avatar with its presence dot, then — identity (opens the
 * profile), "Switch clinic", Status, Appearance (the mode pills, and the
 * "Appearance & language" row that opens its drawer), the relocated platform
 * rows (Notifications, Settings, Security, Billing, Devices, Keyboard
 * shortcuts) and "Log out". The same popover on a phone (no phone override).
 */
export function AccountMenu({
  onOpenNotifications,
}: {
  onOpenNotifications: () => void;
}) {
  const { t } = useTranslation(LAYOUT_NS);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { presence } = usePresence();
  const [mainRole] = useRolesInForce();
  // Pending invitations to other clinics (D84): a count on the avatar, so they are seen without
  // opening the menu; "Switch clinic" lists them.
  const invitationCount = useMyInvitations().data?.length ?? 0;
  const [open, setOpen] = useState(false);
  // The inbox opens as this menu closes; the menu must not hand focus back to
  // the avatar then, or the inbox would read that as a click outside.
  const keepFocusAway = useRef(false);

  const name = user?.name ?? user?.email ?? t(LAYOUT_KEYS.app.userFallback);
  const tone = mainRole?.tone ?? 'stone';
  const avatar = (size: 'cell' | 'identity') => (
    <PersonAvatar
      initials={personInitials(name)}
      tone={tone}
      size={size}
      presence={presence}
    />
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={[
            t(keys.avatarLabel, { name, status: t(keys.presence[presence]) }),
            invitationCount > 0
              ? t(LAYOUT_KEYS.app.orgSwitcher.invitationCount, { count: invitationCount })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          data-testid="user-menu-trigger"
          data-slot="pill"
          className={cn(
            'relative flex flex-none rounded-full transition-shadow',
            open
              ? 'shadow-[0_0_0_2px_var(--color-card),0_0_0_3.5px_var(--color-disabled)]'
              : 'hover:shadow-[0_0_0_2px_var(--color-card),0_0_0_3.5px_var(--color-border-strong)]',
          )}
        >
          {avatar('cell')}
          {invitationCount > 0 ? (
            <CountBadge
              count={invitationCount}
              aria-hidden="true"
              className="absolute -end-1.5 -top-1.5"
              data-testid="user-menu-invitation-count"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        // Radix names the menu after its trigger ("Riya S. · Online"); the
        // design names it "Account" (H:546).
        aria-labelledby={undefined}
        aria-label={t(keys.account)}
        data-testid="account-menu"
        className="data-[state=open]:animate-dropdown-in w-65 rounded-xl p-0"
        onCloseAutoFocus={(event) => {
          if (keepFocusAway.current) {
            event.preventDefault();
            keepFocusAway.current = false;
          }
        }}
      >
        <IdentityBlock
          name={name}
          email={user?.email}
          avatar={avatar('identity')}
          onOpenProfile={() =>
            void navigate({ to: '.', hash: settingsHash('account', 'profile') })
          }
        />
        <div className="p-1.5 empty:hidden">
          <OrganizationSwitcher
            presentation="submenu"
            submenuLabel={t(keys.switchClinic)}
            onSwitched={() => setOpen(false)}
          />
        </div>
        <DropdownMenuSeparator className="m-0" />
        <StatusPills />
        <DropdownMenuSeparator className="m-0" />
        {/* A theme-locked deployment (`VITE_THEME_LOCK`) pins the mode, so the
            pills give way — the Appearance drawer says why. */}
        {platformConfig.themeLock ? null : <AppearancePills />}
        {/* The rest of Appearance — the language, text direction, date-time and
            number preferences — sits one tap away, in its drawer. */}
        <div className="px-1.5 pb-1.5">
          <MenuRow
            icon={Palette}
            label={t(keys.appearanceLanguage)}
            testId="account-menu-appearance"
            onSelect={() => useUIStore.getState().setAppearanceOpen(true)}
          />
        </div>
        <DropdownMenuSeparator className="m-0" />
        <PlatformRows
          onOpenNotifications={() => {
            keepFocusAway.current = true;
            onOpenNotifications();
          }}
        />
        <DropdownMenuSeparator className="m-0" />
        <div className="p-1.5">
          <DropdownMenuItem
            onSelect={() => void logout({ reason: 'logout' })}
            data-testid="logout-button"
            className="text-destructive focus:text-destructive hover:bg-destructive-tint focus:bg-destructive-tint text-body h-9 gap-2.5 rounded-lg px-2.5 font-medium"
          >
            <ChevronLeft className="size-3.75 rtl:rotate-180" aria-hidden />
            {t(LAYOUT_KEYS.app.logOut)}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
