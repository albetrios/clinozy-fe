import { describe, expect, it } from 'vitest';

import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import {
  INVOICE_TEST_OFFERINGS,
  INVOICE_TEST_OFFERS,
  TEST_LHR_ID,
  TEST_PEEL_ID,
} from '@/tests/utils/invoice-doubles.ts';

import { offeringCatalogItem } from './invoice-lines.ts';
import { visitLines } from './invoice-presets.ts';

/** The catalogue at every branch: Research Peel (one session), LHR Full Face (seven). */
const CATALOG = INVOICE_TEST_OFFERINGS.map((offering) =>
  offeringCatalogItem(offering, null, INVOICE_TEST_OFFERS),
);

/** A session done at the visit, still to bill. */
const session = (
  id: string,
  offeringId: string | null,
  name = 'Research Peel',
): TreatmentRecord => ({
  id,
  patientId: 'pat_kavya0000000000000000',
  appointmentId: 'appt_kavya0000000000000000',
  offeringId,
  name,
  template: 'skin',
  performedAt: '2026-10-10T04:00:00.000Z',
  doctorId: null,
  therapistId: null,
  bodyParts: [],
  sessionNumber: 1,
  parameters: {},
  remark: null,
  aftercareCall: 'none',
  packageId: null,
  isBilled: false,
  status: 'done',
  reversedReason: null,
  reversedAt: null,
  latestCheckIn: null,
  createdAt: '2026-10-10T04:00:00.000Z',
  updatedAt: '2026-10-10T04:00:00.000Z',
});

describe('visitLines (the visit flow’s "Create invoice from visit", D156)', () => {
  it('bills one line per offering — enough units for its sessions — each carrying the sessions', () => {
    const lines = visitLines(
      [
        session('trt_peelone00000000000000', TEST_PEEL_ID),
        session('trt_lhrone000000000000000', TEST_LHR_ID, 'LHR Full Face'),
        session('trt_peeltwo00000000000000', TEST_PEEL_ID),
      ],
      CATALOG,
    );
    expect(lines).toEqual([
      expect.objectContaining({
        id: null,
        offeringId: TEST_PEEL_ID,
        name: 'Research Peel',
        qty: 2,
        treatmentIds: ['trt_peelone00000000000000', 'trt_peeltwo00000000000000'],
      }),
      expect.objectContaining({
        offeringId: TEST_LHR_ID,
        name: 'LHR Full Face',
        qty: 1,
        treatmentIds: ['trt_lhrone000000000000000'],
      }),
    ]);
  });

  it('keeps an offering the catalogue doesn’t list by its session’s name; skips a session of none', () => {
    const lines = visitLines(
      [
        session('trt_paused000000000000000', 'off_paused000000000000000', 'Paused peel'),
        session('trt_free00000000000000000', null, 'A free note'),
      ],
      CATALOG,
    );
    expect(lines).toEqual([
      expect.objectContaining({
        offeringId: 'off_paused000000000000000',
        name: 'Paused peel',
        qty: 1,
        treatmentIds: ['trt_paused000000000000000'],
      }),
    ]);
    expect(visitLines([], CATALOG)).toEqual([]);
  });
});
