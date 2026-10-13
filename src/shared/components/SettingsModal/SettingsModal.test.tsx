import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SettingsModal } from './SettingsModal.tsx';

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

const { useMeContextMock, notificationsPanelThrows, notificationsPanelDirty } =
  vi.hoisted(() => {
    const listeners = new Set<() => void>();
    return {
      useMeContextMock: vi.fn(),
      notificationsPanelThrows: { value: false },
      // Stands in for a panel holding unsaved edits, through the real registration
      // hook; `set` re-renders it, as a save landing clears a real panel's draft.
      notificationsPanelDirty: {
        value: false,
        set(next: boolean) {
          this.value = next;
          for (const listener of listeners) listener();
        },
        subscribe(listener: () => void) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    };
  });
vi.mock('./account/AccountNotificationsPanel.tsx', async (importOriginal) => {
  const actual = await importOriginal<{ AccountNotificationsPanel: () => ReactNode }>();
  const { useRegisterSettingsDirty } = await import('./settings-dirty.tsx');
  const { useSyncExternalStore } = await import('react');
  return {
    ...actual,
    AccountNotificationsPanel: () => {
      if (notificationsPanelThrows.value) throw new Error('Notifications panel crashed');
      const dirty = useSyncExternalStore(
        (listener) => notificationsPanelDirty.subscribe(listener),
        () => notificationsPanelDirty.value,
      );
      useRegisterSettingsDirty('notifications-test', dirty);
      return actual.AccountNotificationsPanel();
    },
  };
});
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({
  useMeContext: useMeContextMock,
  meContextQueryKey: ['auth', 'me-context'],
}));

const USER = { id: 'usr_1', email: 'u@e.com', role: 'user' } as AuthUser;
const ALL_PERMS: OrganizationPermission[] = [
  'organization:read',
  'membership:read',
  'role:read',
  'webhook:read',
  'subscription:read',
  'api-key:read',
];
const meCtx = (type: 'PERSONAL' | 'TEAM') => ({
  // `user` is required on MeContext whenever `data` is present, and the panels read it
  // unguarded (EmailVerificationBanner, the profile avatar). A fixture that omits it
  // stands in for a shape the API cannot return, and crashes the section under test.
  data: { activeOrganization: { type }, user: { avatarUrl: null } },
  isPending: false,
  isLoading: false,
  isError: false,
});
/** Session context still in flight — the modal cannot know its own shape yet. */
const meCtxLoading = {
  data: undefined,
  isPending: true,
  isLoading: true,
  isError: false,
};

describe('SettingsModal', () => {
  beforeEach(() => {
    notificationsPanelDirty.value = false;
    useAuthStore.setState({ user: USER, isAuthenticated: true });
    useOrganizationStore.getState().clearOrganization();
    useMeContextMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isLoading: false,
      isError: false,
    });
  });

  it.each([
    ['account/account', 'settings-section-account'],
    ['account/security', 'settings-section-security'],
    ['account/sessions', 'settings-account-sessions'],
    ['account/billing', 'settings-account-billing'],
    ['organization/general', 'settings-section-org-general'],
    ['organization/clinic', 'settings-section-org-clinic'],
    ['organization/members', 'settings-organization-members'],
    ['organization/roles', 'settings-organization-roles'],
    ['account/integrations', 'settings-organization-integrations'],
  ])(
    'loads the selected content inside the persistent shell: %s',
    async (section, id) => {
      useOrganizationStore.getState().setOrganization('org_team', 'acme');
      useOrganizationStore.getState().setPermissions(ALL_PERMS);
      useMeContextMock.mockReturnValue(meCtx('TEAM'));
      renderWithProviders(<SettingsModal />, {
        initialEntries: [`/#settings/${section}`],
      });
      // Each case is the first in this file to import its panel's lazy chunk, and a cold
      // import under the full suite's load outlasts findBy's 1s default — the same wait the
      // layout tests give their cold chunks.
      expect(await screen.findByTestId(id, {}, { timeout: 15_000 })).toBeInTheDocument();
      expect(screen.getByTestId('settings-search')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
    },
  );

  it('can change sections while context is pending without losing the shell', async () => {
    useMeContextMock.mockReturnValue(meCtxLoading);
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });
    fireEvent.click(await screen.findByTestId('settings-nav-account-security'));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/account/security'),
    );
    expect(screen.getByTestId('settings-content-loading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();

    // Two things at once, because `onceAsync` caches each panel's chunk for the
    // whole file: only the first test to switch sections ever reaches this
    // fallback. (1) There is ONE skeleton and no visible copy — the line that
    // used to sit here advanced through three strings while a single panel
    // loaded. (2) The announcement survives, `sr-only` and polite, and still
    // NAMES the section, so a slow panel says which one rather than a bare
    // "Loading" (carried over from #329).
    expect(
      screen.queryByTestId('settings-content-loading-label'),
    ).not.toBeInTheDocument();
    const region = screen.getByTestId('settings-content-loading');
    const live = region.querySelector('output[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live).toHaveClass('sr-only');
    expect(live).toHaveTextContent(/Security/);
  });

  it('renders nothing without a settings hash', () => {
    renderWithProviders(<SettingsModal />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  it('is the record drawer — 1040px from md, the full screen below — titled Settings', async () => {
    // Every centred modal became a drawer (L-65): Settings is the shared
    // RecordDrawer at its widest width, so the rail and a section's page sit
    // side by side, with the drawers' header, × and Esc layers.
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    const drawer = await screen.findByTestId('settings-modal');
    expect(drawer).toHaveAttribute('data-slot', 'sheet-content');
    expect(drawer).toHaveClass('w-full', 'md:w-[min(1040px,calc(100vw-56px))]');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBe(drawer);
    expect(screen.getByTestId('settings-modal-title')).toHaveTextContent('Settings');
    // Every section saves itself: the drawer has no footer of its own.
    expect(screen.queryByTestId('settings-modal-footer')).not.toBeInTheDocument();
  });

  it('shows the rail from md and the section switch below it', async () => {
    // Below `md` the drawer is the full screen and the phone picks its section
    // from the Picker; from `md` the rail takes the inline-start column.
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    const rail = await screen.findByTestId('settings-nav');
    expect(rail).toHaveClass('hidden', 'md:flex');
    expect(rail.parentElement).toHaveClass(
      'grid-cols-1',
      'md:grid-cols-[minmax(220px,264px)_minmax(0,1fr)]',
    );
    expect(
      screen.getByTestId('settings-mobile-section').closest('[class*="md:hidden"]'),
    ).not.toBeNull();
  });

  it('gives every pane the standard inset, on the spacing scale', async () => {
    // One inset for the whole drawer body (it was 12px / 32px / 12px-over-16px),
    // written as scale steps so the theme's Density setting moves it.
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    const content = await screen.findByTestId('settings-content');
    expect(content).toHaveClass('px-4', 'sm:px-6', 'sm:pb-6');
    expect(content).not.toHaveClass('sm:px-8');

    // Phone: the section picker sits on the content's gutter, so it and the
    // fields under it share their edges. (Its row wraps the Picker's own field
    // wrapper, hence `closest` rather than the trigger's parent.)
    const picker = screen
      .getByTestId('settings-mobile-section')
      .closest('[class*="md:hidden"]');
    expect(picker).toHaveClass('px-4', 'md:hidden');
    // It used to reserve the dialog's × corner (`pe-14`); the drawer's × sits in
    // its header above (outside the panel from `md`), so nothing runs under it.
    expect(picker?.className ?? '').not.toMatch(/\bpe-1[24]\b/);
    // And never physical — `validate:logical` is the CI half of this contract.
    expect(picker?.className ?? '').not.toMatch(/\bp[lr]-/);

    // The × is pinned on the logical end wherever it sits, so it mirrors with
    // everything else under RTL.
    const close = screen.getByTestId('settings-modal-close');
    expect(close).toHaveAccessibleName('Close');
    expect(close.className).not.toMatch(/\b(right|left)-/);

    for (const pane of [content, picker]) {
      expect(pane?.className ?? '').not.toMatch(/\bp[xysetb]?-\[/);
    }
  });

  it('has no accessibility violations in its frame — header, ×, rail and switch', async () => {
    // The shell while the context loads: everything the drawer itself draws,
    // around the section skeleton (each panel's own suite axes its content).
    useMeContextMock.mockReturnValue(meCtxLoading);
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });
    await screen.findByTestId('settings-content-loading');
    expect(await axeForDialog(screen.getByTestId('settings-modal'))).toHaveNoViolations();
  });

  it('opens at the section addressed by the hash', async () => {
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });
    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument();
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
  });

  it('a team org shows member + role management in the nav', async () => {
    useOrganizationStore.getState().setOrganization('org_team', 'team');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useMeContextMock.mockReturnValue(meCtx('TEAM'));
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/general'],
    });
    expect(
      await screen.findByTestId('settings-nav-organization-members'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-organization-roles')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-account-billing')).toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-billing'),
    ).not.toBeInTheDocument();
  });

  it('a personal org hides the entire organization settings group', async () => {
    useOrganizationStore.getState().setOrganization('org_personal', 'personal');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useMeContextMock.mockReturnValue(meCtx('PERSONAL'));
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/billing'],
    });
    expect(await screen.findByTestId('settings-nav-account-billing')).toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-general'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-members'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-roles'),
    ).not.toBeInTheDocument();
  });

  it('redirects stale organization deep links to account profile with nav selected', async () => {
    useOrganizationStore.getState().setOrganization('org_personal', 'personal');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useOrganizationStore
      .getState()
      .setDeploymentContext(
        { personalOrganizations: true, teamOrganizations: false },
        'org_personal',
      );
    useMeContextMock.mockReturnValue(meCtx('PERSONAL'));
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/members'],
    });
    const profileNav = await screen.findByTestId('settings-nav-account-profile');
    expect(profileNav).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.hash).toBe('settings/account/profile');
    });
  });

  it('rewrites malformed settings hashes to the canonical default deep link', async () => {
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account123/profile123123'],
    });
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.hash).toBe('settings/account/profile');
    });
  });

  it('rewrites a bare settings hash to account profile', async () => {
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings'],
    });
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.hash).toBe('settings/account/profile');
    });
  });

  it('preserves page query params when canonicalizing the settings hash', async () => {
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/?foo=bar#settings/account123/profile123'],
    });
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.hash).toBe('settings/account/profile');
      expect(router.state.location.search).toEqual({ foo: 'bar' });
    });
  });

  // A panel that throws must not take the settings modal — or the page behind
  // it — with it. The boundary lives in ActivePanel, one per section.
  it('contains a crashing panel inside the settings modal', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    notificationsPanelThrows.value = true;
    try {
      renderWithProviders(<SettingsModal />, {
        initialEntries: ['/#settings/account/notifications'],
      });

      // The section is replaced by a retryable fallback… (The first case in this
      // file to import the notifications chunk: a cold import outlasts findBy's
      // 1s default, as the section cases above note.)
      expect(
        await screen.findByTestId(
          'settings-panel-error-notifications',
          {},
          { timeout: 15_000 },
        ),
      ).toBeInTheDocument();
      // …while the modal shell around it survives: nav, header, the lot.
      expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      expect(
        screen.queryByTestId('settings-section-notifications'),
      ).not.toBeInTheDocument();
    } finally {
      notificationsPanelThrows.value = false;
      consoleSpy.mockRestore();
    }
  });

  // ── SET-15: the rail does not guess its own shape ────────────────────────

  it('keeps account navigation usable while organization context loads', async () => {
    // Regression: WHICH organization sections exist depends on the org TYPE, and
    // an unknown type was read as "allow everything" — so the Organization group
    // painted in full and was then deleted in front of the user.
    useOrganizationStore.getState().setOrganization('org_x', 'acme');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useMeContextMock.mockReturnValue(meCtxLoading);
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    // The modal is open and sized — it just does not claim a shape yet.
    expect(await screen.findByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-account-profile')).toBeInTheDocument();
    expect(screen.getByTestId('settings-search')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
    expect(screen.getByTestId('settings-content-loading')).toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-members'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-roles'),
    ).not.toBeInTheDocument();
  });

  it('never opens an organization deep link before the org type is known', async () => {
    // The members panel used to render on the optimistic answer and then swap
    // itself for a fallback section a beat later.
    useOrganizationStore.getState().setOrganization('org_x', 'acme');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useMeContextMock.mockReturnValue(meCtxLoading);
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/members'],
    });

    expect(await screen.findByTestId('settings-nav-account-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-organization-members')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-content-loading')).toBeInTheDocument();
    // …and the hash is untouched, so the link still resolves once the context is in.
    expect(router.state.location.hash).toBe('settings/organization/members');
  });

  // ── The other half of "context ready": the permission set ─────────────────
  // Entering an organization clears the store's permissions a beat before the
  // real set lands (`ensurePermissionsFor` → `clearPermissions()`). For that beat
  // `permissions` is `[]` and `permissionsResolved` is false: "not known yet".

  it('never rewrites an organization deep link while permissions are unresolved', async () => {
    // Regression, measured in a browser: me/context already said TEAM, but the
    // store held 0 permissions for ~40 ms. The modal read that as an answer, hid
    // the Organization group, resolved the link to the fallback and REWROTE THE
    // URL to `account/profile` — 19 ms after the deep link, ~50 ms before the
    // permissions arrived. Permanently: the nav then showed the Organization
    // group, with the user parked on Profile.
    useOrganizationStore.getState().setOrganization('org_team', 'acme');
    useOrganizationStore.getState().clearPermissions();
    useMeContextMock.mockReturnValue(meCtx('TEAM'));
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/general'],
    });

    expect(await screen.findByTestId('settings-content-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-section-profile')).not.toBeInTheDocument();
    expect(router.state.location.hash).toBe('settings/organization/general');
  });

  it('opens that deep link once the permissions arrive', async () => {
    useOrganizationStore.getState().setOrganization('org_team', 'acme');
    useOrganizationStore.getState().clearPermissions();
    useMeContextMock.mockReturnValue(meCtx('TEAM'));
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/general'],
    });
    expect(await screen.findByTestId('settings-content-loading')).toBeInTheDocument();

    act(() => useOrganizationStore.getState().setPermissions(ALL_PERMS));

    expect(await screen.findByTestId('settings-section-org-general')).toBeInTheDocument();
    expect(screen.getByTestId('settings-nav-organization-members')).toBeInTheDocument();
    expect(router.state.location.hash).toBe('settings/organization/general');
  });

  it('still falls back when the ANSWER is no — a resolved set without the grant', async () => {
    // Waiting is not the same as allowing: once the set is resolved and the
    // section is genuinely out of reach, the link is canonicalized as before.
    useOrganizationStore.getState().setOrganization('org_team', 'acme');
    useOrganizationStore.getState().clearPermissions();
    useMeContextMock.mockReturnValue(meCtx('TEAM'));
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/organization/general'],
    });
    expect(await screen.findByTestId('settings-content-loading')).toBeInTheDocument();

    act(() => useOrganizationStore.getState().setPermissions([]));

    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/account/profile'),
    );
    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
  });

  it('does not wait for permissions that can never arrive (me/context has no data)', async () => {
    // The set is derived FROM me/context. A fetch that settled without data will
    // never produce one, and a modal stuck on its skeleton is worse than one
    // gated on whatever the store holds.
    useOrganizationStore.getState().clearPermissions();
    useMeContextMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isLoading: false,
      isError: true,
    });
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    expect(await screen.findByTestId('settings-section-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-content-loading')).not.toBeInTheDocument();
  });

  it('renders normally once the context resolves, with no organization group', async () => {
    useOrganizationStore.getState().setOrganization('org_personal', 'personal');
    useOrganizationStore.getState().setPermissions(ALL_PERMS);
    useMeContextMock.mockReturnValue(meCtx('PERSONAL'));
    renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });

    expect(await screen.findByTestId('settings-nav-account-profile')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-nav-loading')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-nav-organization-members'),
    ).not.toBeInTheDocument();
  });

  it('asks before leaving unsaved changes, and switches section on Leave', async () => {
    notificationsPanelDirty.value = true;
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/notifications'],
    });
    await screen.findByTestId('settings-section-notifications');

    fireEvent.click(screen.getByTestId('settings-nav-account-security'));
    expect(await screen.findByTestId('settings-discard-dialog')).toBeInTheDocument();
    expect(router.state.location.hash).toBe('settings/account/notifications');

    fireEvent.click(screen.getByTestId('settings-discard-leave'));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/account/security'),
    );
  });

  it('drops the prompt and closes once a save in flight lands — Esc mid-save', async () => {
    notificationsPanelDirty.value = true;
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/notifications'],
    });
    await screen.findByTestId('settings-section-notifications');

    // Esc while the panel's save is still in flight: its draft is not clean yet.
    fireEvent.keyDown(screen.getByTestId('settings-modal'), { key: 'Escape' });
    expect(await screen.findByTestId('settings-discard-dialog')).toBeInTheDocument();

    // The save lands: nothing is left to discard, so the close it parked goes ahead.
    act(() => notificationsPanelDirty.set(false));
    await waitFor(() =>
      expect(screen.queryByTestId('settings-discard-dialog')).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(router.state.location.hash).toBe(''));
  });

  it('switches sections from the mobile picker', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });
    await user.click(await screen.findByTestId('settings-mobile-section'));
    await user.click(await screen.findByRole('option', { name: 'Security' }));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/account/security'),
    );
  });

  it('closes by going back when Settings was opened over another page', async () => {
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/', '/#settings/account/profile'],
    });
    const back = vi.spyOn(router.history, 'back');
    fireEvent.click(await screen.findByRole('button', { name: 'Close', exact: true }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('closes by clearing the hash in place when there is nothing to go back to', async () => {
    const { router } = renderWithProviders(<SettingsModal />, {
      initialEntries: ['/#settings/account/profile'],
    });
    const back = vi.spyOn(router.history, 'back');
    fireEvent.click(await screen.findByRole('button', { name: 'Close', exact: true }));
    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(back).not.toHaveBeenCalled();
  });
});
