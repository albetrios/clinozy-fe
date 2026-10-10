import { describe, expect, it } from 'vitest';

import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

import {
  nextSessionNumber,
  rememberedSettings,
  repeatedSession,
  spendablePackage,
  stepStates,
  visitBill,
} from './visit-flow.ts';

/** Priya's last laser session — session 3, on her package. */
const LAST = {
  id: 'trt_last00000000000000000',
  patientId: 'pat_priya0000000000000000',
  appointmentId: 'appt_old000000000000000000',
  offeringId: 'off_lhr00000000000000000',
  name: 'Laser hair reduction',
  template: 'skin',
  performedAt: '2026-09-20T05:00:00.000Z',
  doctorId: 'mem_nisha0000000000000000',
  therapistId: 'mem_riya00000000000000000',
  bodyParts: ['legs'],
  sessionNumber: 3,
  parameters: {
    machine: 'GentleMax',
    power: '18 J/cm²',
    wavelength: '755',
    skinType: 'IV',
    areas: 'Legs',
  },
  remark: 'Mild redness',
  aftercareCall: 'in_two_days',
  packageId: 'poff_lhr0000000000000000',
  isBilled: false,
  status: 'done',
  reversedReason: null,
  reversedAt: null,
  latestCheckIn: null,
  createdAt: '2026-09-20T05:00:00.000Z',
  updatedAt: '2026-09-20T05:00:00.000Z',
} satisfies TreatmentRecord;

/** Her LHR package: 3 of 6 used. */
const PACKAGE = {
  id: 'poff_lhr0000000000000000',
  offeringId: 'off_lhrpack000000000000000',
  name: 'LHR Legs · 6 sessions',
  sessionsTotal: 6,
  sessionsUsed: 3,
  sessionsLeft: 3,
  status: 'active',
  validUntil: null,
  invoiceId: 'invc_lhr0000000000000000',
  createdAt: '2026-09-01T05:00:00.000Z',
  updatedAt: '2026-09-20T05:00:00.000Z',
} satisfies PatientPackageRow;

describe('stepStates (H:4880–4886)', () => {
  it('makes the first step current while nothing is done', () => {
    expect(stepStates({ checks: false, rx: false, treatment: false })).toEqual({
      checks: 'current',
      rx: 'later',
      treatment: 'later',
    });
  });

  it('marks the done ones and moves current to the first one not done after them', () => {
    expect(stepStates({ checks: true, rx: false, treatment: false })).toEqual({
      checks: 'done',
      rx: 'current',
      treatment: 'later',
    });
    expect(stepStates({ checks: true, rx: true, treatment: true })).toEqual({
      checks: 'done',
      rx: 'done',
      treatment: 'done',
    });
  });

  it('keeps a later step done without making it current — no step after a gap is current', () => {
    expect(stepStates({ checks: false, rx: true, treatment: false })).toEqual({
      checks: 'current',
      rx: 'done',
      treatment: 'later',
    });
  });

  it('leaves out a step the member does not see', () => {
    expect(stepStates({ rx: false, treatment: false })).toEqual({
      rx: 'current',
      treatment: 'later',
    });
  });
});

describe('rememberedSettings (H:4875)', () => {
  it('reads the last session’s machine, power, wavelength and skin type', () => {
    expect(rememberedSettings(LAST)).toBe('GentleMax · 18 J/cm² · 755 nm · IV');
  });

  it('leaves out what was not set, and is empty without a session', () => {
    expect(rememberedSettings({ ...LAST, parameters: { machine: 'Soprano Ice' } })).toBe(
      'Soprano Ice',
    );
    expect(rememberedSettings(null)).toBe('');
  });
});

describe('spendablePackage', () => {
  it('is the package while it is active with a session left (the server’s counts)', () => {
    expect(spendablePackage([PACKAGE], PACKAGE.id)).toBe(PACKAGE);
  });

  it('is none once used up or expired, for another package, or for no package', () => {
    expect(
      spendablePackage([{ ...PACKAGE, status: 'used_up', sessionsLeft: 0 }], PACKAGE.id),
    ).toBeNull();
    expect(spendablePackage([{ ...PACKAGE, status: 'expired' }], PACKAGE.id)).toBeNull();
    expect(spendablePackage([PACKAGE], 'poff_other')).toBeNull();
    expect(spendablePackage([PACKAGE], null)).toBeNull();
  });
});

describe('repeatedSession (H:4875)', () => {
  it('is the last session again at this visit — its settings, areas and team — on its package', () => {
    expect(repeatedSession(LAST, PACKAGE, 'appt_today00000000000000')).toEqual({
      name: 'Laser hair reduction',
      template: 'skin',
      offeringId: 'off_lhr00000000000000000',
      doctorId: 'mem_nisha0000000000000000',
      therapistId: 'mem_riya00000000000000000',
      bodyParts: ['legs'],
      sessionNumber: 4,
      parameters: LAST.parameters,
      remark: null,
      aftercareCall: 'in_two_days',
      appointmentId: 'appt_today00000000000000',
      packageId: PACKAGE.id,
    });
  });

  it('is off any package when none can spend a session', () => {
    expect(repeatedSession(LAST, null, 'appt_today00000000000000').packageId).toBeNull();
  });
});

describe('nextSessionNumber', () => {
  it('is one on, at most the API’s 999', () => {
    expect(nextSessionNumber({ sessionNumber: 3 })).toBe(4);
    expect(nextSessionNumber({ sessionNumber: 999 })).toBe(999);
  });
});

describe('visitBill (D156)', () => {
  const TODAY = { ...LAST, id: 'trt_today0000000000000000', packageId: null };
  /** An invoice whose one line bills `ids`. */
  const billing = (ids: string[], id = 'invc_visit0000000000000000') => {
    const invoice = invoiceRecord({ id });
    return {
      ...invoice,
      items: invoice.items.map((line) => ({ ...line, treatmentIds: ids })),
    };
  };

  it('finds the visit’s invoice by a session its lines bill', () => {
    const other = billing(['trt_other0000000000000000'], 'invc_other0000000000000000');
    const mine = billing([TODAY.id]);
    expect(visitBill({ sessions: [TODAY], invoices: [other, mine] })).toEqual({
      invoice: mine,
      toBill: [TODAY],
      covered: false,
    });
  });

  it('lists the sessions still to bill while no invoice carries them', () => {
    expect(visitBill({ sessions: [TODAY], invoices: [billing([])] })).toEqual({
      invoice: null,
      toBill: [TODAY],
      covered: false,
    });
  });

  it('is covered when a package bought before took every session; empty with none', () => {
    const onPackage = { ...TODAY, isBilled: true, packageId: PACKAGE.id };
    expect(visitBill({ sessions: [onPackage], invoices: [] })).toEqual({
      invoice: null,
      toBill: [],
      covered: true,
    });
    // A session of no offering bills nothing — and covers nothing.
    expect(visitBill({ sessions: [{ ...TODAY, isBilled: null }], invoices: [] })).toEqual(
      {
        invoice: null,
        toBill: [],
        covered: false,
      },
    );
    expect(visitBill({ sessions: [], invoices: [] }).covered).toBe(false);
  });
});
