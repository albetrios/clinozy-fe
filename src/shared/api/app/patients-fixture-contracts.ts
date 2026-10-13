import { z } from 'zod';

import { patientSchema } from './app-schema.ts';

/*
 * The fixture patients beyond the generated contract (KICKOFF §6.5, §3.6, D22): the plan-only
 * fields — each a fixture field until clinozy-be serves it (Appendix F › Patients,
 * REPLACE_WITH_API). Read by the fixture world's patients — the chat column's patient threads
 * (`messages-api.ts`); every room reads `patients-contracts.ts`.
 */

// ── Records ──

/** The consent chips the drawer offers (Appendix F: a set replacing `consentGiven`). */
const PATIENT_CONSENT_VALUES = ['data', 'photos', 'marketing'] as const;

/** Zod enum of one consent chip. */
const patientConsentSchema = z.enum(PATIENT_CONSENT_VALUES);

/** One consent the patient signed. */
export type PatientConsent = z.infer<typeof patientConsentSchema>;

/**
 * A patient as the rooms read it: the contract's `Patient` (`S:287–320`) with
 * the plan's fields (Appendix F, REPLACE_WITH_API) — the free-text "Referred
 * by", the Data / Photos / Marketing consent set (the contract's
 * `consentGiven` follows its Data chip), and who last saved the record
 * (`updatedById` on `_Common`). `conversion` keeps the contract's non-null
 * shape: a cleared chip saves as the contract default until clinozy-be makes it
 * nullable (Appendix F).
 */
export const patientRecordSchema = patientSchema.extend({
  referredByName: z.string().nullable(),
  consents: z.array(patientConsentSchema),
  updatedById: z.uuid(),
});

/** A patient record — the contract's fields and the plan's. */
export type PatientRecord = z.infer<typeof patientRecordSchema>;
