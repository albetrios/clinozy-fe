import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { fetchTeamDirectory } from '@/shared/api/app/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  teamDoctor,
} from '@/tests/utils/appointment-doubles.ts';

import { PatientStaffPicker } from './PatientStaffPicker.tsx';
import { useDefaultStaff } from './use-default-staff.ts';
import { useStaffMember } from './use-staff-member.ts';

vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));
// The team (`GET /app/memberships`) and the signed-in member's own membership.
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));

/** Komal Patel — on the team, no doctor or therapist role to tell her apart (M41). */
const KOMAL = teamDoctor({
  id: 'mem_komal0000000000000000',
  userId: 'usr_test',
  name: 'Komal Patel',
  initials: 'KP',
  tone: 'blush',
});

/** Dev Mehta — on an old record, no longer on the team. */
const FORMER = 'mem_dev00000000000000000';

const TEAM = [DOCTOR_ARJUN, KOMAL, DOCTOR_NISHA];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderPicker(value: string | null, onChange = vi.fn()) {
  return render(
    <PatientStaffPicker
      label="Doctor"
      placeholder="Pick doctor"
      value={value}
      onChange={onChange}
      testId="doctor"
    />,
    { wrapper },
  );
}

beforeEach(() => {
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue(TEAM);
  vi.mocked(findMyMembershipId).mockResolvedValue(KOMAL.id);
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('PatientStaffPicker', () => {
  it('lists the whole team — no doctor or therapist roles — and reports a pick', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderPicker(null, onChange);
    expect(screen.getByTestId('doctor')).toHaveTextContent('Pick doctor');
    await waitFor(() => expect(fetchTeamDirectory).toHaveBeenCalled());
    await user.click(screen.getByTestId('doctor'));
    const panel = await screen.findByTestId('doctor-panel');
    await waitFor(() =>
      expect(
        within(panel)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual([
        expect.stringContaining('Arjun Rao'),
        expect.stringContaining('Komal Patel'),
        expect.stringContaining('Nisha Shah'),
      ]),
    );
    await user.click(within(panel).getByRole('option', { name: /Komal Patel/ }));
    expect(onChange).toHaveBeenCalledWith(KOMAL.id, KOMAL);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('shows the picked member by name', async () => {
    renderPicker(DOCTOR_NISHA.id);
    await waitFor(() =>
      expect(screen.getByTestId('doctor')).toHaveTextContent('Nisha Shah'),
    );
  });

  it('shows the placeholder for someone no longer on the team', async () => {
    renderPicker(FORMER);
    await waitFor(() => expect(fetchTeamDirectory).toHaveBeenCalled());
    expect(screen.getByTestId('doctor')).toHaveTextContent('Pick doctor');
  });
});

describe('useDefaultStaff', () => {
  it('starts with the last record’s member while they are on the team', async () => {
    const { result } = renderHook(() => useDefaultStaff('doctor', DOCTOR_NISHA.id), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current).toEqual({ id: DOCTOR_NISHA.id, ready: true }),
    );
  });

  it('else the signed-in member, for a doctor and a therapist alike', async () => {
    const doctor = renderHook(() => useDefaultStaff('doctor', FORMER), { wrapper });
    await waitFor(() =>
      expect(doctor.result.current).toEqual({ id: KOMAL.id, ready: true }),
    );
    const therapist = renderHook(() => useDefaultStaff('therapist', null), { wrapper });
    await waitFor(() =>
      expect(therapist.result.current).toEqual({ id: KOMAL.id, ready: true }),
    );
  });

  it('else the first member for a doctor; a therapist may stay empty', async () => {
    vi.mocked(findMyMembershipId).mockResolvedValue(null);
    const doctor = renderHook(() => useDefaultStaff('doctor', null), { wrapper });
    await waitFor(() =>
      expect(doctor.result.current).toEqual({ id: DOCTOR_ARJUN.id, ready: true }),
    );
    const therapist = renderHook(() => useDefaultStaff('therapist', undefined), {
      wrapper,
    });
    await waitFor(() =>
      expect(therapist.result.current).toEqual({ id: null, ready: true }),
    );
  });

  it('passes over a signed-in member who is not on the team', async () => {
    vi.mocked(findMyMembershipId).mockResolvedValue('mem_elsewhere000000000000');
    const { result } = renderHook(() => useDefaultStaff('doctor', null), { wrapper });
    await waitFor(() =>
      expect(result.current).toEqual({ id: DOCTOR_ARJUN.id, ready: true }),
    );
  });

  it('is not ready until the team and the member’s own membership answer', async () => {
    let answerTeam: ((team: typeof TEAM) => void) | undefined;
    vi.mocked(fetchTeamDirectory).mockReturnValue(
      new Promise((resolve) => {
        answerTeam = resolve;
      }),
    );
    const { result } = renderHook(() => useDefaultStaff('doctor', DOCTOR_NISHA.id), {
      wrapper,
    });
    expect(result.current).toEqual({ id: null, ready: false });
    answerTeam?.(TEAM);
    await waitFor(() =>
      expect(result.current).toEqual({ id: DOCTOR_NISHA.id, ready: true }),
    );
  });
});

describe('useStaffMember', () => {
  it('names a team member and their short name', async () => {
    const { result } = renderHook(() => useStaffMember(DOCTOR_NISHA.id), { wrapper });
    await waitFor(() =>
      expect(result.current).toEqual({ person: DOCTOR_NISHA, shortName: 'Nisha S.' }),
    );
  });

  it('names nobody without a pick, or for someone not on the team', async () => {
    const none = renderHook(() => useStaffMember(null), { wrapper });
    expect(none.result.current).toEqual({ person: null, shortName: '' });
    const former = renderHook(() => useStaffMember(FORMER), { wrapper });
    await waitFor(() => expect(fetchTeamDirectory).toHaveBeenCalled());
    expect(former.result.current).toEqual({ person: null, shortName: '' });
  });
});
