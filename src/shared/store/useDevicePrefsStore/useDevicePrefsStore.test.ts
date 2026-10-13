import { beforeEach, describe, expect, it } from 'vitest';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

import { LEAD_CHAT_WIDTH, useDevicePrefsStore } from './useDevicePrefsStore.ts';

const KEY = `${PRODUCT_NAMESPACE}-clinic-device-prefs`;

beforeEach(() => {
  localStorage.removeItem(KEY);
  useDevicePrefsStore.setState({
    hiddenColumns: {},
    savedViews: {},
    photoSize: 'medium',
    leadChatWidth: LEAD_CHAT_WIDTH.initial,
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

  it('persists to a versioned, product-namespaced key on this device', () => {
    useDevicePrefsStore.getState().setPhotoSize('large');
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    expect(stored.version).toBe(1);
    expect(stored.state.photoSize).toBe('large');
  });
});
