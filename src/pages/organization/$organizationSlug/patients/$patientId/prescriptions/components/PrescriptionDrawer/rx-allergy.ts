import type { RxCatalogMedicine } from '@/shared/api/app/prescriptions-contracts.ts';

import type { RxFormLine } from './rx-form.ts';

/*
 * The allergy guard (feat-prescription-composer KICKOFF §6.5; D8): the
 * patient's own allergy list read against each line's medicine name and the
 * store's composition. A text match on the file's own words — never a
 * clinical database: it warns, and the doctor decides.
 */

/** Words an allergy is written with that name no medicine ("Sulfa drugs", "Allergic to …"). */
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'allergic',
  'allergies',
  'allergy',
  'antibiotic',
  'antibiotics',
  'class',
  'drug',
  'drugs',
  'group',
  'medication',
  'medications',
  'medicine',
  'medicines',
  'severe',
  'tablet',
  'tablets',
]);

/** The shortest allergy word read as a stem — shorter ones match too much. */
const STEM_MIN = 4;

/**
 * Drug families an allergy names by class or by one member: an allergy word
 * starting with a trigger, or naming a member, reads every member — each a
 * word stem of a name or composition.
 */
const DRUG_FAMILIES: readonly {
  triggers: readonly string[];
  members: readonly string[];
}[] = [
  {
    // Penicillins (a beta-lactam allergy).
    triggers: ['penicillin', 'betalactam', 'beta-lactam'],
    members: [
      'penicillin',
      'amoxicillin',
      'amoxycillin',
      'amoxyclav',
      'ampicillin',
      'cloxacillin',
      'dicloxacillin',
      'flucloxacillin',
      'piperacillin',
    ],
  },
  {
    // Sulfonamides.
    triggers: ['sulfa', 'sulpha', 'sulfonamide', 'sulphonamide'],
    members: ['sulfa', 'sulpha', 'sulfonamide', 'sulphonamide'],
  },
  {
    // Cephalosporins.
    triggers: ['cephalosporin'],
    members: ['cef', 'ceph'],
  },
  {
    // Tetracyclines.
    triggers: ['tetracycline'],
    members: ['tetracycline', 'doxycycline', 'minocycline', 'oxytetracycline'],
  },
  {
    // Non-steroidal anti-inflammatory drugs.
    triggers: ['nsaid'],
    members: [
      'aceclofenac',
      'aspirin',
      'celecoxib',
      'diclofenac',
      'etoricoxib',
      'ibuprofen',
      'indomethacin',
      'ketorolac',
      'mefenamic',
      'naproxen',
      'nimesulide',
      'piroxicam',
    ],
  },
];

/** Lower-cased letter runs: "Sulfamethoxazole 800 mg + Trimethoprim" → its words. */
function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}-]+/gu) ?? [];
}

/** A word without the hyphens at its ends ("-lactam-" → "lactam"). */
function trimHyphens(word: string): string {
  let start = 0;
  let end = word.length;
  while (start < end && word.charAt(start) === '-') start += 1;
  while (end > start && word.charAt(end - 1) === '-') end -= 1;
  return word.slice(start, end);
}

/** The stems one allergy reads: its own words, and every member of a family it names. */
export function allergyStems(allergy: string): string[] {
  const own = wordsOf(allergy)
    .map(trimHyphens)
    .filter((word) => word.length >= STEM_MIN && !GENERIC_WORDS.has(word));
  const stems = new Set(own);
  for (const word of own) {
    for (const family of DRUG_FAMILIES) {
      const named =
        family.triggers.some((trigger) => word.startsWith(trigger)) ||
        family.members.some(
          (member) => member.length >= STEM_MIN && word.startsWith(member),
        );
      if (named) for (const member of family.members) stems.add(member);
    }
  }
  return [...stems];
}

/** One line the guard names: its medicine and the allergies it matches. */
export interface RxAllergyMatch {
  /** The line's place in the form's `items`. */
  index: number;
  medicineName: string;
  allergies: string[];
}

/** Whether one of the words starts with one of the stems. */
function holdsStem(words: readonly string[], stems: readonly string[]): boolean {
  return stems.some((stem) => words.some((word) => word.startsWith(stem)));
}

/** The text a line is read by: its name, and the store's composition when the store has it. */
function lineText(line: RxFormLine, catalog: readonly RxCatalogMedicine[]): string {
  const name = line.medicineName.trim().toLowerCase();
  const known =
    catalog.find(
      (medicine) => line.medicineId !== null && medicine.medicineId === line.medicineId,
    ) ?? catalog.find((medicine) => medicine.name.toLowerCase() === name);
  return [line.medicineName, known?.composition ?? ''].join(' ');
}

/**
 * The lines whose medicine name or composition holds a stem of one of the
 * patient's allergies (`allergyStems`) — each line once, with every allergy
 * it matches, in the form's order. None without allergies.
 */
export function rxAllergyMatches(
  lines: readonly RxFormLine[],
  catalog: readonly RxCatalogMedicine[],
  allergies: readonly string[] | null,
): RxAllergyMatch[] {
  if (!allergies || allergies.length === 0) return [];
  const read = allergies
    .map((allergy) => ({ allergy, stems: allergyStems(allergy) }))
    .filter((entry) => entry.stems.length > 0);
  const matches: RxAllergyMatch[] = [];
  lines.forEach((line, index) => {
    if (line.medicineName.trim() === '') return;
    const words = wordsOf(lineText(line, catalog));
    const hit = read
      .filter((entry) => holdsStem(words, entry.stems))
      .map((entry) => entry.allergy);
    if (hit.length > 0)
      matches.push({ index, medicineName: line.medicineName.trim(), allergies: hit });
  });
  return matches;
}
