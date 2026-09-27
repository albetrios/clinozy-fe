import type {
  SettingsScope,
  SettingsSection,
  SettingsSectionRef,
} from './settings-sections.ts';

/**
 * Dependency-free hash grammar for the global settings modal:
 * `#settings/<scope>/<section>`.
 *
 * Hash state (not a path) on purpose: the modal must overlay ANY page —
 * including deep organization URLs — without re-running route matching or
 * unmounting the page behind it. Copy-link reproduces page + modal, refresh
 * survives, back/Esc closes. Route guards never see hashes, so all gating
 * lives inside the modal (settings-permissions.ts). routing-and-tenancy.md §7.
 *
 * **Everything here is pure string work** and imports only *types* from
 * `settings-sections.ts` (erased at build). That is deliberate: the
 * entry-resident settings surfaces — `SettingsModalLazy` (mounted on the root
 * route to listen for the hash), NotificationCenter, CommandPalette, AppLayout,
 * AppContextStrip, SidebarQuickLinks — need only this grammar. Importing them
 * from `settings-hash.ts` instead would drag its `parseSettingsHash` →
 * `settings-sections.ts` → `settings.constants.ts` chain (the section registry
 * + full i18n key table) onto the first-paint chunk. Keep this module free of
 * runtime imports; anything that needs the section registry lives in
 * `settings-hash.ts`.
 */
export const SETTINGS_HASH_PREFIX = 'settings';

/** Build the hash value (without a leading `#`) for a settings location. */
export function settingsHash(scope: SettingsScope, section: SettingsSection): string {
  return `${SETTINGS_HASH_PREFIX}/${scope}/${section}`;
}

function normalize(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash;
}

/** True when the hash addresses the settings modal at all. */
export function isSettingsHash(hash: string): boolean {
  const h = normalize(hash);
  return h === SETTINGS_HASH_PREFIX || h.startsWith(`${SETTINGS_HASH_PREFIX}/`);
}

/**
 * Settings hash path only — `settings/<scope>/<section>` with any trailing
 * `?query` or `#fragment` removed. Page-level search params (`?q=…` before
 * `#`) are untouched; only garbage appended to the hash itself is stripped.
 */
export function settingsHashPath(hash: string): string {
  const h = normalize(hash);
  if (!isSettingsHash(h)) return h;
  return h.split(/[?#]/)[0] ?? h;
}

/** Normalized hash path (no leading `#`, no trailing `?…`). */
export function normalizeSettingsHash(hash: string): string {
  return settingsHashPath(hash);
}

/** True when the location hash exactly matches the canonical deep link for `ref`. */
export function isCanonicalSettingsHash(hash: string, ref: SettingsSectionRef): boolean {
  return normalize(hash) === settingsHash(ref.scope, ref.section);
}
