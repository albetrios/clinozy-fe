import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

/** Patient-file photo grid density. */
export type PhotoSize = 'small' | 'medium' | 'large';

/** The photo comparison's layouts: every photo in one row, or a grid of rows. */
export type PhotoCompareLayout = 'row' | 'grid';

/** How the photo comparison zooms: every photo together, or each on its own. */
export type PhotoCompareZoom = 'linked' | 'separate';

/** Where a photo stands: its zoom (1 = 100%) and its pan, a share of its panel's width and height. */
export interface PhotoFraming {
  zoom: number;
  x: number;
  y: number;
}

/** How many comparisons keep their framings; the oldest is forgotten first. */
export const PHOTO_COMPARE_MEMORY = 24;

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
  /**
   * Saved filter views, per signed-in user and table — keyed `<user id>:<table id>`
   * (`savedViewsKey` in `useSavedViews`), so the next person on this device never finds them.
   */
  savedViews: Readonly<Record<string, readonly SavedView[]>>;
  photoSize: PhotoSize;
  leadChatWidth: number;
  /** The comparison's zoom mode — Linked until the user picks Separate. */
  photoCompareZoom: PhotoCompareZoom;
  /** The layout the user picked; `null` until then (the count decides). */
  photoCompareLayout: PhotoCompareLayout | null;
  /** Each comparison's framings — keyed by its photo ids sorted, then by photo id; oldest first. */
  photoCompareFramings: Readonly<Record<string, Readonly<Record<string, PhotoFraming>>>>;
  setHiddenColumns: (tableId: string, columns: readonly string[]) => void;
  /** Save a view (a view with the same id is replaced). */
  saveView: (tableId: string, view: SavedView) => void;
  removeView: (tableId: string, viewId: string) => void;
  setPhotoSize: (size: PhotoSize) => void;
  /** Set the chat width, clamped to {@link LEAD_CHAT_WIDTH}. */
  setLeadChatWidth: (width: number) => void;
  resetLeadChatWidth: () => void;
  setPhotoCompareZoom: (zoom: PhotoCompareZoom) => void;
  setPhotoCompareLayout: (layout: PhotoCompareLayout) => void;
  /**
   * Remember where a comparison's photos stand (`key` — its photo ids sorted): a photo
   * at 100% is left out, a comparison with none is forgotten, and only the
   * {@link PHOTO_COMPARE_MEMORY} most recent are kept.
   */
  rememberPhotoCompare: (
    key: string,
    framings: Readonly<Record<string, PhotoFraming>>,
  ) => void;
}

const clampChatWidth = (width: number) =>
  Math.round(Math.min(LEAD_CHAT_WIDTH.max, Math.max(LEAD_CHAT_WIDTH.min, width)));

const roundTo = (value: number, places: number) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};

/** The comparisons' memory with `key` moved to the newest end (or dropped), the oldest trimmed. */
function rememberedComparisons(
  remembered: DevicePrefsStore['photoCompareFramings'],
  key: string,
  framings: Readonly<Record<string, PhotoFraming>>,
): DevicePrefsStore['photoCompareFramings'] {
  const moved = Object.entries(framings)
    .filter(([, framing]) => framing.zoom > 1)
    .map(([photoId, { zoom, x, y }]): [string, PhotoFraming] => [
      photoId,
      { zoom: roundTo(zoom, 2), x: roundTo(x, 4), y: roundTo(y, 4) },
    ]);
  const others = Object.entries(remembered).filter(([saved]) => saved !== key);
  const kept =
    moved.length > 0 ? [...others, [key, Object.fromEntries(moved)] as const] : others;
  return Object.fromEntries(kept.slice(-PHOTO_COMPARE_MEMORY));
}

/**
 * Version of the persisted shape. Version 2 keys saved views per user: the
 * views a version-1 store kept per table belonged to whoever saved them on this
 * device, so they are dropped rather than handed to the next person (F-9).
 */
const DEVICE_PREFS_VERSION = 2;

/**
 * Layout choices that belong to THIS DEVICE, not to the user (KICKOFF §3.3):
 * hidden columns, the photo grid size, the lead chat width and the photo
 * comparison's mode, layout and framings (change-photo-compare-zoom D8 — photo
 * ids and numbers only, never patient data). The one exception is saved views:
 * they name what one person filters by, so they are kept per signed-in user
 * on this device (`savedViewsKey`, F-9).
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
      photoCompareZoom: 'linked',
      photoCompareLayout: null,
      photoCompareFramings: {},
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
      setPhotoCompareZoom: (photoCompareZoom) => set({ photoCompareZoom }),
      setPhotoCompareLayout: (photoCompareLayout) => set({ photoCompareLayout }),
      rememberPhotoCompare: (key, framings) =>
        set((state) => ({
          photoCompareFramings: rememberedComparisons(
            state.photoCompareFramings,
            key,
            framings,
          ),
        })),
    }),
    {
      name: `${PRODUCT_NAMESPACE}-clinic-device-prefs`,
      version: DEVICE_PREFS_VERSION,
      migrate: (persisted, version) => {
        const kept = { ...(persisted as Partial<DevicePrefsStore>) };
        if (version < 2) kept.savedViews = {};
        return kept as DevicePrefsStore;
      },
    },
  ),
);
