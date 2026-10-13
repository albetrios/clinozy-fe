import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { DrawerContentProfile } from '@/shared/components/RecordDrawer/record-drawer-width.ts';

/**
 * The Appearance drawer's own header — two strings that live in the `settings`
 * namespace (beside the other panel headers).
 *
 * Declared HERE, not read off `SETTINGS_KEYS`: the drawer's placeholder is
 * mounted on the root route, so it is in the entry chunk, and importing
 * `settings.constants.ts` for two keys dragged that module's entire key table
 * (~17 kB of source) onto the first paint of every load.
 * `appearance-dialog.constants.test.ts` pins these to the originals so the two
 * cannot drift.
 *
 * Its own file, not a second block in `appearance.constants.ts`: the i18n key
 * validator resolves ONE namespace per constants file, and that one is `common`.
 */
export const APPEARANCE_DIALOG_NS = I18N_NAMESPACES.settings;

/** The header strings — identical to `SETTINGS_KEYS.panels.appearance` (drift-tested). */
export const APPEARANCE_DIALOG_KEYS = {
  title: 'panels.appearance.title',
  description: 'panels.appearance.description',
} as const;

/**
 * The drawer's form for the record drawer's automatic width (`_patterns.md:28`):
 * the mode and the three locale cards — ten controls, the eleven-language list
 * among them (a group of more than five options) — so the everyday 680px. The
 * placeholder in the entry chunk draws the same width (`appearance-dialog-pending.tsx`,
 * pinned by its test).
 */
export const APPEARANCE_DRAWER_CONTENT: DrawerContentProfile = {
  fieldCount: 10,
  hasHeavyField: true,
};

/**
 * That width as the placeholder's class — `DRAWER_WIDTH_CLASS[680]` spelled out,
 * because the width table would ride the entry chunk for one string. Pinned to
 * the drawer's own by `appearance-dialog-pending.test.tsx`.
 */
export const APPEARANCE_PENDING_WIDTH_CLASS = 'md:w-[min(680px,calc(100vw-56px))]';

/** Test ids of the Appearance drawer the E2E specs and the inventory name. */
export const APPEARANCE_TEST_IDS = {
  drawer: 'appearance-dialog',
  close: 'appearance-close',
  pending: 'appearance-dialog-pending',
  error: 'appearance-dialog-error',
  loadError: 'appearance-dialog-load-error',
} as const;
