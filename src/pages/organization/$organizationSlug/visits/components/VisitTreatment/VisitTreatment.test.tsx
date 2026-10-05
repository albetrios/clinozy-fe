import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { notify } from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from '../../__tests__/integration/visit-test-router.tsx';
import { useVisitDraftStore } from '../../store/useVisitDraftStore/index.ts';
import { VisitPage } from '../../VisitPage.tsx';
import { segmentOf, treatmentView } from './treatment-view.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const todaysSessions = () =>
  clinicFixtures.treatments.snapshot(
    (row) => row.appointmentId === ref.appointment(2865),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
  useVisitDraftStore.setState({ drafts: {} });
  vi.mocked(notify.success).mockClear();
  vi.mocked(notify.undo).mockClear();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitTreatment (KICKOFF §6.13 Treatment)', () => {
  it('shows the session against the package and the last session', async () => {
    renderVisitRoute(visitPath(2865, 'treatment'), VisitPage, { role: 'therapist' });
    const tab = await screen.findByTestId('visit-treatment');
    await waitFor(() =>
      expect(
        within(tab).getByRole('heading', {
          level: 3,
          name: /Laser hair reduction · Legs/,
        }),
      ).toBeInTheDocument(),
    );
    expect(tab).toHaveTextContent(
      /Pack: 10 sessions, bought .+ · 3 used · today is session 4 · valid until/,
    );
    const segments = [...tab.querySelectorAll('[data-segment]')].map(
      (segment) => (segment as HTMLElement).dataset.segment,
    );
    expect(segments.filter((segment) => segment === 'used')).toHaveLength(3);
    expect(segments.filter((segment) => segment === 'today')).toHaveLength(1);
    expect(
      within(tab).getByRole('columnheader', { name: 'Session 3' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Power today')).toHaveValue('18 J/cm²');
    expect(screen.getByRole('button', { name: 'Legs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('visit-complete-session')).toHaveTextContent(
      'Complete session 4 of 10',
    );
  });

  it('records the session once with today’s settings, and the box takes the button’s place', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2865, 'treatment'), VisitPage, { role: 'therapist' });
    const power = await screen.findByLabelText('Power today');
    await user.clear(power);
    await user.type(power, '20 J/cm²');
    await user.click(screen.getByRole('button', { name: 'Face' }));
    await user.click(screen.getByTestId('visit-complete-session'));

    expect(await screen.findByTestId('visit-session-recorded')).toHaveTextContent(
      /✓ Session 4 recorded · 6 left · feedback call .+ \(Kiran P\.\)/,
    );
    expect(notify.success).toHaveBeenCalledWith(
      'Session 4 of 10 recorded once for Dhruv Patel · 6 left · feedback task for Mon',
    );
    const [session] = todaysSessions();
    expect(session).toMatchObject({ sessionNo: 4, bodyParts: ['legs', 'face'] });
    expect(session?.params.power).toBe('20 J/cm²');
    expect(screen.getByLabelText('Power today')).toBeDisabled();
  });

  it('reverses the session with a reason, its Undo restoring it', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2865, 'treatment'), VisitPage, { role: 'therapist' });
    await user.click(await screen.findByTestId('visit-complete-session'));
    await user.click(await screen.findByTestId('visit-reverse-session'));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(
      within(confirm).getByRole('button', { name: 'Reverse with reason' }),
    );
    await waitFor(() => expect(todaysSessions()).toHaveLength(0));
    expect(await screen.findByTestId('visit-complete-session')).toBeInTheDocument();
    expect(notify.undo).toHaveBeenCalledWith('Session 4 reversed', expect.any(Object));
    const [, options] = vi.mocked(notify.undo).mock.calls[0] ?? [];
    options?.onUndo();
    await waitFor(() => expect(todaysSessions()).toHaveLength(1));
  });

  it('frames the photo comparison with the capture tile and the consent line', async () => {
    renderVisitRoute(visitPath(2865, 'treatment'), VisitPage, { role: 'therapist' });
    expect(await screen.findByTestId('visit-capture')).toHaveTextContent('Capture today');
    expect(screen.getByText('Up to 6 in view')).toBeInTheDocument();
    expect(
      screen.getByText(/^Visible to doctor, therapist and counsellor\./),
    ).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderVisitRoute(visitPath(2865, 'treatment'), VisitPage, {
      role: 'therapist',
    });
    await screen.findByTestId('visit-complete-session');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});

describe('the treatment view', () => {
  it('counts a first session, without a package, from nothing', () => {
    const view = treatmentView(
      { pack: null, treatment: null, lastTreatment: null, booking: null },
      { settings: {}, areas: null },
    );
    expect(view).toMatchObject({
      session: 1,
      total: null,
      usedBefore: 0,
      left: 0,
      areas: [],
    });
    expect(view.settings).toEqual(['machine', 'power']);
    expect(view.todayOf('power')).toBe('');
  });

  it('marks each pack segment', () => {
    expect([0, 1, 2, 3].map((index) => segmentOf(index, 2, false))).toEqual([
      'used',
      'used',
      'today',
      'later',
    ]);
    expect(segmentOf(2, 3, true)).toBe('used');
    expect(segmentOf(3, 3, true)).toBe('later');
  });
});
