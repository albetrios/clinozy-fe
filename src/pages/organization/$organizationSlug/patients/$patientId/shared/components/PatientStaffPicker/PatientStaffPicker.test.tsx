import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientStaffPicker } from './PatientStaffPicker.tsx';
import { useDefaultStaff } from './use-default-staff.ts';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

const person = (id: string, firstName: string, roles: string[], active = true) => ({
  id,
  firstName,
  lastName: 'Shah',
  initials: `${firstName[0] ?? ''}S`,
  tone: 'sky' as const,
  roles,
  active,
});

const PEOPLE = [
  person('d1', 'Drashti', ['doctor']),
  person('d2', 'Dev', ['doctor'], false),
  person('d3', 'Dhruv', ['doctor', 'admin']),
  person('t1', 'Komal', ['therapist']),
];

const staff = vi.hoisted(() => ({
  data: undefined as unknown,
  me: undefined as { id: string } | undefined,
}));
vi.mock('@/shared/hooks/useFixtureAppointments/index.ts', () => ({
  useFixtureBookableStaff: () => ({
    data: staff.data,
    isSuccess: staff.data !== undefined,
    isError: false,
  }),
}));
vi.mock('@/shared/hooks/useTeam/index.ts', () => ({
  useMyStaffProfile: () => ({ data: staff.me }),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  staff.data = PEOPLE;
  staff.me = undefined;
});

describe('PatientStaffPicker', () => {
  it('lists the active people of its role and reports a pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PatientStaffPicker
        staffRole="doctor"
        label="Doctor"
        placeholder="Pick doctor"
        value={null}
        onChange={onChange}
        testId="doctor"
      />,
      { wrapper },
    );
    expect(screen.getByTestId('doctor')).toHaveTextContent('Pick doctor');
    await user.click(screen.getByTestId('doctor'));
    const panel = await screen.findByTestId('doctor-panel');
    const names = within(panel)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(names).toEqual([
      expect.stringContaining('Drashti Shah'),
      expect.stringContaining('Dhruv Shah'),
    ]);
    await user.click(within(panel).getByRole('option', { name: /Dhruv Shah/ }));
    expect(onChange).toHaveBeenCalledWith('d3', expect.objectContaining({ id: 'd3' }));
  });

  it('still shows a saved person who has left', () => {
    render(
      <PatientStaffPicker
        staffRole="doctor"
        label="Doctor"
        placeholder="Pick doctor"
        value="d2"
        onChange={() => undefined}
        testId="doctor"
      />,
      { wrapper },
    );
    expect(screen.getByTestId('doctor')).toHaveTextContent('Dev Shah');
  });
});

describe('useDefaultStaff', () => {
  it('starts with the last record’s person while they are active', () => {
    const { result } = renderHook(() => useDefaultStaff('doctor', 'd3'), { wrapper });
    expect(result.current).toEqual({ id: 'd3', ready: true });
  });

  it('else the member themself, when they hold the role', () => {
    staff.me = { id: 't1' };
    const { result } = renderHook(() => useDefaultStaff('therapist', 'd2'), { wrapper });
    expect(result.current).toEqual({ id: 't1', ready: true });
  });

  it('else the first active doctor; a therapist may stay empty', () => {
    const doctor = renderHook(() => useDefaultStaff('doctor', null), { wrapper });
    expect(doctor.result.current).toEqual({ id: 'd1', ready: true });
    const therapist = renderHook(() => useDefaultStaff('therapist', undefined), {
      wrapper,
    });
    expect(therapist.result.current).toEqual({ id: null, ready: true });
  });

  it('is not ready until the staff list answers', () => {
    staff.data = undefined;
    const { result } = renderHook(() => useDefaultStaff('doctor', null), { wrapper });
    expect(result.current).toEqual({ id: null, ready: false });
  });
});
