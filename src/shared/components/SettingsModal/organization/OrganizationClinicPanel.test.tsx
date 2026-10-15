import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import i18n from '@/lib/i18n/i18n.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import {
  SETTINGS_KEYS,
  SETTINGS_NS,
} from '@/shared/components/SettingsModal/settings.constants.ts';
import {
  SettingsDirtyProvider,
  useSettingsDirty,
} from '@/shared/components/SettingsModal/settings-dirty.tsx';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const K = SETTINGS_KEYS.panels.clinic;

/** The panel's copy as the bundle renders it — never the English literal. */
const copy = (key: string, options: Record<string, unknown> = {}) =>
  i18n.t(key, { ns: SETTINGS_NS, lng: 'en', ...options });

const {
  fetchProfileMock,
  updateProfileMock,
  fetchSettingsMock,
  updateSettingsMock,
  fetchSetupMock,
  changeSetupMock,
  notifySuccessMock,
} = vi.hoisted(() => ({
  fetchProfileMock: vi.fn(),
  updateProfileMock: vi.fn(),
  fetchSettingsMock: vi.fn(),
  updateSettingsMock: vi.fn(),
  fetchSetupMock: vi.fn(),
  changeSetupMock: vi.fn(),
  notifySuccessMock: vi.fn(),
}));
// Only the fetchers are stubbed: the hooks, keys and defaults are the real ones.
vi.mock('@/shared/api/app/clinic-api.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchClinicProfile: fetchProfileMock,
  updateClinicProfile: updateProfileMock,
  fetchClinicSettings: fetchSettingsMock,
  updateClinicSettings: updateSettingsMock,
}));
vi.mock('@/shared/api/app/onboarding-setup-api.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchOnboardingSetup: fetchSetupMock,
  changeOnboardingSetup: changeSetupMock,
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: notifySuccessMock, error: vi.fn(), info: vi.fn() },
}));

import { OrganizationClinicPanel } from './OrganizationClinicPanel.tsx';

const PROFILE = {
  name: 'Sunrise Skin',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  updatedAt: '2026-10-13T10:00:00.000Z',
};

const SETTINGS = {
  reminderHour: 16,
  leadHoldDays: 3,
  retargetAfterDays: 90,
  updatedAt: '2026-10-13T10:00:00.000Z',
};

function setup(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: ['clinic_type', 'you'],
    skippedItems: [],
    mainBranchId: `brn_${'a'.repeat(21)}`,
    nextStep: null,
    liveChecks: { clinic_type: true, main_branch: true, services: true },
    isLive: true,
    hasSomeoneToBook: true,
    guideItems: [],
    guideDoneCount: 1,
    guideTotalCount: 3,
    deferredAt: null,
    completedAt: '2026-10-13T10:00:00.000Z',
    guideHiddenAt: null,
    guideDoneAt: null,
    completedByMembershipId: `mbr_${'a'.repeat(21)}`,
    updatedAt: '2026-10-13T10:00:00.000Z',
    ...overrides,
  };
}

const MANAGER: OrganizationPermission[] = [
  'organization:read',
  'organization:update',
  'branch:read',
];

function hold(permissions: OrganizationPermission[]) {
  useAuthStore.setState({
    user: { id: 'usr_1', email: 'owner@clinic.test', role: 'user' },
    isAuthenticated: true,
  });
  useOrganizationStore.setState({
    organizationId: `org_${'a'.repeat(21)}`,
    organizationSlug: 'sunrise',
    organizationType: 'TEAM',
    permissions,
    permissionsResolved: true,
  });
}

/** Shows whether the Settings drawer would ask before closing. */
function DirtyProbe() {
  return <p data-testid="dirty-probe">{String(useSettingsDirty()?.isDirty ?? false)}</p>;
}

function renderPanel() {
  return renderWithProviders(
    <SettingsDirtyProvider>
      <OrganizationClinicPanel />
      <DirtyProbe />
    </SettingsDirtyProvider>,
    { initialEntries: ['/#settings/organization/clinic'] },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  fetchProfileMock.mockResolvedValue(PROFILE);
  fetchSettingsMock.mockResolvedValue(SETTINGS);
  fetchSetupMock.mockResolvedValue(setup());
  hold(MANAGER);
});

afterEach(() => {
  act(() => useOrganizationStore.getState().clearOrganization());
});

describe('OrganizationClinicPanel', () => {
  it("shows the clinic's values, each operating value with its default", async () => {
    const { container } = renderPanel();
    expect(await screen.findByTestId('settings-section-org-clinic')).toBeInTheDocument();
    const skin = await screen.findByTestId('org-clinic-specialties-skin');
    expect(skin).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('org-clinic-specialties-hair')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByTestId('org-clinic-timezone')).toHaveTextContent('Asia/Kolkata');
    expect(await screen.findByTestId('org-clinic-lead-hold-days')).toHaveValue('3');
    expect(screen.getByTestId('org-clinic-retarget-after-days')).toHaveValue('90');
    expect(screen.getByTestId('org-clinic-reminder-hour')).toHaveTextContent(/4:00/);
    expect(screen.getByText(copy(K.defaultHint, { value: '3' }))).toBeInTheDocument();
    expect(screen.getByText(copy(K.defaultHint, { value: '90' }))).toBeInTheDocument();
    // Nothing changed yet: both saves wait, and the drawer has nothing to guard.
    expect(screen.getByTestId('org-clinic-profile-save')).toBeDisabled();
    expect(screen.getByTestId('org-clinic-operations-save')).toBeDisabled();
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('false');
    // No cash-drawer float anywhere (D17).
    expect(screen.queryByText(/float/i)).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('saves only the specialties that changed, in pick order', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockResolvedValue({ ...PROFILE, specialties: ['skin', 'hair'] });
    renderPanel();
    await user.click(await screen.findByTestId('org-clinic-specialties-hair'));
    expect(screen.getByTestId('dirty-probe')).toHaveTextContent('true');
    await user.click(screen.getByTestId('org-clinic-profile-save'));
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        change: { specialties: ['skin', 'hair'] },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('dirty-probe')).toHaveTextContent('false'),
    );
    expect(notifySuccessMock).toHaveBeenCalledWith(copy(K.saved));
  });

  it('refuses a clinic with no specialty before calling the API', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByTestId('org-clinic-specialties-skin'));
    await user.click(screen.getByTestId('org-clinic-profile-save'));
    expect(await screen.findByText(copy(K.specialtiesRequired))).toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('saves a changed timezone', async () => {
    const user = userEvent.setup();
    updateProfileMock.mockResolvedValue({ ...PROFILE, timezone: 'Asia/Dubai' });
    renderPanel();
    await user.click(await screen.findByTestId('org-clinic-timezone'));
    await user.click(await screen.findByTestId('org-clinic-timezone-option-Asia/Dubai'));
    await user.click(screen.getByTestId('org-clinic-profile-save'));
    await waitFor(() =>
      expect(updateProfileMock).toHaveBeenCalledWith({
        change: { timezone: 'Asia/Dubai' },
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it('saves only the operating values that changed', async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockResolvedValue({ ...SETTINGS, leadHoldDays: 4 });
    renderPanel();
    await user.click(await screen.findByTestId('org-clinic-lead-hold-days-increase'));
    await user.click(screen.getByTestId('org-clinic-operations-save'));
    await waitFor(() =>
      expect(updateSettingsMock).toHaveBeenCalledWith({
        change: { leadHoldDays: 4 },
        idempotencyKey: expect.any(String),
      }),
    );
  });

  it("puts clinozy-be's 400 field error under its field, without a toast", async () => {
    const user = userEvent.setup();
    updateSettingsMock.mockRejectedValue(
      new HttpError('refused', 400, '/tenancy/organization/settings', 'PATCH', {
        error: {
          type: 'validation_error',
          errors: [
            { field: 'body.retarget_after_days', message: 'Too soon to retarget.' },
          ],
        },
      }),
    );
    renderPanel();
    await user.click(
      await screen.findByTestId('org-clinic-retarget-after-days-increase'),
    );
    await user.click(screen.getByTestId('org-clinic-operations-save'));
    const field = screen.getByTestId('org-clinic-retarget-after-days');
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('alert')).toHaveTextContent('Too soon to retarget.');
    expect(field.getAttribute('aria-describedby')).toContain(
      'org-clinic-retargetAfterDays-error',
    );
  });

  it('is read-only without organization:update', async () => {
    hold(['organization:read', 'branch:read']);
    renderPanel();
    expect(await screen.findByTestId('org-clinic-read-only')).toHaveTextContent(
      copy(K.readOnly),
    );
    expect(await screen.findByTestId('org-clinic-specialties-skin')).toBeDisabled();
    expect(await screen.findByTestId('org-clinic-lead-hold-days')).toBeDisabled();
    expect(screen.queryByTestId('org-clinic-profile-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('org-clinic-operations-save')).not.toBeInTheDocument();
    // The setup is a manager's (D19): it is not even read.
    expect(fetchSetupMock).not.toHaveBeenCalled();
  });

  it('links to the Branches room only for a member who can open it', async () => {
    const { unmount } = renderPanel();
    const open = await screen.findByTestId('settings-branches-open-branches');
    expect(open).toHaveAttribute('href', '/organization/sunrise/branches');
    unmount();

    hold(['organization:read', 'organization:update']);
    renderPanel();
    await screen.findByTestId('org-clinic-specialties-skin');
    expect(
      screen.queryByTestId('settings-branches-open-branches'),
    ).not.toBeInTheDocument();
  });

  it('switches to General for the logo, keeping the page underneath', async () => {
    const user = userEvent.setup();
    const { router } = renderPanel();
    await user.click(await screen.findByTestId('org-clinic-open-general'));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/organization/general'),
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('offers "Show the setup guide again" only while the guide is hidden', async () => {
    renderPanel();
    await screen.findByTestId('org-clinic-specialties-skin');
    await waitFor(() => expect(fetchSetupMock).toHaveBeenCalled());
    expect(screen.queryByTestId('org-clinic-show-guide')).not.toBeInTheDocument();
  });

  it('shows the hidden guide again', async () => {
    const user = userEvent.setup();
    fetchSetupMock.mockResolvedValue(
      setup({ guideHiddenAt: '2026-10-13T11:00:00.000Z' }),
    );
    changeSetupMock.mockResolvedValue(setup());
    renderPanel();
    const card = await screen.findByTestId('org-clinic-guide');
    await user.click(within(card).getByTestId('org-clinic-show-guide'));
    await waitFor(() =>
      expect(changeSetupMock).toHaveBeenCalledWith({
        change: { guideHidden: false },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(notifySuccessMock).toHaveBeenCalledWith(copy(K.guideShown));
    // The answer is the setup's entry: the guide is no longer hidden, so the card goes.
    await waitFor(() =>
      expect(screen.queryByTestId('org-clinic-guide')).not.toBeInTheDocument(),
    );
  });
});
