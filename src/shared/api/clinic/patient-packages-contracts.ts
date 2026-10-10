import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

/*
 * A patient's packages on clinozy-be (`GET /app/patients/:patient_id/offerings?is_package=true`,
 * api-integration §5.4): an offering sold to them with its sessions. The server counts the
 * sessions (a recorded treatment spends one, reversing it gives it back — §6 #20, §7) and
 * keeps the status; the file reads them. A package is bought only by invoicing it (G4: no
 * package before its invoice); its validity and sessions change by `PATCH …/:patient_offering_id`.
 */

type ApiPatientOffering = NonNullable<
  ApiData<'/app/patients/{patient_id}/offerings', 'get'>
>[number];

/** The statuses of a patient's package — the server derives them (`used_up`, `expired` by its today). */
const PATIENT_PACKAGE_STATUS_VALUES = ['active', 'used_up', 'expired'] as const;

/** One package status. */
export type PatientPackageStatus = (typeof PATIENT_PACKAGE_STATUS_VALUES)[number];

/** The most sessions a package takes (`PATCH …/offerings`: `sessions_total` 1–999). */
export const PACKAGE_SESSIONS_MAX = 999;

/** A patient offering as the list answers it. */
export const patientOfferingWire = wireSchema<ApiPatientOffering>()(
  z.object({
    id: z.string(),
    offering_id: z.string(),
    offering_name: z.string(),
    sessions_total: z.number().int(),
    sessions_used: z.number().int(),
    sessions_left: z.number().int(),
    is_package: z.boolean(),
    status: z.enum(PATIENT_PACKAGE_STATUS_VALUES),
    valid_until: z.string().nullable(),
    invoice_id: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A patient's package as the file reads it. */
export interface PatientPackageRow {
  /** The patient offering's id. */
  id: string;
  offeringId: string;
  /** The offering's name as it was sold. */
  name: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsLeft: number;
  status: PatientPackageStatus;
  /** `YYYY-MM-DD`, or none. */
  validUntil: string | null;
  /** The invoice that sold it. */
  invoiceId: string | null;
  createdAt: string;
  /** What a change sends back as `expected_updated_at`. */
  updatedAt: string;
}

/** A patient offering from the wire. */
export function toPatientPackageRow(
  row: z.output<typeof patientOfferingWire>,
): PatientPackageRow {
  return {
    id: row.id,
    offeringId: row.offering_id,
    name: row.offering_name,
    sessionsTotal: row.sessions_total,
    sessionsUsed: row.sessions_used,
    sessionsLeft: row.sessions_left,
    status: row.status,
    validUntil: row.valid_until,
    invoiceId: row.invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * One thing a patient bought (`GET …/offerings`, every kind, newest first) — the plan card's
 * "<first>’s last purchases" (route map: `getPlan` reads `…/offerings`).
 */
export interface PatientPurchaseRow extends PatientPackageRow {
  /** A package — its sessions are shown — rather than a single treatment. */
  isPackage: boolean;
}

/** A bought offering from the wire, as a purchase line. */
export function toPatientPurchaseRow(
  row: z.output<typeof patientOfferingWire>,
): PatientPurchaseRow {
  return { ...toPatientPackageRow(row), isPackage: row.is_package };
}

/** A change of a package (`PATCH …/offerings/:patient_offering_id`, `payment:update`). */
export interface PatientPackageChange {
  /** `YYYY-MM-DD`, never before its invoice's date; `null` = no expiry. */
  validUntil?: string | null;
  /** 1–999, never below the sessions used. */
  sessionsTotal?: number;
}
