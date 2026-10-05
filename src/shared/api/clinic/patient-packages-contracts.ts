import { z } from 'zod';

import { patientPackageSchema } from './clinic-schema.ts';

/**
 * A patient's package as the app holds it (KICKOFF §6.6 Add package; AMBER
 * A-F6): the contract's `PatientPackage` (`S:452–466`) with `invoiceId`
 * nullable — a package added from the file before it is invoiced has no
 * invoice until one names it ("Package added · invoice it from Invoices").
 * Appendix F contract request: make `PatientPackage.invoiceId` nullable (the
 * contract has it required and server-set, `S:461`). REPLACE_WITH_API.
 */
export const patientPackageRecordSchema = patientPackageSchema.extend({
  invoiceId: z.uuid().nullable(),
});

/** A patient's package — invoiced, or added before its invoice (`invoiceId` null). */
export type PatientPackageRecord = z.infer<typeof patientPackageRecordSchema>;
