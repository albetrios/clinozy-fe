import { type ModuleLoader, onceAsync } from '@/lib/lazy-module.ts';

/**
 * Where a PIN is: its district, its state and the areas its post offices serve — what the clinic
 * setup's "Where is your clinic?" step fills in (iteration feat-clinic-setup-2026-10-13-sltd, D27).
 */
export interface PinPlace {
  /** The six-digit PIN looked up. */
  pin: string;
  /** Its district, as India Post files it ("Surat", "Bengaluru Urban"). */
  district: string;
  /** Its state or union territory ("Gujarat", "Jammu and Kashmir"). */
  state: string;
  /** Its post offices' areas, sorted — several mean an area picker; none, an empty list. */
  areas: string[];
}

/** One data part as the generator writes it: `{ "<pin>": [district, state, [area…]] }`. */
export type PinDirectoryPart = Record<
  string,
  readonly [string, string, readonly string[]]
>;

/** A data part's loader, keyed by its module path (`./data/pin-<prefix>.json`). */
export type PinDirectoryLoaders = Record<string, () => Promise<PinDirectoryPart>>;

/** A PIN: six digits, never starting with 0 — the setup's PIN field checks the same. */
export const PIN_CODE_PATTERN = /^[1-9]\d{5}$/;

/** A data part's path → the PIN prefix it holds. */
const PART_PATH = /pin-(\d{2})\.json$/;

/**
 * Every data part as its own lazy chunk — `import.meta.glob` without `eager` compiles to one
 * `import()` per part, run only when {@link lookupPin} asks for that part, never on first paint.
 */
const PART_LOADERS: PinDirectoryLoaders = import.meta.glob<PinDirectoryPart>(
  './data/pin-*.json',
  { import: 'default' },
);

/**
 * Builds a PIN lookup over `loaders` (one per data part, keyed by its `pin-<prefix>.json` path).
 *
 * @remarks
 * Each part loads once, on the first lookup in its prefix; concurrent lookups share the one
 * load and the part stays in memory (`onceAsync`). A failed load is not kept, so a lookup made
 * after the network returns tries again. Exported for tests — the app uses {@link lookupPin}.
 */
export function createPinLookup(
  loaders: PinDirectoryLoaders,
): (pin: string) => Promise<PinPlace | null> {
  const parts = new Map<string, ModuleLoader<PinDirectoryPart>>();
  for (const [path, load] of Object.entries(loaders)) {
    const prefix = PART_PATH.exec(path)?.[1];
    if (prefix) parts.set(prefix, onceAsync(load));
  }

  return async (pin) => {
    const candidate = pin.trim();
    if (!PIN_CODE_PATTERN.test(candidate)) return null;
    const load = parts.get(candidate.slice(0, 2));
    if (!load) return null;
    let part: PinDirectoryPart;
    try {
      part = await load();
    } catch {
      return null;
    }
    const entry = Object.hasOwn(part, candidate) ? part[candidate] : undefined;
    if (!entry) return null;
    const [district, state, areas] = entry;
    return { pin: candidate, district, state, areas: [...areas] };
  };
}

const lookupInDirectory = createPinLookup(PART_LOADERS);

/**
 * The place a six-digit PIN belongs to, from India Post's directory bundled with the app — or
 * `null` for a malformed PIN, a PIN the directory does not know, or a part that failed to load.
 * Never rejects.
 *
 * @remarks
 * Loads only the part for the PIN's first two digits (one lazy chunk each, ~30 kB gzipped at
 * most), so call it once the sixth digit is typed. Loaded parts stay in memory; the service
 * worker keeps the chunk for offline use.
 *
 * @param pin - The PIN as typed; surrounding spaces are ignored.
 * @returns The place, or `null` when there is nothing to fill.
 */
export function lookupPin(pin: string): Promise<PinPlace | null> {
  return lookupInDirectory(pin);
}
