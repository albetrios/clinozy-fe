import { onceAsync } from '@/lib/lazy-module.ts';

/**
 * The Appearance drawer's chunk — the drawer, the record drawer under it and the
 * panel — shared by the idle prefetch and the open drawer, so a reopen finds it
 * settled and paints no placeholder.
 */
export const loadAppearanceDialog = onceAsync(() =>
  import('./AppearanceDialog.tsx').then((m) => ({ default: m.AppearanceDialog })),
);
