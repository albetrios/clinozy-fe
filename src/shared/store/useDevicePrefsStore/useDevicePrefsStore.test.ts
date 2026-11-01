import { beforeEach, describe, expect, it } from 'vitest';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

import {
  LEAD_CHAT_WIDTH,
  PHOTO_COMPARE_MEMORY,
  useDevicePrefsStore,
} from './useDevicePrefsStore.ts';

const KEY = `${PRODUCT_NAMESPACE}-clinic-device-prefs`;

beforeEach(() => {
  localStorage.removeItem(KEY);
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
    photoCompareZoom: 'linked',
    photoCompareLayout: null,
    photoCompareFramings: {},
  });
});

describe('useDevicePrefsStore', () => {
  it('starts with the design defaults (medium photos, a 420px chat)', () => {
    const state = useDevicePrefsStore.getState();
    expect(state.photoSize).toBe('medium');
    expect(state.leadChatWidth).toBe(420);
  });

  it('keeps hidden columns per table', () => {
    useDevicePrefsStore.getState().setHiddenColumns('patients', ['email', 'age']);
    useDevicePrefsStore.getState().setHiddenColumns('payments', ['note']);
    expect(useDevicePrefsStore.getState().hiddenColumns).toEqual({
      patients: ['email', 'age'],
      payments: ['note'],
    });
  });

  it('saves a view, replaces one with the same id and removes it', () => {
    const store = useDevicePrefsStore.getState();
    store.saveView('patients', { id: 'v1', name: 'VIP', filters: { status: ['vip'] } });
    store.saveView('patients', {
      id: 'v1',
      name: 'VIP + new',
      filters: { status: ['vip', 'new'] },
    });
    expect(useDevicePrefsStore.getState().savedViews.patients).toEqual([
      { id: 'v1', name: 'VIP + new', filters: { status: ['vip', 'new'] } },
    ]);
    useDevicePrefsStore.getState().removeView('patients', 'v1');
    expect(useDevicePrefsStore.getState().savedViews.patients).toEqual([]);
  });

  it('clamps the lead chat width to 360–680 and resets to 420', () => {
    useDevicePrefsStore.getState().setLeadChatWidth(300);
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(360);
    useDevicePrefsStore.getState().setLeadChatWidth(900);
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(680);
    useDevicePrefsStore.getState().setLeadChatWidth(512.6);
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(513);
    useDevicePrefsStore.getState().resetLeadChatWidth();
    expect(useDevicePrefsStore.getState().leadChatWidth).toBe(420);
  });

  it('starts the photo comparison Linked, its layout by count, nothing remembered', () => {
    const state = useDevicePrefsStore.getState();
    expect(state.photoCompareZoom).toBe('linked');
    expect(state.photoCompareLayout).toBeNull();
    expect(state.photoCompareFramings).toEqual({});
    state.setPhotoCompareZoom('separate');
    state.setPhotoCompareLayout('grid');
    expect(useDevicePrefsStore.getState().photoCompareZoom).toBe('separate');
    expect(useDevicePrefsStore.getState().photoCompareLayout).toBe('grid');
  });

  it("remembers a comparison's zoomed photos, rounded, and leaves out a photo at 100%", () => {
    useDevicePrefsStore.getState().rememberPhotoCompare('a,b', {
      a: { zoom: 1.953_125, x: 0.123_456, y: -0.05 },
      b: { zoom: 1, x: 0, y: 0 },
    });
    expect(useDevicePrefsStore.getState().photoCompareFramings).toEqual({
      'a,b': { a: { zoom: 1.95, x: 0.1235, y: -0.05 } },
    });
    // Back at 100%: the comparison is forgotten.
    useDevicePrefsStore.getState().rememberPhotoCompare('a,b', {
      a: { zoom: 1, x: 0, y: 0 },
    });
    expect(useDevicePrefsStore.getState().photoCompareFramings).toEqual({});
  });

  it(`keeps the ${PHOTO_COMPARE_MEMORY} most recent comparisons, the oldest forgotten first`, () => {
    const zoomed = { p: { zoom: 2, x: 0, y: 0 } };
    const store = useDevicePrefsStore.getState();
    for (let index = 0; index <= PHOTO_COMPARE_MEMORY; index += 1) {
      store.rememberPhotoCompare(`set-${index}`, zoomed);
    }
    // Saving the oldest kept one again makes it the newest.
    store.rememberPhotoCompare('set-1', zoomed);
    store.rememberPhotoCompare('set-new', zoomed);
    const keys = Object.keys(useDevicePrefsStore.getState().photoCompareFramings);
    expect(keys).toHaveLength(PHOTO_COMPARE_MEMORY);
    expect(keys).not.toContain('set-0');
    expect(keys).not.toContain('set-2');
    expect(keys.slice(-2)).toEqual(['set-1', 'set-new']);
  });

  it('persists to a versioned, product-namespaced key on this device', () => {
    useDevicePrefsStore.getState().setPhotoSize('large');
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(stored.version).toBe(2);
    expect(stored.state.photoSize).toBe('large');
  });

  // F-9: version 1 kept saved views per device — whoever saved them, the next person found them.
  it('drops the views a device-wide store kept, keeping the device’s layout choices', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 1,
        state: {
          photoSize: 'large',
          savedViews: {
            patients: [{ id: 'v1', name: 'VIP', filters: { status: ['vip'] } }],
          },
        },
      }),
    );

    await useDevicePrefsStore.persist.rehydrate();

    expect(useDevicePrefsStore.getState().savedViews).toEqual({});
    expect(useDevicePrefsStore.getState().photoSize).toBe('large');
  });
});
