import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { searchPatientPicker } from './patient-search-api.ts';

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('searchPatientPicker', () => {
  it('lists the patients A–Z with their dues, and no lead for an empty search', async () => {
    const page = await searchPatientPicker('');
    const names = page.items.map((row) => row.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(page.items.every((row) => row.kind === 'patient')).toBe(true);
    expect(page.items.find((row) => row.name === 'Rhea Shah')).toMatchObject({
      kind: 'patient',
      due: expect.any(Number),
    });
  });

  it('finds the leads that are not patients yet, after the patients', async () => {
    const [lead] = clinicFixtures.leads.snapshot(
      (row) =>
        row.patientId === null && row.kind !== 'contact_thread' && !row.isContactThread,
    );
    if (!lead) throw new Error('the seed has a lead that is not a patient');
    const page = await searchPatientPicker(lead.name);
    const kinds = page.items.map((row) => row.kind);
    expect(kinds).toContain('lead');
    // Every patient row comes before the first lead row.
    expect(kinds.lastIndexOf('patient')).toBeLessThan(kinds.indexOf('lead'));
    expect(
      page.items.find((row) => row.kind === 'lead' && row.id === lead.id),
    ).toMatchObject({
      name: lead.name,
      seq: lead.seq,
    });
  });
});
