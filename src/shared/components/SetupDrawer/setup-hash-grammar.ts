/**
 * Dependency-free hash grammar for the clinic setup drawer: `#setup[/<step>]` (feat-clinic-setup
 * KICKOFF §4, D11).
 *
 * Hash state (not a path), like Settings' `#settings/<scope>/<section>`: the drawer rides on ANY
 * room without re-running route matching or unmounting the room behind it. A refresh, a shared
 * link or another default room reopens the same step; route guards never see the hash, so the
 * drawer gates itself. **Pure string work, no runtime imports** — the shell's entry points (the
 * account menu, ⌘K, the create-action guard) need only this.
 */
const SETUP_HASH_PREFIX = 'setup';

/** The drawer's addressable places, in the drawer's order. */
const SETUP_HASH_STEPS = ['clinic-type', 'location', 'you', 'live', 'guide'] as const;

/** One of {@link SETUP_HASH_STEPS}. */
export type SetupHashStep = (typeof SETUP_HASH_STEPS)[number];

function normalize(hash: string): string {
  const bare = hash.startsWith('#') ? hash.slice(1) : hash;
  return bare.split(/[?#]/)[0] ?? bare;
}

/** The hash value (without `#`) for the drawer, at `step` or wherever it belongs. */
export function setupHash(step?: SetupHashStep): string {
  return step ? `${SETUP_HASH_PREFIX}/${step}` : SETUP_HASH_PREFIX;
}

/** True when the hash addresses the setup drawer at all. */
export function isSetupHash(hash: string): boolean {
  const path = normalize(hash);
  return path === SETUP_HASH_PREFIX || path.startsWith(`${SETUP_HASH_PREFIX}/`);
}

/**
 * The place the hash names: a known step, `null` for the bare `#setup` (the drawer picks) or an
 * unknown step (canonicalized by the drawer), `undefined` when the hash is not the drawer's.
 */
export function parseSetupHash(hash: string): SetupHashStep | null | undefined {
  if (!isSetupHash(hash)) return undefined;
  const [, step] = normalize(hash).split('/');
  return (SETUP_HASH_STEPS as readonly string[]).includes(step ?? '')
    ? (step as SetupHashStep)
    : null;
}
