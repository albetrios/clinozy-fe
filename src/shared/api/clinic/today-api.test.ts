import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentQueryKeys } from './appointments-api.ts';
import { clinicClockTime, clinicInstant } from './clinic-time.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import { leadQueryKeys } from './leads-api.ts';
import {
  fetchTodayEnquiries,
  fetchTodayFloor,
  normalizeTodayFloorParams,
  todayQueryKeys,
} from './today-api.ts';
import { todayLaneOf } from './today-contracts.ts';

/** The seed day: the prototype's "today", 10:42 on the clinic clock (H:3410). */
const TODAY = '2026-10-03';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:42')));
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('today query keys', () => {
  it('fill the day and order the branches, so equal reads share one entry', () => {
    const [first, second] = [ref.branch(1), ref.branch(2)].sort();
    expect(normalizeTodayFloorParams({ branchIds: [second, first, second] })).toEqual({
      date: TODAY,
      branchIds: [first, second],
    });
  });

  it('sit under the appointments and leads prefixes — their writes refresh the floor', () => {
    expect(todayQueryKeys.floor().slice(0, 2)).toEqual([...appointmentQueryKeys.all]);
    expect(todayQueryKeys.enquiries().slice(0, 2)).toEqual([...leadQueryKeys.all]);
  });
});

describe('listTodayFloor (S:1577, fixture)', () => {
  it('reads today’s bookings on the floor by start time, each in its lane', async () => {
    const floor = await fetchTodayFloor();
    expect(floor.map((row) => [row.seq, todayLaneOf(row)])).toEqual([
      [2863, 'pharmacy'],
      [2864, 'checkout'],
      [2865, 'treatment'],
      [2866, 'with_doctor'],
      [2867, 'waiting'],
      [2868, 'waiting'],
      [2847, 'waiting'],
      [2869, 'arriving'],
      [2848, 'arriving'],
    ]);
    // Vikram's 09:30 no-show is off the floor.
    expect(floor.some((row) => row.seq === 2862)).toBe(false);
  });

  it('joins what each card shows: the visit, a first visit, the bill, the Rx', async () => {
    const floor = await fetchTodayFloor();
    const seq = (n: number) => floor.find((row) => row.seq === n);
    expect(seq(2866)?.visit).toMatchObject({ id: ref.visit(2866), stage: 'with_doctor' });
    expect(seq(2867)?.visit).toBeNull();
    // Ishita's peel, 10% off with 18% GST: ₹3,717 still to pay on today's bill.
    expect(seq(2864)?.toPay).toBe(371_700);
    expect(seq(2863)?.prescription).toMatchObject({
      id: ref.prescription(501),
      items: 3,
    });
    // Faizan has only a contact thread and no visit before; Meera has.
    expect(seq(2869)).toMatchObject({ firstVisit: true, person: { kind: 'contact' } });
    expect(seq(2847)?.firstVisit).toBe(false);
    expect(seq(2867)?.allergies).toEqual([]);
  });

  it('leaves a filled Rx off the pharmacy', async () => {
    const rx = ref.prescription(501);
    const sale = clinicFixtures.medicalSales.snapshot()[0];
    if (!sale) throw new Error('no seeded sale');
    await clinicFixtures.medicalSales.update(sale.id, { prescriptionId: rx });
    const floor = await fetchTodayFloor();
    expect(floor.some((row) => row.seq === 2863)).toBe(false);
  });

  it('keeps to the header’s branches', async () => {
    expect(await fetchTodayFloor({ branchIds: [branchRef(MAIN_BRANCH)] })).toHaveLength(
      9,
    );
    expect(await fetchTodayFloor({ branchIds: [ref.branch(99)] })).toEqual([]);
  });
});

describe('the Enquiries lane (Appendix F, fixture)', () => {
  it('reads the open leads that wrote in today, by when they wrote', async () => {
    const enquiries = await fetchTodayEnquiries();
    expect(enquiries.map((lead) => [lead.name, lead.status, lead.source])).toEqual([
      ['Kabir Mehta', 'contacted', 'instagram'],
      ['Anaya Desai', 'new', 'whatsapp'],
    ]);
    expect(enquiries[1]?.message).toBe('Is Saturday possible?');
    expect(clinicClockTime(new Date(enquiries[1]?.askedAt ?? ''))).toBe('10:31');
  });

  it('drops a lead that is closed, a patient already, or quiet today', async () => {
    await clinicFixtures.leads.update(ref.lead(2363), { status: 'lost' });
    expect((await fetchTodayEnquiries()).map((lead) => lead.name)).toEqual([
      'Kabir Mehta',
    ]);
    vi.setSystemTime(new Date(clinicInstant('2026-10-04', '10:00')));
    expect(await fetchTodayEnquiries({ date: '2026-10-04' })).toEqual([]);
  });
});
