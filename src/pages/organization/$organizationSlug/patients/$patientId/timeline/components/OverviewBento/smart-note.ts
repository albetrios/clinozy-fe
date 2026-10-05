import type { ClinicalField } from '../../../shared/patient-clinical.ts';

/** The lists a smart note files words under (H:4918 `SNK`: no Later). */
type SmartNoteField = Exclude<ClinicalField, 'futureSuggestions'>;

/**
 * The smart note's dictionary (H:3702 `SN_DICT`), verbatim: the words it
 * files under Complaints, Diagnosis and the suggested treatments. English
 * only, as the prototype's.
 */
export const SMART_NOTE_WORDS: Readonly<Record<SmartNoteField, readonly string[]>> = {
  complaints: [
    'hair fall',
    'itching',
    'tan',
    'tanning',
    'acne',
    'pimples',
    'pigmentation',
    'dark spots',
    'redness',
    'dandruff',
    'dryness',
    'pain',
  ],
  diagnosis: [
    'melasma',
    'alopecia',
    'pih',
    'acne vulgaris',
    'dermatitis',
    'seborrheic',
    'fungal infection',
    'vitiligo',
  ],
  treatmentSuggestions: ['peel', 'lhr', 'hydrafacial', 'prp', 'laser', 'microneedling'],
};

/** The shortest note the smart note reads (H:4917 `length < 3`). */
const SMART_NOTE_MIN = 3;

/** What a smart note recognised: the chips for the clinical lists, and the medicines. */
export interface SmartNoteFindings {
  chips: { field: ClinicalField; text: string }[];
  /** The catalogue's medicines whose name's first word the note holds. */
  medicines: string[];
}

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * Read a smart note (H:4917): each dictionary word it holds, capitalised,
 * under its list — "hair fall 2 months, suggest PRP" → Complaints "Hair fall",
 * Suggested "Prp" — and each medicine whose name's first word it holds
 * ("flubolt" → Flubolt 400). Under three letters it reads nothing.
 */
export function parseSmartNote(
  note: string,
  medicineNames: readonly string[],
): SmartNoteFindings {
  const text = note.toLowerCase();
  if (text.trim().length < SMART_NOTE_MIN) return { chips: [], medicines: [] };
  const chips = (
    Object.entries(SMART_NOTE_WORDS) as [SmartNoteField, readonly string[]][]
  ).flatMap(([field, words]) =>
    words
      .filter((word) => text.includes(word))
      .map((word) => ({
        field,
        text: capitalised(word),
      })),
  );
  const medicines = medicineNames.filter((name) => {
    const [first = ''] = name.toLowerCase().split(' ');
    return first !== '' && text.includes(first);
  });
  return { chips, medicines };
}
