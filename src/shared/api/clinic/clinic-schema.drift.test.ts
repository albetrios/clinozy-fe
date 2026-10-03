import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  APPOINTMENT_STATUS_VALUES,
  appointmentSchema,
  feedbackActionKindSchema,
  patientSchema,
  paymentSchema,
} from './clinic-schema.ts';

/**
 * `clinic-schema.ts` is generated from the launch's `schema-routes.md` (the
 * data contract, D22). Regenerating must reproduce the file byte for byte, so
 * a hand edit — or a contract change nobody regenerated — fails here.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

interface Generator {
  SCHEMA_SOURCE: string;
  SCHEMA_TARGET: string;
  generateClinicSchemaFile: (markdown: string) => Promise<string>;
  parseSchemaMarkdown: (markdown: string) => {
    enums: { name: string; values: string[] }[];
    entities: { name: string; fields: unknown[] }[];
  };
}

async function loadGenerator(): Promise<Generator> {
  return (await import(
    /* @vite-ignore */ pathToFileURL(join(root, 'tooling/codegen/clinic-schema.mjs')).href
  )) as Generator;
}

describe('clinic-schema.ts (generated from schema-routes.md)', () => {
  it('matches a fresh generation from the contract', async () => {
    const generator = await loadGenerator();
    const markdown = readFileSync(join(root, generator.SCHEMA_SOURCE), 'utf8');
    const onDisk = readFileSync(join(root, generator.SCHEMA_TARGET), 'utf8');
    expect(await generator.generateClinicSchemaFile(markdown)).toBe(onDisk);
  });

  it('carries every enum and entity of the contract', async () => {
    const generator = await loadGenerator();
    const parsed = generator.parseSchemaMarkdown(
      readFileSync(join(root, generator.SCHEMA_SOURCE), 'utf8'),
    );
    expect(parsed.enums).toHaveLength(58);
    // 40 entities + `_Common` + the two embedded item tables.
    expect(parsed.entities.length).toBeGreaterThanOrEqual(42);
  });

  it('parses a contract-shaped record and refuses a malformed one', () => {
    const appointment = {
      organizationId: '5f0c8a43-5e8e-4f45-9f8a-0d0b7d6c1a10',
      createdAt: '2026-10-03T04:30:00Z',
      updatedAt: '2026-10-03T04:30:00Z',
      createdById: '7b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e',
      deletedAt: null,
      deleteReason: null,
      deleteNote: null,
      id: '0c9b8a7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d',
      seq: 2841,
      patientId: null,
      leadId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      branchId: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
      type: 'consultation',
      offeringId: null,
      serviceLabel: 'Acne consult',
      doctorId: '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f',
      therapistId: null,
      room: 'room_1',
      date: '2026-10-03',
      startTime: '10:40',
      durationMin: 20,
      status: 'scheduled',
      cancelReason: null,
      cancelNote: null,
      rescheduledFrom: null,
      reason: null,
      notes: null,
      followUpAt: null,
      checkedInAt: null,
      completedAt: null,
      copiedFromId: null,
    };
    expect(appointmentSchema.parse(appointment).seq).toBe(2841);
    expect(() =>
      appointmentSchema.parse({ ...appointment, startTime: '25:00' }),
    ).toThrow();
    expect(() => appointmentSchema.parse({ ...appointment, status: 'done' })).toThrow();
    expect(APPOINTMENT_STATUS_VALUES).toContain('no_show');
  });

  it('types money as integer paise and phones as E.164', () => {
    expect(paymentSchema.shape.amount.safeParse(1200.5).success).toBe(false);
    expect(paymentSchema.shape.amount.safeParse(120_000).success).toBe(true);
    expect(patientSchema.shape.phone.safeParse('+919825044120').success).toBe(true);
    expect(patientSchema.shape.phone.safeParse('9825044120').success).toBe(false);
  });

  it('renames an enum that collides with an entity (feedback_action → FeedbackActionKind)', () => {
    expect(feedbackActionKindSchema.options.length).toBeGreaterThan(0);
  });
});
