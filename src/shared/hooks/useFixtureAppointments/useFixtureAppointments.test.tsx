import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/appointments-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchFixtureBookableStaff: vi.fn(),
  fetchFixturePatientAppointments: vi.fn(),
}));
import {
  fetchFixtureBookableStaff,
  fetchFixturePatientAppointments,
} from '@/shared/api/clinic/appointments-fixture-api.ts';
import type {
  AppointmentRow,
  AppointmentStaff,
} from '@/shared/api/clinic/appointments-fixture-contracts.ts';

import {
  useFixtureBookableStaff,
  useFixturePatientAppointments,
} from './useFixtureAppointments.ts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('the fixture bookings the patient file still reads', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reads the fixture doctors and therapists', async () => {
    const staff = [{ id: 'staff-nisha', firstName: 'Nisha' }] as AppointmentStaff[];
    vi.mocked(fetchFixtureBookableStaff).mockResolvedValue(staff);
    const { result } = renderHook(() => useFixtureBookableStaff(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(staff));
  });

  it("reads a patient's bookings, and stays idle without a patient", async () => {
    const visits = [{ id: 'visit-one' }] as AppointmentRow[];
    vi.mocked(fetchFixturePatientAppointments).mockResolvedValue(visits);
    const { result, rerender } = renderHook(
      ({ patientId }) => useFixturePatientAppointments(patientId),
      { wrapper, initialProps: { patientId: '' } },
    );
    expect(fetchFixturePatientAppointments).not.toHaveBeenCalled();

    rerender({ patientId: 'patient-riya' });

    await waitFor(() => expect(result.current.data).toEqual(visits));
    expect(fetchFixturePatientAppointments).toHaveBeenCalledWith('patient-riya');
  });
});
