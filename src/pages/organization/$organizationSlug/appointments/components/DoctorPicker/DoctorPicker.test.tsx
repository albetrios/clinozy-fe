import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { renderInAppointments } from '../../__tests__/integration/appointments-test-router.tsx';
import { DoctorPicker } from './DoctorPicker.tsx';

/** Dr. Drashti (#9) and Dr. Nisha (#2) in the fixture team. */
const DRASHTI = ref.user(9);
const NISHA = ref.user(2);

function Harness({
  initial = [],
  withFooter = false,
  onChange = vi.fn(),
}: {
  initial?: string[];
  withFooter?: boolean;
  onChange?: (ids: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <DoctorPicker
      size="sm"
      value={value}
      onChange={(ids) => {
        setValue(ids);
        onChange(ids);
      }}
      meta={(id) => (id === DRASHTI ? '3 booked' : 'free')}
      withFooter={withFooter}
      testId="doctors"
    />
  );
}

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('DoctorPicker', () => {
  it('reads "All doctors", the one doctor’s name, or "<n> doctors"', async () => {
    const { unmount } = renderInAppointments(<Harness />);
    expect(await screen.findByTestId('doctors')).toHaveTextContent('All doctors');
    unmount();
    const one = renderInAppointments(<Harness initial={[DRASHTI]} />);
    await waitFor(() =>
      expect(screen.getByTestId('doctors')).toHaveTextContent('Dr. Drashti'),
    );
    one.unmount();
    renderInAppointments(<Harness initial={[DRASHTI, NISHA]} />);
    await waitFor(() =>
      expect(screen.getByTestId('doctors')).toHaveTextContent('2 doctors'),
    );
  });

  it('lists each doctor and therapist with their real role and the caller’s line', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Harness />);
    await user.click(await screen.findByTestId('doctors'));
    const panel = await screen.findByTestId('doctors-panel');
    const drashti = await within(panel).findByTestId(`doctors-option-${DRASHTI}`);
    expect(drashti).toHaveTextContent(/Dr\. Drashti.*Doctor.*3 booked/);
    const therapist = within(panel)
      .getAllByRole('option')
      .find((option) => option.textContent?.includes('Therapist'));
    expect(therapist).toBeDefined();
    expect(within(panel).getByPlaceholderText('Search team')).toBeInTheDocument();
  });

  it('picks any number and shows "Show all" · "Done" when asked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderInAppointments(<Harness withFooter onChange={onChange} />);
    await user.click(await screen.findByTestId('doctors'));
    const panel = await screen.findByTestId('doctors-panel');
    await user.click(await within(panel).findByTestId(`doctors-option-${DRASHTI}`));
    await user.click(within(panel).getByTestId(`doctors-option-${NISHA}`));
    expect(onChange).toHaveBeenLastCalledWith([DRASHTI, NISHA]);
    await user.click(within(panel).getByRole('button', { name: 'Show all' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    await user.click(within(panel).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('doctors-panel')).toBeNull());
  });

  it('has no axe violations while open', async () => {
    const user = userEvent.setup();
    renderInAppointments(<Harness withFooter />);
    await user.click(await screen.findByTestId('doctors'));
    const panel = await screen.findByTestId('doctors-panel');
    await within(panel).findByTestId(`doctors-option-${DRASHTI}`);
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });
});
