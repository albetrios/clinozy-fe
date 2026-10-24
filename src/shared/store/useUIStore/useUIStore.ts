import { create } from 'zustand';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { setWriteHold } from '@/core/http/fetch-client.ts';
import type { CriticalUpdateContext } from '@/core/version/check.ts';
import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { FRONTEND_ERROR_CODES } from '@/shared/errors/frontend-error-codes.ts';

/** A critical update counting down in this tab — what the "Update required" notice shows. */
export type CriticalUpdate = Pick<
  CriticalUpdateContext,
  'buildId' | 'reloadAt' | 'reloadNow'
>;

interface UIStore {
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  /** The Appearance drawer (opened from the Account menu's "Appearance & language" row). */
  appearanceOpen: boolean;
  /**
   * View-as (Users › Roles & access): the role (`rol_…`) whose permission codes the clinic
   * screens preview in place of the member's own (`useAppAccess`). Session-only — never
   * persisted.
   */
  previewRole: string | null;
  /**
   * The patient file's last Activity-column state, for a link that does not
   * say; `null` = the file's own default for the viewport.
   */
  fileActivityOpen: boolean | null;
  /**
   * The critical update this tab is counting down to (`startVersionCheck`'s
   * `onCriticalUpdate`); `null` while none is. Never cleared: the tab reloads.
   */
  criticalUpdate: CriticalUpdate | null;

  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setAppearanceOpen: (open: boolean) => void;
  toggleAppearance: () => void;
  setPreviewRole: (roleId: string | null) => void;
  setFileActivityOpen: (open: boolean | null) => void;
  setCriticalUpdate: (update: CriticalUpdate) => void;
}

/** Ephemeral, per-tab UI state: which overlays are open. */
export const useUIStore = create<UIStore>((set) => ({
  commandPaletteOpen: false,
  shortcutsOpen: false,
  appearanceOpen: false,
  previewRole: null,
  fileActivityOpen: null,
  criticalUpdate: null,

  toggleCommandPalette: () =>
    set((s) => {
      const next = !s.commandPaletteOpen;
      if (next) captureAnalyticsEvent(ANALYTICS_EVENTS.commandPaletteOpened);
      return { commandPaletteOpen: next };
    }),
  setCommandPaletteOpen: (commandPaletteOpen) => {
    if (commandPaletteOpen) captureAnalyticsEvent(ANALYTICS_EVENTS.commandPaletteOpened);
    set({ commandPaletteOpen });
  },
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
  setAppearanceOpen: (appearanceOpen) => {
    if (appearanceOpen) captureAnalyticsEvent(ANALYTICS_EVENTS.appearanceDialogOpened);
    set({ appearanceOpen });
  },
  toggleAppearance: () =>
    set((s) => {
      const next = !s.appearanceOpen;
      if (next) captureAnalyticsEvent(ANALYTICS_EVENTS.appearanceDialogOpened);
      return { appearanceOpen: next };
    }),
  setPreviewRole: (previewRole) => set({ previewRole }),
  setFileActivityOpen: (fileActivityOpen) => set({ fileActivityOpen }),
  setCriticalUpdate: (criticalUpdate) => set({ criticalUpdate }),
}));

/** The clinic's own writes: its records, settings, members and roles, uploads, plan and webhooks. */
const CLINIC_WRITE =
  /^\/(?:app|tenancy\/organization|uploads|billing|notify\/webhooks)(?:[/?]|$)/;
/** A write that only works out figures and keeps nothing (the invoice drawer's totals). */
const FIGURES_ONLY = /^\/app\/invoices\/(?:preview|[^/?]+\/preview)(?:\?|$)/;

/** Whether a write path is the clinic's own, View-as holds it (`/api/v1` or not). */
export function isClinicWrite(path: string): boolean {
  const local = path.startsWith(API_BASE_PATH) ? path.slice(API_BASE_PATH.length) : path;
  return CLINIC_WRITE.test(local) && !FIGURES_ONLY.test(local);
}

/**
 * Hold the clinic's writes while View-as previews a role, once, from `main.tsx`: the preview
 * shows what the role sees, but a save would still go out as the signed-in member, with their
 * permissions and branches. Each held write is refused before it leaves, as a `403`
 * {@link FRONTEND_ERROR_CODES.VIEW_AS_READ_ONLY} ("Previews are read-only …"), so a drawer reads
 * it as a refusal and keeps nothing. The member's own account (sign-in, settings,
 * notifications) still writes.
 *
 * @returns A stop function (tests).
 */
export function startViewAsWriteHold(): () => void {
  return setWriteHold(({ path }) =>
    useUIStore.getState().previewRole !== null && isClinicWrite(path)
      ? FRONTEND_ERROR_CODES.VIEW_AS_READ_ONLY
      : null,
  );
}
