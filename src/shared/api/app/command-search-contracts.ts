/*
 * ⌘K's search on clinozy-be (api-integration §5.11, §6 #1; D158): one People group from
 * `GET /app/contacts?q=` — the people who match, best match first. Each hit names its patient
 * file and its open lead, so the menu opens whichever the member may view.
 */

/** A person ⌘K found: "Dharti Galani" · "#3508 · •••• 3212" (a patient) or "C-1204 · •••• 3212". */
export interface CommandSearchPerson {
  /** The contact (`con_…`). */
  id: string;
  name: string;
  /** "C-1204" is this number. */
  contactNumber: number;
  /** E.164 — the rows show its last four digits. */
  phone: string;
  /** Their patient file (`pat_…`), once a check-in opened it. */
  patientId: string | null;
  /** "#3508" — with the patient file. */
  patientNumber: number | null;
  /** Their open lead (`lead_…`), if any. */
  openLeadId: string | null;
}

/** One search's reply: the people, best match first. */
export interface CommandSearchResult {
  people: CommandSearchPerson[];
}
