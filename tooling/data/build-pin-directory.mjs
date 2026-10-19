#!/usr/bin/env node
/**
 * Builds the PIN directory the clinic setup's "Where is your clinic?" step reads
 * (`src/shared/app/pin-directory/`, iteration feat-clinic-setup-2026-10-13-sltd, D27 / §6.4):
 * a six-digit PIN → its district, state and the post offices' areas, bundled with the app so
 * the lookup needs no outside service and works offline.
 *
 * Source — India Post's "All India Pincode Directory till last month" (Department of Posts,
 * Ministry of Communications), published on the Open Government Data Platform India:
 *   https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month
 * Licence — Government Open Data License – India (GODL-India), which allows use with
 * attribution: https://www.data.gov.in/government-open-data-license-india
 *
 * The copy used — data.gov.in itself refused the connection from the build environment, so the
 * same file was taken from a public mirror that republishes it unchanged, pinned to its commit:
 *   https://raw.githubusercontent.com/dropdevrahul/pincodes-india/d26206918dd2fb9f155bfba18de0421bd5fa0ca8/pincode.csv
 *   commit d262069 "feat: adds pincode.csv from official source of data.gov.in", 2024-05-05;
 *   downloaded 2026-10-13; 23,760,720 bytes, sha256
 *   84af12fa29adddedfa9addcf46546000d89d2e2899b2993dc88050fafc8861e2;
 *   157,126 offices, 19,300 PINs. Columns: CircleName, RegionName, DivisionName, OfficeName,
 *   Pincode, OfficeType, Delivery, District, StateName, Latitude, Longitude.
 *
 * The raw CSV never enters the repository — download it to a scratch directory and pass its path:
 *
 *   node tooling/data/build-pin-directory.mjs <path/to/pincode.csv> [--out <directory>]
 *
 * Output (default `src/shared/app/pin-directory/data/`): one part per PIN prefix (the PIN's
 * first two digits), `pin-<prefix>.json`, each `{ "<pin>": [district, state, [area…]] }`.
 * Every earlier `pin-*.json` there is removed first, so a prefix the source drops goes too.
 * The output is deterministic — PINs and areas sorted, then formatted by the repository's
 * Prettier config — so a rebuild from the same CSV changes no byte.
 *
 * Per PIN:
 *   - district and state — the pair most of its offices carry (a few PINs straddle a district
 *     line); a tie goes to the pair of its head office, then its sub-office, then the first by
 *     name. Title case: "BENGALURU URBAN" → "Bengaluru Urban", "JAMMU AND KASHMIR" →
 *     "Jammu and Kashmir".
 *   - areas — its offices' names read as places: India Post's office-type suffix and anything
 *     after it dropped ("Adajan BO" → "Adajan", "Town Hall SO Mumbai" → "Town Hall",
 *     "Amba B.O (Alauli S.O)" → "Amba", "Bengaluru G.P.O." → "Bengaluru"), an all-capitals name
 *     title-cased ("PALVANCHA B.O" → "Palvancha"), de-duplicated ignoring case, sorted.
 *     Offices that are not places — nodal delivery centres, extension counters, the test
 *     office — are left out; a PIN with none of its own keeps its district and state.
 */
import { readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, parseCommandLine } from '../ci/script.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Where the parts go unless `--out` says otherwise. */
export const DEFAULT_OUT_DIRECTORY = join(ROOT, 'src/shared/app/pin-directory/data');

/** A part's file name: `pin-<the PIN's first two digits>.json`. */
export const PART_FILE = /^pin-\d{2}\.json$/;

/** A PIN: six digits, never starting with 0. */
const PIN = /^[1-9]\d{5}$/;

/**
 * Header names per field, lower-cased — the data.gov.in "till last month" file first, then the
 * older directory's spellings, so either file builds.
 */
const COLUMNS = {
  pin: ['pincode'],
  office: ['officename'],
  officeType: ['officetype'],
  district: ['district', 'districtname'],
  state: ['statename', 'state'],
};

/** Tie-break order of an office type when a PIN's offices disagree on the district. */
const OFFICE_TYPE_RANK = { HO: 0, 'H.O': 0, PO: 1, SO: 1, 'S.O': 1, BO: 2, 'B.O': 2 };

/** Words kept lower-case inside a title-cased name ("Jammu and Kashmir"). */
const CONNECTORS = new Set(['and', 'of', 'the']);

/** A dotted office type, glued or spaced, in any case: "B.O", "S.O.", "NDS.O", "B.o", "G.P.O." */
const DOTTED_OFFICE_TYPE = /\s*(?:G\.\s?P\.\s?O|[BSH]\.\s?O)\.?(?![A-Za-z])/i;

/** An undotted office type as its own word, in any case: "SO", "Aghara So BO", "Tadur Bo'". */
const SPACED_OFFICE_TYPE = /\s+(?:[BSH]O|GPO|PO)(?![A-Za-z])/i;

/** An undotted office type glued to a lower-case word or a bracket: "bazarBO", "VaranaBO". */
const GLUED_OFFICE_TYPE = /(?<=[a-z)])(?:BO|SO|HO|GPO|PO)(?![A-Za-z])/;

const OFFICE_TYPES = [DOTTED_OFFICE_TYPE, SPACED_OFFICE_TYPE, GLUED_OFFICE_TYPE];

/** India Post's non-delivery marker left after the type is cut ("Thygarayanagar North ND"). */
const TRAILING_NON_DELIVERY = /\s+N\.?D\.?$/;

/** Offices that are not places a clinic is in. */
const NOT_A_PLACE = /\b(?:test office|extension counter|extn counter|nodal|ndc)\b/i;

/**
 * Parses RFC 4180 CSV text — quoted fields, `""` escapes, commas and line breaks inside quotes,
 * CRLF or LF — into rows of fields. A byte-order mark is ignored; a blank line is skipped.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character !== '"') field += character;
      else if (source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Each field's column index in `header`; throws naming the first field the header lacks. */
export function columnIndexes(header) {
  const names = header.map((name) => name.trim().toLowerCase());
  const indexes = {};
  for (const [field, candidates] of Object.entries(COLUMNS)) {
    const index = names.findIndex((name) => candidates.includes(name));
    if (index === -1) {
      throw new Error(
        `build-pin-directory: the CSV header has no ${candidates.join(' / ')} column`,
      );
    }
    indexes[field] = index;
  }
  return indexes;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Title case for a district or a state — and for an office name written in capitals: every word
 * capitalized, "and" / "of" / "the" lower-case after the first word, a letter after an apostrophe
 * lower-case ("KING'S" → "King's"), and a vowel-less capitals word kept as the acronym it is
 * ("MPT", "RLY").
 */
export function titleCase(text) {
  let words = 0;
  return text.replace(/[A-Za-z]+/g, (word, offset) => {
    const first = words === 0;
    words += 1;
    const lower = word.toLowerCase();
    if (!first && CONNECTORS.has(lower)) return lower;
    if (offset > 0 && text[offset - 1] === "'" && word.length === 1) return lower;
    if (word.length > 1 && word === word.toUpperCase() && !/[AEIOU]/.test(word))
      return word;
    return capitalize(lower);
  });
}

/**
 * A mixed-case office name's casing: its lower-case words capitalized ("Nawada bazar" →
 * "Nawada Bazar"), everything else as written ("HighCourt", "SGIT", "Dr. Ambedkar Veedhi").
 */
function mixedCase(text) {
  let words = 0;
  return text.replace(/[a-z]+/gi, (word, offset) => {
    const first = words === 0;
    words += 1;
    if (word !== word.toLowerCase()) return word;
    if (!first && CONNECTORS.has(word)) return word;
    if (offset > 0 && text[offset - 1] === "'") return word;
    return capitalize(word);
  });
}

/** Where the first office-type marker starts in `name`, or -1. */
function officeTypeStart(name) {
  const starts = OFFICE_TYPES.map((pattern) => name.search(pattern)).filter(
    (index) => index !== -1,
  );
  return starts.length === 0 ? -1 : Math.min(...starts);
}

/**
 * An India Post office name read as the area it serves, or `null` for an office that is not a
 * place (a nodal delivery centre, an extension counter, the test office) or leaves no name.
 */
export function areaName(officeName) {
  let name = officeName
    .replace(/\s+/g, ' ')
    .replace(/\[/g, '(')
    .replace(/]/g, ')')
    .trim();
  const cut = officeTypeStart(name);
  if (cut > 0) name = name.slice(0, cut);
  else if (cut === 0) {
    // The type comes first — nothing before it to keep, so drop the types and keep the rest.
    name = OFFICE_TYPES.reduce(
      (text, pattern) =>
        text.replace(new RegExp(pattern.source, `${pattern.flags}g`), ' '),
      name,
    );
  }
  name = name
    .replace(TRAILING_NON_DELIVERY, '')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)/g, ')')
    .replace(/\s*\([^)]*$/, '');
  if (!name.includes('(')) name = name.replace(/\)/g, '');
  name = name
    .replace(/^[\s,;:/`-]+|[\s,;:/`-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name === '' || NOT_A_PLACE.test(name)) return null;
  return /[a-z]/.test(name) ? mixedCase(name) : titleCase(name);
}

/** Code-unit order, ignoring case, then exact — the same on every machine and Node version. */
function compareNames(left, right) {
  const leftKey = left.toLowerCase();
  const rightKey = right.toLowerCase();
  if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function officeTypeRank(officeType) {
  return OFFICE_TYPE_RANK[officeType.trim().toUpperCase()] ?? 3;
}

/** The district and state most of a PIN's offices carry; see the module header for ties. */
function chooseDistrict(places) {
  let best;
  for (const place of places.values()) {
    if (
      !best ||
      place.count > best.count ||
      (place.count === best.count && place.rank < best.rank) ||
      (place.count === best.count &&
        place.rank === best.rank &&
        compareNames(place.key, best.key) < 0)
    ) {
      best = place;
    }
  }
  return best;
}

/**
 * The directory from the CSV's rows (header first): a map of PIN prefix → part, prefixes in
 * order, each part `{ pin: [district, state, areas] }` with PINs in order. A row whose PIN is
 * not six digits is skipped.
 */
export function buildPinDirectory(rows) {
  const [header, ...records] = rows;
  if (!header) throw new Error('build-pin-directory: the CSV is empty');
  const column = columnIndexes(header);
  const pins = new Map();
  for (const record of records) {
    const pin = (record[column.pin] ?? '').trim();
    if (!PIN.test(pin)) continue;
    const district = (record[column.district] ?? '').trim();
    const state = (record[column.state] ?? '').trim();
    let entry = pins.get(pin);
    if (!entry) {
      entry = { places: new Map(), areas: new Map() };
      pins.set(pin, entry);
    }
    if (district && state) {
      const key = `${district}\u0000${state}`;
      const rank = officeTypeRank(record[column.officeType] ?? '');
      const place = entry.places.get(key);
      if (place) {
        place.count += 1;
        place.rank = Math.min(place.rank, rank);
      } else entry.places.set(key, { key, district, state, count: 1, rank });
    }
    const area = areaName(record[column.office] ?? '');
    if (area) {
      const areaKey = area.toLowerCase();
      const known = entry.areas.get(areaKey);
      if (!known || compareNames(area, known) < 0) entry.areas.set(areaKey, area);
    }
  }

  const parts = new Map();
  for (const pin of [...pins.keys()].sort()) {
    const { places, areas } = pins.get(pin);
    const place = chooseDistrict(places);
    if (!place) continue;
    const prefix = pin.slice(0, 2);
    let part = parts.get(prefix);
    if (!part) {
      part = {};
      parts.set(prefix, part);
    }
    part[pin] = [
      titleCase(place.district),
      titleCase(place.state),
      [...areas.values()].sort(compareNames),
    ];
  }
  return parts;
}

/**
 * A part as the repository commits it: JSON in the repository's Prettier format — resolved for
 * the part's place under {@link DEFAULT_OUT_DIRECTORY} whatever `--out` says, so every output
 * directory gets the same bytes (and `prettier --check` / lint-staged leave them alone).
 */
export async function formatPart(part, fileName) {
  const prettier = await import('prettier');
  const filePath = join(DEFAULT_OUT_DIRECTORY, fileName);
  const options = (await prettier.resolveConfig(filePath)) ?? {};
  return prettier.format(JSON.stringify(part), { ...options, filepath: filePath });
}

/** `<csv> [--out <directory>]` → their values; throws on anything else. */
export function parseArguments(argv) {
  const unexpected = (argument) => `build-pin-directory: unexpected argument ${argument}`;
  const { values, positionals } = parseCommandLine(argv, {
    options: { out: { type: 'string' } },
    maxPositionals: Number.POSITIVE_INFINITY,
    messages: {
      unknownOption: unexpected,
      needsValue: () => 'build-pin-directory: --out needs a directory',
    },
  });
  if (positionals.length > 1) throw new Error(unexpected(positionals[1]));
  const csvPath = positionals[0] === undefined ? undefined : resolve(positionals[0]);
  const outDirectory =
    values.out === undefined ? DEFAULT_OUT_DIRECTORY : resolve(values.out);
  if (!csvPath) {
    throw new Error(
      'build-pin-directory: pass the CSV path — node tooling/data/build-pin-directory.mjs <pincode.csv> [--out <directory>]',
    );
  }
  return { csvPath, outDirectory };
}

async function main() {
  const { csvPath, outDirectory } = parseArguments(process.argv.slice(2));
  const parts = buildPinDirectory(parseCsv(readFileSync(csvPath, 'utf8')));
  mkdirSync(outDirectory, { recursive: true });
  for (const file of readdirSync(outDirectory)) {
    if (PART_FILE.test(file)) rmSync(join(outDirectory, file));
  }
  let pinCount = 0;
  let totalBytes = 0;
  let largest = { file: '', bytes: 0 };
  for (const [prefix, part] of parts) {
    const file = `pin-${prefix}.json`;
    const filePath = join(outDirectory, file);
    const text = await formatPart(part, file);
    writeFileSync(filePath, text);
    const bytes = Buffer.byteLength(text);
    pinCount += Object.keys(part).length;
    totalBytes += bytes;
    if (bytes > largest.bytes) largest = { file, bytes };
  }
  console.log(
    `build-pin-directory: ${pinCount} PINs in ${parts.size} parts, ${(totalBytes / 1024).toFixed(1)} kB ` +
      `(largest ${largest.file}, ${(largest.bytes / 1024).toFixed(1)} kB) → ${outDirectory}`,
  );
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
