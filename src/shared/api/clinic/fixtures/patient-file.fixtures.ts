/**
 * The patient file's plan-only facts (Appendix F, REPLACE_WITH_API): a
 * patient's language and Instagram handle, which the contract does not store.
 * `CINFO` (H:3369) gives two patients a language each, `CONTACTS` (H:3368)
 * gives Dharti her handle; everyone else has none.
 */
const LANGUAGES: Readonly<Record<number, string>> = {
  3508: 'Gujarati',
  3460: 'Gujarati',
};

const INSTAGRAM: Readonly<Record<number, string>> = {
  3508: '@dharti',
};

/** The language a patient speaks, by their `seq`, when the seeds name one. */
export function patientLanguage(seq: number): string | null {
  return LANGUAGES[seq] ?? null;
}

/** A patient's Instagram handle, by their `seq`, when the seeds name one. */
export function patientInstagram(seq: number): string | null {
  return INSTAGRAM[seq] ?? null;
}
