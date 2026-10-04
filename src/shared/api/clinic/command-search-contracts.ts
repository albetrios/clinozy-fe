import { z } from 'zod';

import { invoiceSchema, leadSchema, patientSchema } from './clinic-schema.ts';

/*
 * ⌘K's search (`commandSearch`, `S:1565`): the schema names the entities it
 * reads and its rule — `q` of two or more characters matched on name, phone
 * digits and the display id, ten hits per type — but not the reply. These are
 * the hits as the command menu draws them, each a summary of its entity with
 * the display name joined server-side (Appendix F, REPLACE_WITH_API). The menu
 * shows no Appointments group (KICKOFF §6.0), so none is returned.
 */

/**
 * A patient hit: "Dharti Galani" · "#3508 · •••• 3212" — and, for the
 * appointment form's person search, "Patient · <care>" from their types.
 */
const commandSearchPatientSchema = patientSchema
  .pick({ id: true, seq: true, phone: true, types: true })
  .extend({ name: z.string() });

/** A patient hit. */
export type CommandSearchPatient = z.infer<typeof commandSearchPatientSchema>;

/**
 * A lead hit: "Dharti Galani" · "#2352 · Clinic visited" — never a contact
 * thread — and, for the appointment form's person search, "Lead #2352 ·
 * <mobile>".
 */
const commandSearchLeadSchema = leadSchema.pick({
  id: true,
  seq: true,
  name: true,
  status: true,
  kind: true,
  phone: true,
});

/** A lead hit. */
export type CommandSearchLead = z.infer<typeof commandSearchLeadSchema>;

/**
 * An invoice hit: "Clinic invoice #787" · "Dharti Galani · 24 Sep". The person
 * is the patient, or the walk-in buyer of a medicine sale; null when neither.
 */
const commandSearchInvoiceSchema = invoiceSchema
  .pick({ id: true, seq: true, type: true, date: true })
  .extend({ personName: z.string().nullable() });

/** An invoice hit. */
export type CommandSearchInvoice = z.infer<typeof commandSearchInvoiceSchema>;

/** One search's reply: up to ten hits per type, newest first. */
export const commandSearchResultSchema = z.object({
  patients: z.array(commandSearchPatientSchema),
  leads: z.array(commandSearchLeadSchema),
  invoices: z.array(commandSearchInvoiceSchema),
});

/** One search's reply. */
export type CommandSearchResult = z.infer<typeof commandSearchResultSchema>;
