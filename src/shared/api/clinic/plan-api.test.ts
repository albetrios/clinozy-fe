import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicInstant } from './clinic-time.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  addSuggestion,
  fetchPlan,
  planQueryKeys,
  removeSuggestion,
  restoreSuggestion,
  updateSuggestion,
} from './plan-api.ts';

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (error.data as { error: { code: string; detail: string } }).error;
  return { status: error.status, ...body };
}

const patientId = (firstName: string) => {
  const found = clinicFixtures.patients.snapshot((row) => row.firstName === firstName)[0];
  if (!found) throw new Error(`no patient ${firstName}`);
  return found.id;
};

/** An active offering nobody has suggested to the patient yet. */
const unsuggestedOffering = (patient: string) => {
  const taken = new Set(
    clinicFixtures.offeringSuggestions
      .snapshot((row) => row.patientId === patient)
      .map((row) => row.offeringId),
  );
  const found = clinicFixtures.offerings.snapshot(
    (row) => row.active && !taken.has(row.id),
  )[0];
  if (!found) throw new Error('no free offering');
  return found;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  resetClinicFixtures();
});

describe('a patient’s plan (getPlan, S:1635)', () => {
  it('joins the suggestions with their offering and who made them, oldest first', async () => {
    const plan = await fetchPlan(patientId('Dharti'));
    expect(plan.suggestions.length).toBeGreaterThan(0);
    const made = plan.suggestions.map((line) => line.createdAt);
    expect(made).toEqual([...made].sort());
    for (const line of plan.suggestions) {
      expect(line.name).not.toBeNull();
      expect(line.sessions).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps at most four ideas, six purchase lines and five messages', async () => {
    const plan = await fetchPlan(patientId('Dharti'));
    expect(plan.ideas.length).toBeLessThanOrEqual(4);
    expect(plan.purchases.length).toBeLessThanOrEqual(6);
    expect(plan.activity.length).toBeLessThanOrEqual(5);
    expect(plan.paidSoFar).toBeGreaterThanOrEqual(0);
    const suggested = new Set(
      plan.suggestions
        .filter((line) => line.status !== 'declined')
        .map((line) => line.offeringId),
    );
    for (const idea of plan.ideas) expect(suggested.has(idea.offeringId)).toBe(false);
  });

  it('answers an unknown patient with a 404', async () => {
    expect(await failureOf(fetchPlan(ref.patient(1)))).toMatchObject({ status: 404 });
  });
});

describe('suggestions (addSuggestion, updateSuggestion, S:1646)', () => {
  it('adds one unit at list price, Planned, against the visit it was made in', async () => {
    const patient = patientId('Dharti');
    const offering = unsuggestedOffering(patient);
    const added = await addSuggestion({
      patientId: patient,
      offeringId: offering.id,
      appointmentId: ref.appointment(2859),
      sourceLabel: 'Appt #2859 · Peel',
      reason: '  Idea from history ',
    });
    expect(added).toMatchObject({
      qty: 1,
      price: null,
      status: 'planned',
      appointmentId: ref.appointment(2859),
      reason: 'Idea from history',
    });
    expect(
      await failureOf(
        addSuggestion({ patientId: patient, offeringId: offering.id, sourceLabel: 'x' }),
      ),
    ).toMatchObject({ status: 409, code: 'duplicate' });
    expect(
      await failureOf(
        addSuggestion({
          patientId: patient,
          offeringId: ref.offering(1),
          sourceLabel: 'x',
        }),
      ),
    ).toMatchObject({ status: 422 });
  });

  it('edits the quantity, the final price and the status — within their ranges', async () => {
    const line = (await fetchPlan(patientId('Dharti'))).suggestions[0];
    if (!line) throw new Error('no suggestion');
    expect(await updateSuggestion(line.id, { qty: 3, price: 150_000 })).toMatchObject({
      qty: 3,
      price: 150_000,
    });
    expect(await updateSuggestion(line.id, { status: 'accepted' })).toMatchObject({
      status: 'accepted',
    });
    expect(await failureOf(updateSuggestion(line.id, { qty: 0 }))).toMatchObject({
      status: 422,
    });
    expect(await failureOf(updateSuggestion(line.id, { price: -1 }))).toMatchObject({
      status: 422,
    });
    expect(
      await failureOf(updateSuggestion(ref.offeringSuggestion(999), { qty: 2 })),
    ).toMatchObject({ status: 404 });
  });

  it('removes a suggestion with its reason, and the Undo brings it back', async () => {
    const patient = patientId('Dharti');
    const line = (await fetchPlan(patient)).suggestions[0];
    if (!line) throw new Error('no suggestion');
    await removeSuggestion(line.id, 'other', 'Plan changed');
    expect((await fetchPlan(patient)).suggestions.map((row) => row.id)).not.toContain(
      line.id,
    );
    await restoreSuggestion(line.id);
    expect((await fetchPlan(patient)).suggestions.map((row) => row.id)).toContain(
      line.id,
    );
  });

  it('keys every plan under the clinic’s plan prefix', () => {
    expect(planQueryKeys.detail('p1')).toEqual(['clinic', 'plan', 'p1']);
  });
});
