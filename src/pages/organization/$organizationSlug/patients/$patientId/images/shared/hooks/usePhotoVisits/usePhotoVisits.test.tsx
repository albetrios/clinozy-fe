import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchPersonAppointments } from '@/shared/api/app/appointments-api.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/app/patient-file-sections.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../../../shared/patient-file-context.ts';
import { usePhotoVisits } from './usePhotoVisits.ts';

vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchPersonAppointments: vi.fn(),
}));

function renderVisits(file = patientFile()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PatientFileContext.Provider
        value={{
          patientId: TEST_PATIENT_ID,
          file,
          section: 'images',
          viewable: PATIENT_FILE_SECTIONS,
          masked: true,
          toggleMasked: () => undefined,
          photos: {
            pick: () => undefined,
            capture: () => undefined,
            upload: () => undefined,
          },
        }}
      >
        {children}
      </PatientFileContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => usePhotoVisits(), { wrapper });
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
});

describe('usePhotoVisits', () => {
  it('offers the person’s visits a photo can be filed under, latest first', async () => {
    vi.mocked(fetchPersonAppointments).mockResolvedValueOnce([
      appointmentRow({
        id: 'appt_done0000000000000000',
        patientId: TEST_PATIENT_ID,
        contactId: TEST_CONTACT_ID,
        status: 'completed',
        date: '2026-09-24',
      }),
      appointmentRow({
        id: 'appt_next0000000000000000',
        patientId: TEST_PATIENT_ID,
        contactId: TEST_CONTACT_ID,
        status: 'confirmed',
      }),
    ]);
    const { result } = renderVisits();
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(fetchPersonAppointments).toHaveBeenCalledWith(TEST_CONTACT_ID);
    expect(result.current[0]?.appointmentId).toBe('appt_done0000000000000000');
  });
});
