import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');
const LHR = ref.treatment(498);
const BACK_PEELING = ref.offering(271);
const D = 'check-in-drawer';
const url = (rest: string) => patientFileUrl(DHARTI, rest);
const checkInsOf = () =>
  clinicFixtures.checkIns.snapshot((row) => row.patientId === DHARTI);

async function open(path: string, role: 'admin' | 'doctor' | 'therapist' = 'doctor') {
  const user = userEvent.setup();
  const view = renderPatientFile(url(path), { role });
  const drawer = await screen.findByTestId(D);
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Visit / Aftercare check-in (KICKOFF §6.6; S:44–45)', () => {
  it('opens a visit check-in over Clinical notes with its three steps', async () => {
    const { drawer, baseElement } = await open('/check-ins/create');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Visit check-in');
    await waitFor(() => expect(drawer).toHaveTextContent(/last check-in .+: Better/));
    expect(drawer).toHaveTextContent('Dharti Galani');
    for (const step of ['How is it now', 'What they followed', 'Next plan of action']) {
      expect(drawer).toHaveTextContent(step);
    }
    expect(within(drawer).getByTestId(`${D}-now`)).toHaveAttribute(
      'placeholder',
      'Last time: Mild redness settled, skin feels smoother',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save check-in');
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('is an aftercare check-in over the section it came from when it follows a treatment', async () => {
    const { drawer } = await open(`/check-ins/create?treatment=${LHR}&from=treatments`);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Aftercare check-in',
    );
    await waitFor(() => expect(drawer).toHaveTextContent('LHR Full Face'));
    expect(screen.getByTestId('patient-section-treatments')).toBeInTheDocument();
  });

  it('asks how it is now before it saves', async () => {
    const { user, drawer } = await open('/check-ins/create');
    const before = checkInsOf().length;
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick how it is now');
    expect(checkInsOf()).toHaveLength(before);
  });

  it('saves a bad check-in with an offering — the suggestion and the doctor call-back follow', async () => {
    const { user, drawer, router } = await open('/check-ins/create');
    await user.click(within(drawer).getByTestId(`${D}-feel-worse`));
    await user.click(within(drawer).getByTestId(`${D}-score-3`));
    await user.click(within(drawer).getByTestId(`${D}-score-3`));
    expect(within(drawer).getByTestId(`${D}-score-3`)).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(drawer).getByTestId(`${D}-score-3`));
    await user.type(within(drawer).getByTestId(`${D}-now`), 'Itching again');
    await user.click(within(drawer).getByTestId(`${D}-step-followed-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-followed-partly`));
    await user.click(within(drawer).getByTestId(`${D}-step-next-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-plan`), 'Review in a week');
    await user.click(within(drawer).getByTestId(`${D}-offerings`));
    await user.click(await screen.findByTestId(`${D}-offerings-option-${BACK_PEELING}`));
    await user.keyboard('{Escape}');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Check-in saved for Dharti Galani · 1 added to suggestions · doctor call-back task created',
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('/overview')));
    expect(checkInsOf().find((row) => row.now === 'Itching again')).toMatchObject({
      feel: 'worse',
      score: 3,
      followed: 'partly',
      nextPlan: 'Review in a week',
      nextOfferingIds: [BACK_PEELING],
      context: 'Visit check-in',
      treatmentId: null,
    });
  });

  it('opens a saved one prefilled and saves its changes — “Check-in updated”', async () => {
    const [saved] = checkInsOf();
    if (!saved) throw new Error('Dharti has no check-in');
    const { user, drawer } = await open(`/check-ins/${saved.id}/edit`);
    expect(within(drawer).getByTestId(`${D}-feel-${saved.feel}`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    await user.click(within(drawer).getByTestId(`${D}-feel-much_better`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Check-in updated'),
    );
    expect(
      clinicFixtures.checkIns.snapshot((row) => row.id === saved.id)[0],
    ).toMatchObject({ feel: 'much_better', context: saved.context, date: saved.date });
  });

  it('goes back with a toast when the check-in is gone', async () => {
    const { router } = renderPatientFile(url(`/check-ins/${ref.treatment(1)}/edit`));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('/overview')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Check-in not found · it may have been deleted',
    );
  });

  it('turns a member who cannot edit patients back (S:44)', async () => {
    const { router } = renderPatientFile(url('/check-ins/create?from=visits'), {
      role: 'therapist',
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(url('/visits')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId(D)).not.toBeInTheDocument();
  });
});
