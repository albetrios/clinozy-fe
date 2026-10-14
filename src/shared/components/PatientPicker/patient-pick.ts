/** A patient the field took — what a receipt or an invoice names. */
export interface PatientPick {
  /** The patient file (`pat_…`) — the field's value. */
  id: string;
  /** Their contact (`con_…`). */
  contactId: string;
  name: string;
  /** Their primary mobile, E.164. */
  phone: string;
}
