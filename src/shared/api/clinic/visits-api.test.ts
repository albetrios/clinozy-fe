import { describe, expect, it } from 'vitest';

import { appointmentQueryKeys } from './appointments-api.ts';
import { fixtureAppointmentQueryKeys } from './appointments-fixture-api.ts';
import { VISIT_WRITE_KEYS, visitQueryKeys } from './visits-api.ts';

describe('the visit query keys (D18)', () => {
  it('refreshes the visits and the floor', () => {
    expect(VISIT_WRITE_KEYS).toEqual([visitQueryKeys.all, appointmentQueryKeys.all]);
  });

  it('refreshes the patient file’s fixture bookings too — they sit under the appointments prefix', () => {
    expect(
      fixtureAppointmentQueryKeys.patient('pat_dharti000000000000000').slice(0, 2),
    ).toEqual([...appointmentQueryKeys.all]);
  });
});
