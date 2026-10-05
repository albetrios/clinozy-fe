import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { LogFeedbackPicker } from './LogFeedbackPicker.tsx';

const DHARTI = patientRef('Dharti Galani');
const LHR = ref.treatment(498);
const ID = 'log-feedback-picker';

async function openPicker() {
  const onClose = vi.fn();
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <LogFeedbackPicker
      patientId={DHARTI}
      patientName="Dharti Galani"
      from="overview"
      onClose={onClose}
    />,
    { section: 'overview' },
  );
  const picker = await screen.findByTestId(ID);
  await within(picker).findByTestId(`${ID}-treatment-${LHR}`);
  return { ...view, user, picker, onClose };
}

const at = (router: { state: { location: { pathname: string; search: object } } }) => ({
  path: router.state.location.pathname,
  search: router.state.location.search,
});

beforeEach(() => resetClinicFixtures());
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Log feedback (KICKOFF §6.6; H:4406–4409)', () => {
  it('groups what can be logged: a consultation, the recent treatments, each review source', async () => {
    const { picker, baseElement } = await openPicker();
    expect(within(picker).getByTestId(`${ID}-title`)).toHaveTextContent('Log feedback');
    expect(picker).toHaveTextContent(
      `${fsi('Dharti Galani')} · pick what you want to record`,
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
        path: `/organization/acme/patients/${DHARTI}/check-ins/create`,
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
        path: `/organization/acme/patients/${DHARTI}/reviews/create`,
        search: { from: 'overview', source: 'whatsapp' },
      }),
    );
  });

  it('closes on "Close"', async () => {
    const { user, picker, onClose } = await openPicker();
    await user.click(within(picker).getByTestId(`${ID}-save`));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
