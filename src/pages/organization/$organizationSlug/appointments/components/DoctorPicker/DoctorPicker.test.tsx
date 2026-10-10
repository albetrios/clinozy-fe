import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DirectoryApiModule from '@/shared/api/clinic/directory-api.ts';
import { DOCTOR_ARJUN, DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { renderInAppointments } from '../../__tests__/integration/appointments-test-router.tsx';
import { DoctorPicker } from './DoctorPicker.tsx';

vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { directoryApiDouble } =
    await import('../../__tests__/integration/appointments-test-data.ts');
  return {
    ...(await importOriginal<typeof DirectoryApiModule>()),
    ...directoryApiDouble(),
  };
});

function Harness({
  initial,
  withFooter = false,
  onChange = vi.fn(),
}: {
  initial?: string;
  withFooter?: boolean;
  onChange?: (id: string | undefined) => void;
}) {
  const [value, setValue] = useState<string | undefined>(initial);
  return (
    <DoctorPicker
      size="sm"
      value={value}
      onChange={(id) => {
        setValue(id);
        onChange(id);
      }}
      meta={(id) => (id === DOCTOR_NISHA.id ? '3 booked' : 'free')}
      withFooter={withFooter}
      testId="doctors"
    />
  );
}

async function openPicker(harness: Parameters<typeof Harness>[0] = {}) {
  const user = userEvent.setup();
  renderInAppointments(<Harness {...harness} />);
  await user.click(await screen.findByTestId('doctors'));
  const panel = await screen.findByTestId('doctors-panel');
  await within(panel).findByTestId(`doctors-option-${DOCTOR_NISHA.id}`);
  return { user, panel };
}

beforeEach(() => signInTestMember());

describe('DoctorPicker', () => {
  it('reads "All doctors", or the one doctor’s short name once the team is in', async () => {
    const { unmount } = renderInAppointments(<Harness />);
    expect(await screen.findByTestId('doctors')).toHaveTextContent('All doctors');
    expect(screen.getByTestId('doctors')).toHaveAccessibleName(
      /Appointed to.*All doctors/,
    );
    unmount();
    renderInAppointments(<Harness initial={DOCTOR_ARJUN.id} />);
    await waitFor(() =>
      expect(screen.getByTestId('doctors')).toHaveTextContent('Arjun R.'),
    );
  });

  it('lists "All doctors", then every member of the team with the caller’s line — no role line', async () => {
    const { panel } = await openPicker();
    const options = within(panel).getAllByRole('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent(/^All doctors$/);
    expect(options[1]).toHaveTextContent(/Nisha Shah.*3 booked/);
    expect(options[2]).toHaveTextContent(/Arjun Rao.*free/);
    expect(within(panel).getByPlaceholderText('Search team')).toBeInTheDocument();
    expect(panel).not.toHaveTextContent(/Doctor|Therapist/);
  });

  it('picks one doctor and closes; "All doctors" picks nobody', async () => {
    const onChange = vi.fn();
    const { user, panel } = await openPicker({ onChange });
    await user.click(within(panel).getByTestId(`doctors-option-${DOCTOR_ARJUN.id}`));
    expect(onChange).toHaveBeenLastCalledWith(DOCTOR_ARJUN.id);
    await waitFor(() => expect(screen.queryByTestId('doctors-panel')).toBeNull());
    expect(screen.getByTestId('doctors')).toHaveTextContent('Arjun R.');

    await user.click(screen.getByTestId('doctors'));
    const again = await screen.findByTestId('doctors-panel');
    expect(
      within(again).getByTestId(`doctors-option-${DOCTOR_ARJUN.id}`),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(within(again).getByTestId('doctors-option-all'));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    await waitFor(() =>
      expect(screen.getByTestId('doctors')).toHaveTextContent('All doctors'),
    );
  });

  it('shows "Show all" · "Done" when asked: "Show all" picks nobody, "Done" closes', async () => {
    const onChange = vi.fn();
    const { user, panel } = await openPicker({
      initial: DOCTOR_NISHA.id,
      withFooter: true,
      onChange,
    });
    await user.click(within(panel).getByRole('button', { name: 'Show all' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
    await user.click(within(panel).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByTestId('doctors-panel')).toBeNull());
  });

  it('has no axe violations while open', async () => {
    const { panel } = await openPicker({ withFooter: true });
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });
});
