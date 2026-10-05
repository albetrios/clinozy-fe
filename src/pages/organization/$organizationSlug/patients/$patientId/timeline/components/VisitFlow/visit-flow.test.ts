import { describe, expect, it } from 'vitest';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import {
  NO_VISIT_CHECKS,
  type VisitBillLine,
} from '@/shared/api/clinic/visits-contracts.ts';

import {
  flowInvoice,
  rememberedSettings,
  repeatedSession,
  stepStates,
} from './visit-flow.ts';

const ALL_CHECKS = { consent: true, photos: true, allergies: true };
const NOTHING = { prescription: null, treatment: null, invoice: null };
/** A record that exists — the states read only whether it does. */
const some = {} as never;

const line = (overrides: Partial<VisitBillLine>): VisitBillLine => ({
  name: 'Consultation',
  offeringId: null,
  qty: 1,
  rate: 50_000,
  discountPct: 0,
  gstPct: 0,
  fromPack: false,
  ...overrides,
});

describe('stepStates (H:4880–4886)', () => {
  it('makes the first step current while nothing is done', () => {
    expect(stepStates({ checks: NO_VISIT_CHECKS, sharedAt: null }, undefined)).toEqual({
      checks: 'current',
      rx: 'later',
      treatment: 'later',
      invoice: 'later',
      collect: 'later',
    });
  });

  it('marks each step done by its record, the first gap current and the rest later', () => {
    expect(
      stepStates(
        { checks: ALL_CHECKS, sharedAt: null },
        { ...NOTHING, prescription: some, invoice: some },
      ),
    ).toEqual({
      checks: 'done',
      rx: 'done',
      treatment: 'current',
      invoice: 'done',
      collect: 'later',
    });
    expect(
      stepStates(
        { checks: { ...ALL_CHECKS, photos: false }, sharedAt: '2026-10-03T05:00:00Z' },
        NOTHING,
      ),
    ).toMatchObject({ checks: 'current', collect: 'done' });
  });
});

describe('rememberedSettings (H:4875)', () => {
  it('reads the last session’s machine, power, wavelength and skin type', () => {
    const last = {
      params: {
        machine: 'Soprano Ice',
        power: '10 J',
        wavelength: '810',
        skinType: 'Type IV',
      },
    } as unknown as Treatment;
    expect(rememberedSettings(last)).toBe('Soprano Ice · 10 J · 810 nm · Type IV');
    expect(
      rememberedSettings({ params: { power: '18 J/cm²' } } as unknown as Treatment),
    ).toBe('18 J/cm²');
    expect(rememberedSettings(null)).toBe('');
  });
});

describe('flowInvoice', () => {
  it('totals the visit’s lines, GST in', () => {
    const bill = flowInvoice({
      billLines: [line({}), line({ name: 'Peel', rate: 100_000, gstPct: 18 })],
    });
    expect(bill.lines).toEqual([
      { name: 'Consultation', amount: 50_000 },
      { name: 'Peel', amount: 118_000 },
    ]);
    expect(bill.total).toBe(168_000);
    expect(bill.covered).toBe(false);
  });

  it('says a bill of package sessions only is covered', () => {
    expect(flowInvoice({ billLines: [line({ rate: 0, fromPack: true })] }).covered).toBe(
      true,
    );
    expect(flowInvoice({ billLines: [] })).toEqual({
      lines: [],
      total: 0,
      covered: false,
    });
  });
});

describe('repeatedSession (H:4875)', () => {
  const last = {
    offeringId: 'o1',
    name: 'Laser hair reduction',
    template: 'skin_laser',
    doctorId: 'd1',
    therapistId: 't1',
    bodyParts: ['legs'],
    sessionNo: 3,
    params: { power: '18 J/cm²' },
    remark: 'Mild redness',
    aftercareCall: 'in_2_days',
    packageId: 'p1',
  } as unknown as Treatment;
  const pack = {
    id: 'p1',
    name: 'LHR Legs',
    sessionsTotal: 10,
    sessionsUsed: 3,
    soldOn: '2026-08-28',
    validUntil: '2027-08-28',
  };
  const at = {
    patientId: 'pt',
    appointmentId: 'ap',
    performedAt: '2026-10-03T05:12:00.000Z',
  };

  it('repeats the last session one on, at this visit, on its package', () => {
    const input = repeatedSession(last, pack, at);
    expect(input).toMatchObject({
      ...at,
      name: 'Laser hair reduction',
      sessionNo: 4,
      bodyParts: ['legs'],
      params: { power: '18 J/cm²' },
      remark: null,
      packageId: 'p1',
    });
    expect(input.params).not.toBe(last.params);
  });

  it('leaves the package out once it is used up, or when it is another', () => {
    expect(repeatedSession(last, { ...pack, sessionsUsed: 10 }, at).packageId).toBeNull();
    expect(repeatedSession(last, { ...pack, id: 'p2' }, at).packageId).toBeNull();
    expect(repeatedSession(last, null, at).packageId).toBeNull();
  });
});
