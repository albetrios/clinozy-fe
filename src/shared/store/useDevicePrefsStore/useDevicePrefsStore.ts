import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

/** Patient-file photo grid density. */
export type PhotoSize = 'small' | 'medium' | 'large';

/** A list's saved filter set — values only; free-text search is never saved. */
export interface SavedView {
  id: string;
  name: string;
  filters: Readonly<Record<string, readonly string[]>>;
}

/** The lead drawer's chat column: its drag range and its reset width (px). */
export const LEAD_CHAT_WIDTH = { min: 360, max: 680, initial: 420 } as const;

interface DevicePrefsStore {
  /** Columns the user hid, per table id. */
  hiddenColumns: Readonly<Record<string, readonly string[]>>;
  /** Saved filter views, per table id. */
  savedViews: Readonly<Record<string, readonly SavedView[]>>;
  photoSize: PhotoSize;
  leadChatWidth: number;
  setHiddenColumns: (tableId: string, columns: readonly string[]) => void;
  /** Save a view (a view with the same id is replaced). */
  saveView: (tableId: string, view: SavedView) => void;
  removeView: (tableId: string, viewId: string) => void;
  setPhotoSize: (size: PhotoSize) => void;
  /** Set the chat width, clamped to {@link LEAD_CHAT_WIDTH}. */
  setLeadChatWidth: (width: number) => void;
  resetLeadChatWidth: () => void;
}

const clampChatWidth = (width: number) =>
  Math.round(Math.min(LEAD_CHAT_WIDTH.max, Math.max(LEAD_CHAT_WIDTH.min, width)));

/**
 * Layout choices that belong to THIS DEVICE, not to the user (KICKOFF §3.3):
 * hidden columns, saved views, the photo grid size and the lead chat width.
 * Per-user preferences (pins, branch filter, recent picks) are server state —
 * `usePreferences`, never this store.
 */
export const useDevicePrefsStore = create<DevicePrefsStore>()(
  persist(
    (set) => ({
      hiddenColumns: {},
      savedViews: {},
      photoSize: 'medium',
      leadChatWidth: LEAD_CHAT_WIDTH.initial,
      setHiddenColumns: (tableId, columns) =>
        set((state) => ({
          hiddenColumns: { ...state.hiddenColumns, [tableId]: [...columns] },
        })),
      saveView: (tableId, view) =>
        set((state) => ({
          savedViews: {
            ...state.savedViews,
            [tableId]: [
              ...(state.savedViews[tableId] ?? []).filter(
                (saved) => saved.id !== view.id,
              ),
              view,
            ],
          },
        })),
      removeView: (tableId, viewId) =>
        set((state) => ({
          savedViews: {
            ...state.savedViews,
            [tableId]: (state.savedViews[tableId] ?? []).filter(
              (saved) => saved.id !== viewId,
            ),
          },
        })),
      setPhotoSize: (photoSize) => set({ photoSize }),
      setLeadChatWidth: (width) => set({ leadChatWidth: clampChatWidth(width) }),
      resetLeadChatWidth: () => set({ leadChatWidth: LEAD_CHAT_WIDTH.initial }),
    }),
    { name: `${PRODUCT_NAMESPACE}-clinic-device-prefs`, version: 1 },
  ),
);
