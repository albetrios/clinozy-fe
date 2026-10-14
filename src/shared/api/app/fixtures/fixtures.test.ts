import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FIXTURE_ORGANIZATION_ID } from '@/shared/api/app/app-fixture-store.ts';
import { invoiceBalance, invoiceTotals } from '@/shared/api/app/app-money.ts';
import {
  branchSchema,
  checkInSchema,
  feedbackActionSchema,
  invoiceSchema,
  leadMessageSchema,
  organizationSchema,
  patientImageSchema,
  patientNoteSchema,
  patientPackageSchema,
  patientReportSchema,
  prescriptionSchema,
  reviewSchema,
  treatmentSchema,
} from '@/shared/api/app/app-schema.ts';
import { addCivilDays, appClockTime, appToday } from '@/shared/api/app/app-time.ts';
import { appointmentRecordSchema } from '@/shared/api/app/appointments-fixture-contracts.ts';
import { leadRecordSchema } from '@/shared/api/app/leads-fixture-contracts.ts';
import { offeringRecordSchema } from '@/shared/api/app/offerings-fixture-contracts.ts';
import { patientRecordSchema } from '@/shared/api/app/patients-fixture-contracts.ts';
import { paymentRecordSchema } from '@/shared/api/app/payments-fixture-contracts.ts';
import { staffProfileSchema } from '@/shared/api/app/staff-fixture-contracts.ts';
import { taskRecordSchema } from '@/shared/api/app/tasks-fixture-contracts.ts';

/** The fixture's packages: the contract's, and one added before its invoice (`invoiceId` null). */
const patientPackageRecordSchema = patientPackageSchema.extend({
  invoiceId: z.uuid().nullable(),
});

import { patientRef } from './patients.fixtures.ts';
import { readSeedLabel, seedMobile } from './refs.fixtures.ts';
import { appFixtures, clinicOrganization, resetAppFixtures } from './world.fixtures.ts';

type CollectionKey = keyof typeof appFixtures;

const SCHEMAS = {
  branches: branchSchema,
  // A fixture staff profile: a user with its membership link (fixture leads, the chat's authors).
  staff: staffProfileSchema,
  patients: patientRecordSchema,
  // Leads carry the plan's hold, unread and custom-interest fields (Appendix F).
  leads: leadRecordSchema,
  leadMessages: leadMessageSchema,
  // The patient file's fixture bookings carry the plan's "Latest update" fields and package
  // link (Appendix F); the Appointments room reads clinozy-be.
  appointments: appointmentRecordSchema,
  prescriptions: prescriptionSchema,
  treatments: treatmentSchema,
  patientImages: patientImageSchema,
  patientReports: patientReportSchema,
  // A package may be added before its invoice (A-F6, Appendix F).
  patientPackages: patientPackageRecordSchema,
  patientNotes: patientNoteSchema,
  checkIns: checkInSchema,
  reviews: reviewSchema,
  feedbackActions: feedbackActionSchema,
  // The offerings domain carries the plan's fields (Appendix F).
  offerings: offeringRecordSchema,
  invoices: invoiceSchema,
  // Entries carry the plan's fields (Appendix F).
  payments: paymentRecordSchema,
  // The contract's Task plus the plan's fields at rest (Appendix F, REPLACE_WITH_API).
  tasks: taskRecordSchema,
} satisfies Record<CollectionKey, z.ZodObject>;

/** The prototype seeds each collection converts (the H: references live in each file). */
const COUNTS: Record<CollectionKey, number> = {
  branches: 3,
  staff: 16,
  patients: 30,
  leads: 31,
  leadMessages: 24,
  appointments: 28,
  prescriptions: 3,
  treatments: 4,
  patientImages: 9,
  patientReports: 3,
  patientPackages: 4,
  patientNotes: 2,
  checkIns: 2,
  reviews: 3,
  feedbackActions: 0,
  offerings: 11,
  invoices: 9,
  payments: 12,
  tasks: 8,
};

const KEYS = Object.keys(SCHEMAS) as CollectionKey[];

const rowsOf = (
  key: CollectionKey,
): ReadonlyArray<{
  id: string;
  seq?: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  organizationId: string;
}> => appFixtures[key].snapshot();

type RowOf<K extends CollectionKey> = ReturnType<
  (typeof appFixtures)[K]['snapshot']
>[number];
type Targets = ReadonlyArray<readonly [CollectionKey, ReadonlyArray<string | null>]>;

const TASK_SOURCES = {
  lead: 'leads',
  appointment: 'appointments',
  treatment: 'treatments',
  check_in: 'checkIns',
  review: 'reviews',
  invoice: 'invoices',
} as const;

/** Every foreign key of each entity, with the collection it must resolve in. */
const LINKS: { [K in CollectionKey]: (row: RowOf<K>) => Targets } = {
  branches: (r) => [
    [
      'staff',
      [r.defaultDoctorId, r.defaultDeskId, r.defaultTherapistId, r.defaultPharmacistId],
    ],
  ],
  staff: (r) => [['branches', r.branchIds]],
  patients: (r) => [
    ['branches', [r.homeBranchId]],
    ['patients', [r.referredByPatientId]],
    ['staff', [r.doctorId]],
    ['leads', [r.leadId]],
  ],
  leads: (r) => [
    ['staff', [r.ownerId, ...r.involvedIds]],
    ['branches', [r.branchId]],
    ['patients', [r.patientId]],
  ],
  leadMessages: (r) => [
    ['leads', [r.leadId]],
    ['staff', [r.authorId]],
    ['tasks', [r.taskId]],
  ],
  appointments: (r) => [
    ['patients', [r.patientId]],
    ['leads', [r.leadId]],
    ['branches', [r.branchId]],
    ['offerings', [r.offeringId]],
    ['staff', [r.doctorId, r.therapistId]],
    ['appointments', [r.copiedFromId]],
  ],
  prescriptions: (r) => [
    ['patients', [r.patientId]],
    ['appointments', [r.appointmentId]],
    ['staff', [r.doctorId]],
  ],
  treatments: (r) => [
    ['patients', [r.patientId]],
    ['appointments', [r.appointmentId]],
    ['offerings', [r.offeringId]],
    ['staff', [r.doctorId, r.therapistId]],
    ['patientPackages', [r.packageId]],
  ],
  patientImages: (r) => [
    ['patients', [r.patientId]],
    ['appointments', [r.appointmentId]],
  ],
  patientReports: (r) => [['patients', [r.patientId]]],
  patientPackages: (r) => [
    ['patients', [r.patientId]],
    ['offerings', [r.offeringId]],
    ['invoices', [r.invoiceId]],
  ],
  patientNotes: (r) => [['patients', [r.patientId]]],
  checkIns: (r) => [
    ['patients', [r.patientId]],
    ['appointments', [r.appointmentId]],
    ['treatments', [r.treatmentId]],
    ['offerings', r.nextOfferingIds],
    ['staff', [r.byId]],
  ],
  reviews: (r) => [
    ['patients', [r.patientId]],
    ['appointments', [r.appointmentId]],
    ['staff', [r.byId]],
  ],
  feedbackActions: (r) => [
    ['checkIns', [r.checkInId]],
    ['reviews', [r.reviewId]],
    ['staff', [r.byId]],
  ],
  offerings: (r) => [['branches', r.branchIds]],
  invoices: (r) => [
    ['branches', [r.branchId]],
    ['patients', [r.patientId]],
    ['staff', r.teamIds],
    ['offerings', r.items.map((item) => item.offeringId)],
    ['prescriptions', [r.prescriptionId]],
  ],
  payments: (r) => [
    ['branches', [r.branchId]],
    ['patients', [r.patientId]],
    ['invoices', [r.invoiceId]],
  ],
  tasks: (r) => [
    ['staff', [r.ownerId, r.resolvedById, ...r.previousOwnerIds]],
    ['patients', [r.patientId]],
    ['leads', [r.leadId]],
    [TASK_SOURCES[r.sourceType ?? 'lead'], [r.sourceId]],
  ],
};

interface Link {
  from: string;
  to: CollectionKey;
  id: string | null;
}

/** One collection's links, its author included (`createdById` → staff). */
function linksOf<K extends CollectionKey>(key: K): Link[] {
  const targets = LINKS[key] as (row: RowOf<K>) => Targets;
  const rows = appFixtures[key].snapshot() as RowOf<K>[];
  return rows.flatMap((row) =>
    [...targets(row), ['staff', [row.createdById]] as const].flatMap(([to, ids]) =>
      ids.map((id) => ({ from: `${key} ${row.id}`, to, id })),
    ),
  );
}

describe('the clinic fixture world', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
    resetAppFixtures();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetAppFixtures();
  });

  it.each(KEYS)(
    '%s: every record parses with its contract schema, no extra fields',
    (key) => {
      const schema = SCHEMAS[key].strict();
      for (const row of rowsOf(key)) {
        const parsed = schema.safeParse(row);
        expect(parsed.error?.issues ?? [], `${key} ${row.id}`).toEqual([]);
      }
    },
  );

  it('carries the clinic as one contract-valid organisation record', () => {
    const organization = clinicOrganization();
    expect(organizationSchema.strict().parse(organization)).toEqual(organization);
    expect(organization.id).toBe(FIXTURE_ORGANIZATION_ID);
  });

  it('holds the converted prototype seeds, collection by collection', () => {
    const counts = Object.fromEntries(KEYS.map((key) => [key, rowsOf(key).length]));
    expect(counts).toEqual(COUNTS);
  });

  it('gives every record a unique id and every entity a unique seq', () => {
    const everyId = KEYS.flatMap((key) => rowsOf(key).map((row) => row.id));
    expect(new Set(everyId).size).toBe(everyId.length);
    for (const key of KEYS) {
      const seqs = rowsOf(key).flatMap((row) => (row.seq === undefined ? [] : [row.seq]));
      expect(new Set(seqs).size, key).toBe(seqs.length);
    }
  });

  it('resolves every foreign key in the collection it points at', () => {
    const ids = new Map(
      KEYS.map((key) => [key, new Set(rowsOf(key).map((row) => row.id))] as const),
    );
    const dangling = KEYS.flatMap((key) => linksOf(key))
      .filter((link) => link.id !== null && !ids.get(link.to)?.has(link.id))
      .map((link) => `${link.from} → ${link.to} ${link.id}`);
    expect(dangling).toEqual([]);
  });

  it('stamps one organisation and sane audit times on every record', () => {
    for (const key of KEYS) {
      for (const row of rowsOf(key)) {
        expect(row.organizationId).toBe(FIXTURE_ORGANIZATION_ID);
        expect(row.updatedAt >= row.createdAt, `${key} ${row.id}`).toBe(true);
      }
    }
  });

  it('merges the two patient sets into one roster, keeping PT_SEED numbers', () => {
    const patients = appFixtures.patients.snapshot();
    const named = (first: string, last: string) =>
      patients.filter((row) => row.firstName === first && row.lastName === last);
    expect(named('Rhea', 'Shah').map((row) => row.seq)).toEqual([3460]);
    expect(named('Dhruv', 'Patel').map((row) => row.seq)).toEqual([377]);
    expect(named('Pooja', 'Nair').map((row) => row.seq)).toEqual([390]);
    expect(new Set(patients.map((row) => `${row.firstName} ${row.lastName}`)).size).toBe(
      patients.length,
    );
    const dharti = named('Dharti', 'Galani')[0];
    expect(dharti?.phone).toBe('+918200603212');
    expect(dharti?.conversion).toBe('not_converted');
    expect(dharti?.complaints).toBe('Tanning on face\nUneven skin tone');
    expect(patientRef('Raghuvirsinh Vaghela')).toBe(
      appFixtures.leads.snapshot((lead) => lead.seq === 2355)[0]?.patientId,
    );
  });

  it('keeps contact threads out of the lead pipeline', () => {
    const leads = appFixtures.leads.snapshot();
    const threads = leads.filter((lead) => lead.isContactThread);
    expect(leads.length - threads.length).toBe(17);
    for (const lead of leads) {
      expect(lead.kind === 'contact_thread').toBe(lead.isContactThread);
      expect(lead.status === null, `lead #${lead.seq}`).toBe(lead.isContactThread);
      expect(lead.source === null, `lead #${lead.seq}`).toBe(lead.isContactThread);
    }
    const retargets = leads.filter((lead) => lead.kind === 'retarget');
    expect(retargets.map((lead) => lead.seq)).toEqual([2371, 2370]);
    expect(retargets.every((lead) => lead.patientId !== null)).toBe(true);
  });

  it('books every appointment for exactly one patient or lead', () => {
    for (const appointment of appFixtures.appointments.snapshot()) {
      expect(
        (appointment.patientId === null) !== (appointment.leadId === null),
        `appointment #${appointment.seq}`,
      ).toBe(true);
    }
  });

  it("keeps the money in paise and each invoice's receipts equal to the prototype's paid", () => {
    const invoices = appFixtures.invoices.snapshot();
    const payments = appFixtures.payments.snapshot();
    const paidOn = (seq: number) => {
      const invoice = invoices.find((row) => row.seq === seq);
      return payments
        .filter((payment) => payment.invoiceId === invoice?.id)
        .reduce(
          (sum, payment) =>
            sum + (payment.direction === 'received' ? payment.amount : -payment.amount),
          0,
        );
    };
    // PY_INV `paid`, ₹ × 100 — its Medical rows (#785, #779) are the Medical room's sales.
    expect([787, 786, 784, 783, 781, 772].map(paidOn)).toEqual([
      0, 0, 0, 0, 765000, 40000,
    ]);
    const bill = (seq: number) =>
      invoiceTotals({
        items: invoices.find((row) => row.seq === seq)?.items ?? [],
        overallDiscount: 0,
      }).bill;
    expect(bill(781)).toBe(765000);
    expect(bill(791)).toBe(371700);
    // The receipts added for the package invoices settle them exactly.
    for (const seq of [780, 782]) {
      const invoice = invoices.find((row) => row.seq === seq);
      expect(invoice && invoiceBalance(invoice, payments).status, `#${seq}`).toBe('paid');
    }
    for (const payment of payments) {
      expect(payment.splits.reduce((sum, split) => sum + split.amount, 0)).toBe(
        payment.amount,
      );
    }
  });

  it("carries OF_SEED's offer prices and availability", () => {
    const offerings = appFixtures.offerings.snapshot();
    const bySeq = (seq: number) => offerings.find((row) => row.seq === seq);
    // H:3562 `offer` (₹ × 100); any other offering bills its list price.
    expect([274, 273, 268, 267, 264, 270].map((seq) => bySeq(seq)?.offerPrice)).toEqual([
      120000,
      750000,
      420000,
      720000,
      150000,
      null,
    ]);
    const branchName = new Map(
      appFixtures.branches.snapshot().map((branch) => [branch.id, branch.name]),
    );
    const soldAt = (seq: number) => bySeq(seq)?.branchIds.map((id) => branchName.get(id));
    expect(soldAt(268)).toEqual(['Vesu']);
    expect(soldAt(267)).toEqual(['Adajan', 'Vesu']);
    expect(soldAt(274)).toEqual([]);
  });

  it('seeds no medical bill — a sale is the Medical room’s, on clinozy-be (MD28)', () => {
    const invoices = appFixtures.invoices.snapshot();
    expect(invoices.filter((invoice) => invoice.type === 'medical')).toEqual([]);
    expect(invoices.every((invoice) => invoice.saleId === null)).toBe(true);
  });
});

describe('the fixture world on the clinic clock', () => {
  const floorOn = (now: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(now));
    resetAppFixtures();
    const today = appToday();
    const appointments = appFixtures.appointments.snapshot();
    return { today, appointments };
  };

  afterEach(() => {
    vi.useRealTimers();
    resetAppFixtures();
  });

  it.each(['2026-10-03T04:30:00Z', '2027-02-14T20:30:00Z'])(
    "keeps the seed day's floor on today (%s)",
    (now) => {
      const { today, appointments } = floorOn(now);
      const todays = appointments
        .filter((appointment) => appointment.date === today)
        .map((appointment) => appointment.seq)
        .sort((a, b) => a - b);
      expect(todays).toEqual([
        2847, 2848, 2862, 2863, 2864, 2865, 2866, 2867, 2868, 2869,
      ]);
      const visit = (seq: number) =>
        appointments.find((appointment) => appointment.seq === seq);
      expect(visit(2740)?.date).toBe(addCivilDays(today, -3));
      expect(visit(2861)?.date).toBe(addCivilDays(today, 6));
      const rhea = visit(2867);
      expect(rhea?.status).toBe('checked_in');
      expect(appClockTime(new Date(rhea?.checkedInAt ?? ''))).toBe('10:35');
    },
  );

  it('moves every date and instant in the world by the same span', () => {
    const worldOn = (now: string) => {
      floorOn(now);
      // A task's rule key names the visit slot it was derived for — an
      // identity the rule job compares, not a calendar value.
      return leaves(Object.fromEntries(KEYS.map((key) => [key, rowsOf(key)]))).filter(
        ([path]) => !path.endsWith('.ruleKey'),
      );
    };
    const first = worldOn('2026-10-03T04:30:00Z');
    const later = worldOn('2026-11-20T04:30:00Z');
    const days = 48;
    expect(later.map(([path]) => path)).toEqual(first.map(([path]) => path));
    const moved = first.map(([path, value]) => {
      // Birth dates are facts, not seed dates.
      if (typeof value !== 'string' || path.endsWith('.dateOfBirth')) return value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return addCivilDays(value, days);
      if (/^\d{4}-\d{2}-\d{2}T/.test(value))
        return new Date(Date.parse(value) + days * 86_400_000).toISOString();
      return value;
    });
    expect(later.map(([, value]) => value)).toEqual(moved);
  });
});

/** Every leaf of a value as [path, value], in a stable order. */
function leaves(value: unknown, path = ''): Array<[string, unknown]> {
  if (Array.isArray(value))
    return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, item]) => leaves(item, `${path}.${key}`));
  return [[path, value]];
}

describe('seed readers', () => {
  it.each([
    ['Today 07:00', { date: '2026-09-27', time: '07:00' }],
    ['Yesterday 3:30 pm', { date: '2026-09-26', time: '15:30' }],
    ['24 Sep 4:34 pm', { date: '2026-09-24', time: '16:34' }],
    ['2026-09-26 17:26', { date: '2026-09-26', time: '17:26' }],
    ['2026-09-26 · 17:26', { date: '2026-09-26', time: '17:26' }],
    ['3 Oct 2025', { date: '2025-10-03', time: null }],
  ])('reads "%s"', (label, expected) => {
    expect(readSeedLabel(label)).toEqual(expected);
  });

  it('fails loudly on an unreadable date or an unknown person', () => {
    expect(() => readSeedLabel('someday')).toThrow(/seed date "someday"/);
    expect(() => patientRef('Nobody Known')).toThrow(/unknown patient Nobody Known/);
  });

  it('turns the prototype placeholders into valid mobiles', () => {
    expect(seedMobile('+91 33333 33333')).toBe('+919333333333');
    expect(seedMobile('98250 44120')).toBe('+919825044120');
  });
});
