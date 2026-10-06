import { create } from 'zustand';

import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';

interface UIStore {
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;
  /** The Appearance drawer (opened from the Account menu's "Appearance & language" row). */
  appearanceOpen: boolean;
  /**
   * View-as (Users › Roles & access): the role whose access the clinic screens
   * preview, narrowing `useClinicAccess` — a contract role, or a custom role's
   * clinozy-be id. Session-only — never persisted.
   */
  previewRole: ClinicRoleKey | null;
  /**
   * The patient file's last Activity-column state, for a link that does not
   * say; `null` = the file's own default for the viewport.
   */
  fileActivityOpen: boolean | null;

  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
  setAppearanceOpen: (open: boolean) => void;
  toggleAppearance: () => void;
  setPreviewRole: (role: ClinicRoleKey | null) => void;
  setFileActivityOpen: (open: boolean | null) => void;
}

/** Ephemeral, per-tab UI state: which overlays are open. */
export const useUIStore = create<UIStore>((set) => ({
  commandPaletteOpen: false,
  shortcutsOpen: false,
  appearanceOpen: false,
  previewRole: null,
  fileActivityOpen: null,

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
}));
