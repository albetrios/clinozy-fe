import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClinicProfile } from '@/shared/api/app/clinic-api.ts';
import type {
  OnboardingSetup,
  OnboardingSetupGuideItem,
} from '@/shared/api/app/onboarding-setup-contracts.ts';
import { STARTER_SERVICES } from '@/shared/app/app-starter-services.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import type * as AppRolesModule from '@/shared/hooks/useAppRoles/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const state = vi.hoisted(() => ({
  changeMutate: vi.fn(),
  offerings: [] as { id: string; name: string; price: number }[],
  createMutateAsync: vi.fn(),
}));
vi.mock('@/shared/hooks/useOnboardingSetup/index.ts', () => ({
  useChangeOnboardingSetup: () => ({ mutate: state.changeMutate, isPending: false }),
}));
vi.mock('@/shared/hooks/useOfferings/index.ts', () => ({
  useOfferings: () => ({ data: state.offerings }),
  useCreateOffering: () => ({ mutateAsync: state.createMutateAsync, isPending: false }),
}));
vi.mock('@/shared/components/OfferingQuickCreate/index.ts', () => ({
  OfferingQuickCreate: () => null,
}));
vi.mock('@/shared/components/InviteMemberDialog/index.ts', () => ({
  InviteMemberDialog: ({ defaultRoleId }: { defaultRoleId: string }) => (
    <div data-testid="invite-member-stub" data-role={defaultRoleId} />
  ),
}));
vi.mock('@/shared/hooks/useAppRoles/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppRolesModule>()),
  useAppRoles: () => ({
    roles: [
      { id: 'rol_doctor', name: 'Doctor', tone: 'sky', isSystem: true, preset: 'doctor' },
    ],
    byId: new Map(),
    label: (role: { name: string }) => role.name,
    labelOf: () => '',
    toneOf: () => 'stone',
    isPending: false,
  }),
}));
vi.mock('./setup-analytics.ts', () => ({
  setupEvents: { guideItem: vi.fn(), guideHidden: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { setupEvents } from './setup-analytics.ts';
import { SetupGuide } from './SetupGuide.tsx';

const PROFILE: ClinicProfile = {
  name: 'Acme Skin Clinic',
  specialties: ['skin'],
  timezone: 'Asia/Kolkata',
  createdAt: '2026-10-01T04:30:00Z',
  updatedAt: '2026-10-13T04:30:00Z',
};

const item = (
  key: OnboardingSetupGuideItem['key'],
  overrides: Partial<OnboardingSetupGuideItem> = {},
): OnboardingSetupGuideItem => ({
  key,
  isDone: false,
  isSkipped: false,
  canSkip: key !== 'first_appointment',
  ...overrides,
});

/** A live clinic's setup, the guide open. */
function liveSetup(overrides: Partial<OnboardingSetup> = {}): OnboardingSetup {
  return {
    answeredSteps: ['clinic_type', 'you'],
    skippedItems: [],
    mainBranchId: 'brn_mainaaaaaaaaaaaaaaaaa',
    nextStep: null,
    liveChecks: { clinic_type: true, main_branch: true, services: true },
    isLive: true,
    hasSomeoneToBook: true,
    guideItems: [item('treatments'), item('invite_team'), item('first_appointment')],
    guideDoneCount: 0,
    guideTotalCount: 3,
    deferredAt: null,
    completedAt: '2026-10-13T05:00:00Z',
    guideHiddenAt: null,
    guideDoneAt: null,
    completedByMembershipId: 'mem_owneraaaaaaaaaaaaaaaa',
    updatedAt: '2026-10-13T05:00:00Z',
    ...overrides,
  };
}

function renderGuide({
  setup = liveSetup(),
  profile = PROFILE,
  onBook = vi.fn(),
  onClose = vi.fn(),
}: {
  setup?: OnboardingSetup;
  profile?: ClinicProfile;
  onBook?: () => void;
  onClose?: () => void;
} = {}) {
  const view = renderWithProviders(
    <SetupGuide setup={setup} profile={profile} onBook={onBook} onClose={onClose} />,
  );
  return { ...view, onBook, onClose, user: userEvent.setup() };
}

/** A starter row's test id, as the list keys it. */
const rowId = (specialty: string, name: string) =>
  `setup-starter-row-${specialty}-starter.names.${name}`;

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({
    user: { id: 'usr_1', email: 'owner@acme.test', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore
    .getState()
    .setPermissions(['membership:create', 'organization:update']);
  state.offerings = [];
  state.createMutateAsync.mockImplementation(
    async ({ fields }: { fields: { name: string } }) => ({
      id: `ofr_${fields.name}`,
      name: fields.name,
    }),
  );
});

describe('SetupGuide — the items', () => {
  it('reads each item’s state and the count from the setup', async () => {
    renderGuide({
      setup: liveSetup({
        guideItems: [
          item('treatments', { isDone: true }),
          item('invite_team', { isSkipped: true }),
          item('first_appointment'),
        ],
        guideDoneCount: 2,
      }),
    });

    const guide = await screen.findByTestId('setup-guide');
    expect(within(guide).getByText('2 of 3 done')).toBeInTheDocument();
    expect(within(guide).getByTestId('setup-guide-consultation')).toHaveTextContent(
      'Consultation added',
    );
    expect(screen.getByTestId('setup-guide-item-treatments')).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.getByTestId('setup-guide-item-treatments')).toHaveTextContent('Done');
    expect(screen.getByTestId('setup-guide-item-invite_team')).toHaveAttribute(
      'data-state',
      'skipped',
    );
    expect(screen.getByTestId('setup-guide-item-first_appointment')).toHaveAttribute(
      'data-state',
      'open',
    );
    // A done item offers nothing; a skipped one only "Undo skip".
    expect(
      screen.queryByTestId('setup-guide-item-treatments-action'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('setup-guide-item-treatments-skip'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('setup-guide-item-invite_team-action'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('setup-guide-item-invite_team-skip')).toHaveTextContent(
      'Undo skip',
    );
    expect(await axeForDialog(guide)).toHaveNoViolations();
  });

  it('asks to invite the team while someone can be booked, the doctor while nobody can (D15)', async () => {
    const { unmount } = renderGuide();
    expect(await screen.findByTestId('setup-guide-item-invite_team')).toHaveTextContent(
      'Invite your team',
    );
    unmount();

    renderGuide({ setup: liveSetup({ hasSomeoneToBook: false }) });
    const row = await screen.findByTestId('setup-guide-item-invite_team');
    expect(row).toHaveTextContent('Invite your doctor');
    expect(row).toHaveTextContent('Nobody can be booked yet');
  });

  it('opens the invite on the Doctor role while nobody can be booked', async () => {
    const { user } = renderGuide({ setup: liveSetup({ hasSomeoneToBook: false }) });
    await user.click(await screen.findByTestId('setup-guide-item-invite_team-action'));
    expect(screen.getByTestId('invite-member-stub')).toHaveAttribute(
      'data-role',
      'rol_doctor',
    );
  });

  it('offers Skip on the skippable items only', async () => {
    renderGuide();
    expect(
      await screen.findByTestId('setup-guide-item-treatments-skip'),
    ).toHaveTextContent('Skip');
    expect(screen.getByTestId('setup-guide-item-invite_team-skip')).toBeInTheDocument();
    expect(
      screen.queryByTestId('setup-guide-item-first_appointment-skip'),
    ).not.toBeInTheDocument();
  });

  it('skips an item on the server, and counts it', async () => {
    const { user } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-skip'));
    expect(state.changeMutate).toHaveBeenCalledWith({ skippedItemsAdd: ['treatments'] });
    expect(setupEvents.guideItem).toHaveBeenCalledWith('treatments', 'skipped');
  });

  it('undoes a skip on the server', async () => {
    const { user } = renderGuide({
      setup: liveSetup({
        guideItems: [
          item('treatments'),
          item('invite_team', { isSkipped: true }),
          item('first_appointment'),
        ],
      }),
    });
    await user.click(await screen.findByTestId('setup-guide-item-invite_team-skip'));
    expect(state.changeMutate).toHaveBeenCalledWith({
      skippedItemsRemove: ['invite_team'],
    });
    expect(setupEvents.guideItem).not.toHaveBeenCalled();
  });

  it('hides the guide, then says where it went and closes', async () => {
    const { user, onClose } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-hide'));

    expect(state.changeMutate).toHaveBeenCalledWith(
      { guideHidden: true },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(onClose).not.toHaveBeenCalled();
    const [, options] = state.changeMutate.mock.calls[0] as [
      unknown,
      { onSuccess: () => void },
    ];
    options.onSuccess();
    expect(setupEvents.guideHidden).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith(
      'Guide hidden — reopen it from Clinic settings.',
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('books the first appointment from its row', async () => {
    const { user, onBook } = renderGuide();
    await user.click(
      await screen.findByTestId('setup-guide-item-first_appointment-action'),
    );
    expect(onBook).toHaveBeenCalled();
  });

  it('reads “Your clinic is ready” once every item is done or skipped, with Clinic settings', async () => {
    const { user, router } = renderGuide({
      setup: liveSetup({
        guideItems: [
          item('treatments', { isDone: true }),
          item('invite_team', { isSkipped: true }),
          item('first_appointment', { isDone: true }),
        ],
        guideDoneCount: 3,
      }),
    });

    const ready = await screen.findByTestId('setup-guide-ready');
    expect(ready).toHaveTextContent('Your clinic is ready');
    expect(screen.queryByTestId('setup-guide-item-treatments')).not.toBeInTheDocument();

    await user.click(within(ready).getByRole('button', { name: 'Clinic settings' }));
    await waitFor(() =>
      expect(router.state.location.hash).toBe('settings/organization/clinic'),
    );
  });

  it('stays ready once the moment was stored, whatever the items read now (D20)', async () => {
    renderGuide({ setup: liveSetup({ guideDoneAt: '2026-10-13T06:00:00Z' }) });
    expect(await screen.findByTestId('setup-guide-ready')).toBeInTheDocument();
  });
});

describe('SetupGuide — the starter list', () => {
  it('lists the chosen specialty’s rows, the Consultation ticked', async () => {
    const { user } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));

    const list = await screen.findByTestId('setup-starter');
    const skinRows = STARTER_SERVICES.filter((service) => service.specialty === 'skin');
    expect(within(list).getAllByRole('listitem')).toHaveLength(skinRows.length);
    expect(within(list).getByLabelText('Add Consultation')).toBeChecked();
    expect(within(list).getByLabelText('Add Chemical peel')).not.toBeChecked();
    expect(screen.getByTestId('setup-starter-add')).toHaveTextContent('Add 1 treatment');
    expect(await axeForDialog(screen.getByTestId('setup-guide'))).toHaveNoViolations();
  });

  it('shows an existing Consultation as “Added” and never sends it again', async () => {
    state.offerings = [{ id: 'ofr_consult', name: 'Consultation', price: 500 }];
    const { user, onBook } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));

    const consultation = await screen.findByTestId(rowId('skin', 'consultation'));
    expect(consultation).toHaveTextContent('Added');
    expect(within(consultation).getByRole('checkbox')).toBeDisabled();
    expect(screen.getByTestId('setup-starter-add')).toHaveTextContent('Add 0 treatments');

    await user.click(
      within(screen.getByTestId(rowId('skin', 'chemicalPeel'))).getByRole('checkbox'),
    );
    await user.click(
      within(screen.getByTestId(rowId('skin', 'hydrafacial'))).getByRole('checkbox'),
    );
    expect(screen.getByTestId('setup-starter-add')).toHaveTextContent('Add 2 treatments');
    await user.click(screen.getByTestId('setup-starter-add'));

    await waitFor(() => expect(state.createMutateAsync).toHaveBeenCalledTimes(2));
    expect(state.createMutateAsync).toHaveBeenNthCalledWith(1, {
      fields: expect.objectContaining({
        name: 'Chemical peel',
        category: 'treatment',
        price: 2500,
        gstPercent: 18,
        durationMin: 30,
      }),
      specialty: 'skin',
    });
    expect(state.createMutateAsync).toHaveBeenNthCalledWith(2, {
      fields: expect.objectContaining({ name: 'Hydrafacial', price: 3500 }),
      specialty: 'skin',
    });
    expect(notify.success).toHaveBeenCalledWith('2 treatments added');
    expect(setupEvents.guideItem).toHaveBeenCalledWith('treatments', 'done');
    // Back to the guide's items.
    expect(await screen.findByTestId('setup-guide-item-treatments')).toBeInTheDocument();
    expect(onBook).not.toHaveBeenCalled();
  });

  it('sends a row as edited', async () => {
    const { user } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));
    const row = await screen.findByTestId(rowId('skin', 'consultation'));
    const price = within(row).getByLabelText('Price');
    await user.clear(price);
    await user.type(price, '650');
    await user.click(screen.getByTestId('setup-starter-add'));

    await waitFor(() =>
      expect(state.createMutateAsync).toHaveBeenCalledWith({
        fields: expect.objectContaining({ name: 'Consultation', price: 650 }),
        specialty: 'skin',
      }),
    );
  });

  it('names each Consultation for its specialty with two or more', async () => {
    const { user } = renderGuide({
      profile: { ...PROFILE, specialties: ['skin', 'hair'] },
    });
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));
    expect(await screen.findByLabelText('Add Skin consultation')).toBeChecked();
    expect(screen.getByLabelText('Add Hair consultation')).toBeChecked();
    expect(screen.getByTestId('setup-starter-add')).toHaveTextContent('Add 2 treatments');
  });

  it('asks for a tick when nothing is ticked', async () => {
    const { user } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));
    await user.click(await screen.findByLabelText('Add Consultation'));
    await user.click(screen.getByTestId('setup-starter-add'));

    expect(notify.info).toHaveBeenCalledWith('Tick at least one treatment.');
    expect(state.createMutateAsync).not.toHaveBeenCalled();
  });

  it('goes back to the guide', async () => {
    const { user } = renderGuide();
    await user.click(await screen.findByTestId('setup-guide-item-treatments-action'));
    await user.click(await screen.findByTestId('setup-starter-back'));
    expect(await screen.findByTestId('setup-guide-item-treatments')).toBeInTheDocument();
  });
});
