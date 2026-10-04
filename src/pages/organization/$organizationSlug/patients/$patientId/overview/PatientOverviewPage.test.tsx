import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const DHARTI = patientRef('Dharti Galani');
const CARDS = [
  'clinical-card-complaints',
  'clinical-card-diagnosis',
  'clinical-card-treatment-suggestions',
  'clinical-card-future-suggestions',
];

async function openNotes(role: 'admin' | 'therapist' = 'admin') {
  const user = userEvent.setup();
  const view = renderPatientFile(patientFileUrl(DHARTI, '/overview'), { role });
  await screen.findAllByTestId('clinical-card-complaints-chip');
  return { ...view, user };
}

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('PatientOverviewPage — Clinical notes (KICKOFF §6.6; H:780–826)', () => {
  it('lays the four chip cards out by its own width, over the plan and Feedback', async () => {
    const { container } = await openNotes();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Clinical notes' }),
    ).toBeInTheDocument();
    for (const id of CARDS) {
      expect(screen.getByTestId(id)).toHaveClass(
        'col-span-12',
        '@min-[620px]:col-span-6',
        '@min-[980px]:col-span-3',
      );
    }
    expect(screen.getByTestId(CARDS[0] ?? '').parentElement).toHaveClass(
      '@container',
      'grid-cols-12',
    );
    expect(screen.getByTestId('clinical-card-diagnosis')).toHaveTextContent(
      'Post-inflammatory hyperpigmentation',
    );
    expect(await screen.findByTestId('offering-suggestions')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-card')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('adds a complaint to the patient — ringed as new', async () => {
    const { user } = await openNotes();
    const card = screen.getByTestId('clinical-card-complaints');
    await user.type(
      within(card).getByRole('textbox', { name: 'Add Complaints' }),
      'Dry patches{Enter}',
    );
    expect(within(card).getByTestId('clinical-card-complaints-new')).toHaveTextContent(
      '1 new',
    );
    await waitFor(async () =>
      expect((await clinicFixtures.patients.get(DHARTI)).complaints).toBe(
        'Tanning on face\nUneven skin tone\nDry patches',
      ),
    );
  });

  it('opens the Log feedback picker, and a card’s Edit over this section', async () => {
    const { user, router } = await openNotes();
    const feedback = screen.getByTestId('feedback-card');
    await user.click(within(feedback).getByTestId('feedback-card-log'));
    expect(await screen.findByTestId('log-feedback-picker')).toBeInTheDocument();
    await user.click(screen.getByTestId('log-feedback-picker-save'));
    await user.click(within(feedback).getByTestId('feedback-card-toggle'));
    await user.click(await within(feedback).findByTestId('feedback-card-type-visit'));
    await waitFor(() =>
      expect(within(feedback).getAllByTestId('feedback-card-item')).toHaveLength(1),
    );
    await user.click(within(feedback).getByTestId('feedback-card-item-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/\/check-ins\/[\w-]+\/edit$/),
    );
    expect(router.state.location.search).toEqual({ from: 'overview' });
    expect(await screen.findByTestId('check-in-drawer')).toBeInTheDocument();
  });

  it('only reads without Patients edit', async () => {
    await openNotes('therapist');
    expect(
      within(screen.getByTestId('clinical-card-complaints')).queryByRole('textbox'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('feedback-card-log')).not.toBeInTheDocument();
  });
});
