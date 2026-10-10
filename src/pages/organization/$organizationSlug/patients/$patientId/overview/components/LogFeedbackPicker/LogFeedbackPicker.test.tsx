import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { LogFeedbackPicker } from './LogFeedbackPicker.tsx';

const LHR = 'trt_lhr000000000000000000';
const ID = 'log-feedback-picker';

/** The patient's sessions as the Treatments section reads them — one reversed. */
const sessions = vi.hoisted(() => ({
  enabled: [] as boolean[],
  rows: [
    {
      id: 'trt_lhr000000000000000000',
      name: 'LHR Full Face',
      performedAt: '2026-10-03T06:30:00.000Z',
      status: 'done',
    },
    {
      id: 'trt_peel00000000000000000',
      name: 'Chemical peel',
      performedAt: '2026-09-28T06:30:00.000Z',
      status: 'reversed',
    },
  ],
}));
vi.mock('@/shared/hooks/useTreatments/index.ts', () => ({
  usePatientTreatments: (_patientId: string, options: { enabled: boolean }) => {
    sessions.enabled.push(options.enabled);
    return { data: options.enabled ? sessions.rows : undefined };
  },
}));

async function openPicker(viewable?: Parameters<typeof renderInPatientFile>[1]) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <LogFeedbackPicker
      patientId={TEST_PATIENT_ID}
      patientName="Priya Shah"
      from="overview"
      onClose={onClose}
    />,
    { file: patientFile(), section: 'overview', ...viewable },
  );
  const picker = await screen.findByTestId(ID);
  return { ...view, user, picker, onClose };
}

const at = (router: { state: { location: { pathname: string; search: object } } }) => ({
  path: router.state.location.pathname,
  search: router.state.location.search,
});

beforeEach(() => {
  sessions.enabled = [];
});
afterEach(() => resetPatientFile());

describe('Log feedback (KICKOFF §6.6; H:4406–4409)', () => {
  it('groups what can be logged: a consultation, the recent treatments, each review source', async () => {
    const { picker, baseElement } = await openPicker();
    expect(within(picker).getByTestId(`${ID}-title`)).toHaveTextContent('Log feedback');
    expect(picker).toHaveTextContent(
      `${fsi('Priya Shah')} · pick what you want to record`,
    );
    for (const group of ['Check-in', 'Treatment feedback', 'Review']) {
      // The titled group, and its chips' own group by the same name.
      expect(within(picker).getAllByRole('group', { name: group })).toHaveLength(2);
    }
    expect(within(picker).getByTestId(`${ID}-check-in-visit`)).toHaveAttribute(
      'title',
      'After a visit · how it is now · followed · next plan',
    );
    expect(within(picker).getByTestId(`${ID}-treatment-${LHR}`)).toHaveTextContent(
      'After LHR Full Face',
    );
    // A reversed session is not followed up.
    expect(picker).not.toHaveTextContent('Chemical peel');
    expect(
      ['google', 'video', 'instagram', 'internal_form', 'whatsapp'].map(
        (source) => within(picker).getByTestId(`${ID}-review-${source}`).textContent,
      ),
    ).toEqual(['Google', 'Video', 'Instagram', 'Feedback form', 'WhatsApp']);
    expect(within(picker).getByTestId(`${ID}-review-video`)).toHaveAttribute(
      'title',
      'Upload the testimonial',
    );
    expect(within(picker).getByTestId(`${ID}-save`)).toHaveTextContent('Close');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('closes and opens a visit check-in over the section', async () => {
    const { user, picker, onClose, router } = await openPicker();
    await user.click(within(picker).getByTestId(`${ID}-check-in-visit`));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() =>
      expect(at(router)).toEqual({
        path: `/organization/acme/patients/${TEST_PATIENT_ID}/check-ins/create`,
        search: { from: 'overview' },
      }),
    );
  });

  it('opens an aftercare check-in for a treatment, and a review on its source', async () => {
    const { user, picker, router } = await openPicker();
    await user.click(within(picker).getByTestId(`${ID}-treatment-${LHR}`));
    await waitFor(() =>
      expect(at(router).search).toEqual({ from: 'overview', treatment: LHR }),
    );
    await user.click(within(picker).getByTestId(`${ID}-review-whatsapp`));
    await waitFor(() =>
      expect(at(router)).toEqual({
        path: `/organization/acme/patients/${TEST_PATIENT_ID}/reviews/create`,
        search: { from: 'overview', source: 'whatsapp' },
      }),
    );
  });

  it('offers no treatment check-ins to a member who may not read treatments', async () => {
    const { picker } = await openPicker({ viewable: ['overview', 'visits'] });
    expect(sessions.enabled).not.toContain(true);
    expect(
      within(picker).queryAllByRole('group', { name: 'Treatment feedback' }),
    ).toHaveLength(0);
  });

  it('closes on "Close"', async () => {
    const { user, picker, onClose } = await openPicker();
    await user.click(within(picker).getByTestId(`${ID}-save`));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
