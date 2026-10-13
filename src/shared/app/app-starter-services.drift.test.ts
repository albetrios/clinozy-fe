import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { OFFERING_SPECIALTY_VALUES } from '@/shared/api/app/app-schema.ts';

import {
  consultationOf,
  isConsultationRow,
  STARTER_SERVICES,
  starterServicesFor,
} from './app-starter-services.ts';

/**
 * `STARTER_SERVICES` is the decisions table "Starter services (D18)" of feat-clinic-setup as code.
 * Every row of the table — specialty, English name, category, minutes, price, GST, sessions ·
 * validity and the tick — must match the code row for row, so neither changes alone.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const DECISIONS = 'iterations/feat-clinic-setup-2026-10-13-sltd/plans/decisions.md';
const SETUP_LOCALE = 'src/locales/en/setup.json';

interface TableRow {
  specialty: string;
  name: string;
  category: string;
  minutes: number;
  price: number;
  gstPercent: number;
  sessions: number;
  validityDays: number;
  isTicked: boolean;
}

/** The "Starter services (D18)" table's body rows, read cell by cell. */
function decisionsTable(): TableRow[] {
  const markdown = readFileSync(join(root, DECISIONS), 'utf8');
  const section = markdown.split('## Starter services (D18)')[1];
  if (section === undefined)
    throw new Error('decisions.md has no "Starter services (D18)"');
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  // The header and the |---| rule come first.
  return lines.slice(2).map((line) => {
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    const [specialty, name, category, minutes, price, gst, sessionsCell, ticked] = cells;
    const [sessions, validity] = (sessionsCell ?? '')
      .split('·')
      .map((part) => part.trim());
    return {
      specialty: (specialty ?? '').toLowerCase(),
      name: name ?? '',
      category: category ?? '',
      minutes: Number(minutes),
      price: Number((price ?? '').replaceAll(',', '')),
      gstPercent: Number((gst ?? '').replace('%', '')),
      sessions: Number(sessions),
      validityDays: validity ? Number.parseInt(validity, 10) : 0,
      isTicked: ticked === '✓',
    };
  });
}

/** The English name of a starter row, from the `setup` namespace. */
function englishName(nameKey: string): string {
  const bundle = JSON.parse(readFileSync(join(root, SETUP_LOCALE), 'utf8')) as Record<
    string,
    unknown
  >;
  const value = nameKey
    .split('.')
    .reduce<unknown>(
      (node, key) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[key]
          : undefined,
      bundle,
    );
  if (typeof value !== 'string') throw new Error(`setup.json has no ${nameKey}`);
  return value;
}

describe('STARTER_SERVICES (the decisions table, D18)', () => {
  const table = decisionsTable();

  it('has a row for every row of the table, in its order', () => {
    expect(table.length).toBeGreaterThan(0);
    expect(STARTER_SERVICES).toHaveLength(table.length);
  });

  it('matches every row cell for cell', () => {
    const code = STARTER_SERVICES.map((service) => ({
      specialty: service.specialty,
      name: englishName(service.nameKey),
      category: service.category,
      minutes: service.durationMinutes,
      price: service.price,
      gstPercent: service.gstPercent,
      sessions: service.sessions,
      validityDays: service.validityDays,
      isTicked: service.isTicked,
    }));
    expect(code).toEqual(table);
  });

  it('ticks only the Consultations', () => {
    for (const service of STARTER_SERVICES) {
      expect(service.isTicked).toBe(isConsultationRow(service));
    }
  });
});

describe('starterServicesFor', () => {
  it('lists the chosen specialties’ rows in the clinic’s specialty order', () => {
    const rows = starterServicesFor(['dental', 'skin']);
    expect(rows.map((row) => row.specialty)).toEqual([
      ...Array.from({ length: 5 }, () => 'dental'),
      ...Array.from({ length: 5 }, () => 'skin'),
    ]);
    expect(rows[0]?.nameKey).toBe('starter.names.consultation');
  });

  it('lists nothing without a specialty', () => {
    expect(starterServicesFor([])).toEqual([]);
  });
});

describe('consultationOf', () => {
  it('is each specialty’s Consultation row', () => {
    for (const specialty of OFFERING_SPECIALTY_VALUES) {
      const consultation = consultationOf(specialty);
      expect(consultation.specialty).toBe(specialty);
      expect(consultation.category).toBe('consultation');
      expect(isConsultationRow(consultation)).toBe(true);
    }
    expect(consultationOf('gynac').price).toBe(600);
  });
});

describe('isConsultationRow', () => {
  it('is the Consultation only — not another consultation-category row', () => {
    const followUp = STARTER_SERVICES.find(
      (service) => service.nameKey === 'starter.names.followUpVisit',
    );
    expect(followUp?.category).toBe('consultation');
    expect(followUp && isConsultationRow(followUp)).toBe(false);
  });
});
