import { vi } from 'vitest';

import { apiClient } from '@/core/http/fetch-client.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

import { isClinicWrite, startViewAsWriteHold, useUIStore } from './useUIStore.ts';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      commandPaletteOpen: false,
      shortcutsOpen: false,
    });
  });

  it('initial state: every overlay closed', () => {
    const initial = useUIStore.getInitialState();
    expect(initial.commandPaletteOpen).toBe(false);
    expect(initial.shortcutsOpen).toBe(false);
    expect(initial.appearanceOpen).toBe(false);
  });

  it('does not consult the viewport for its initial state', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia');
    useUIStore.getInitialState();
    expect(matchMedia).not.toHaveBeenCalled();
    matchMedia.mockRestore();
  });

  it('toggleCommandPalette toggles commandPaletteOpen', () => {
    const { toggleCommandPalette } = useUIStore.getState();
    toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('setCommandPaletteOpen sets exact value', () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().setCommandPaletteOpen(false);
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('appearance dialog: defaults closed, toggles + sets', () => {
    expect(useUIStore.getState().appearanceOpen).toBe(false);
    useUIStore.getState().toggleAppearance();
    expect(useUIStore.getState().appearanceOpen).toBe(true);
    useUIStore.getState().setAppearanceOpen(false);
    expect(useUIStore.getState().appearanceOpen).toBe(false);
  });

  it('shortcuts dialog: defaults closed, toggles + sets', () => {
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
    useUIStore.getState().toggleShortcuts();
    expect(useUIStore.getState().shortcutsOpen).toBe(true);
    useUIStore.getState().setShortcutsOpen(false);
    expect(useUIStore.getState().shortcutsOpen).toBe(false);
  });
});

describe('useUIStore — clinic session state', () => {
  it('View-as and the file Activity state start unset and are settable', () => {
    expect(useUIStore.getState().previewRole).toBeNull();
    expect(useUIStore.getState().fileActivityOpen).toBeNull();
    useUIStore.getState().setPreviewRole('pharmacist');
    useUIStore.getState().setFileActivityOpen(false);
    expect(useUIStore.getState().previewRole).toBe('pharmacist');
    expect(useUIStore.getState().fileActivityOpen).toBe(false);
    useUIStore.getState().setPreviewRole(null);
    useUIStore.getState().setFileActivityOpen(null);
    expect(useUIStore.getState().previewRole).toBeNull();
  });
});

describe('useUIStore — critical update', () => {
  afterEach(() => {
    useUIStore.setState({ criticalUpdate: null });
  });

  it('starts with no critical update counting down', () => {
    expect(useUIStore.getInitialState().criticalUpdate).toBeNull();
  });

  it('holds the critical update the notice counts down to', () => {
    const reloadNow = vi.fn();
    useUIStore
      .getState()
      .setCriticalUpdate({ buildId: 'build-NEW', reloadAt: 60_000, reloadNow });
    expect(useUIStore.getState().criticalUpdate).toEqual({
      buildId: 'build-NEW',
      reloadAt: 60_000,
      reloadNow,
    });
  });
});

describe("useUIStore — View-as holds the clinic's writes", () => {
  let stop: () => void;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    stop = startViewAsWriteHold();
    fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    stop();
    vi.unstubAllGlobals();
    useUIStore.setState({ previewRole: null });
  });

  it.each([
    '/api/v1/app/appointments',
    '/api/v1/app/patients/pat_1/images',
    '/api/v1/tenancy/organization',
    '/api/v1/tenancy/organization/roles/rol_1',
    '/api/v1/uploads',
    '/api/v1/billing/subscriptions',
    '/api/v1/notify/webhooks/wh_1',
    '/app/leads?x=1',
  ])('holds a write to the clinic: %s', (path) => {
    expect(isClinicWrite(path)).toBe(true);
  });

  it.each([
    '/api/v1/app/invoices/preview',
    '/api/v1/app/invoices/invc_1/preview',
    '/api/v1/app/memberships/me/preferences',
    '/api/v1/auth/switch-to-organization',
    '/api/v1/auth/me/sessions/ses_1',
    '/api/v1/users/me/settings',
    '/api/v1/notify/notifications/mark-all-read',
    '/api/v1/tenancy/organizations',
    '/api/v1/tenancy/membership-invitations/inv_1/decline',
  ])("lets the member's own or figures-only write through: %s", (path) => {
    expect(isClinicWrite(path)).toBe(false);
  });

  it('refuses a clinic write while previewing, before it leaves, in our own words', async () => {
    useUIStore.getState().setPreviewRole('rol_front_desk');

    const refusal = await apiClient
      .post('/api/v1/app/appointments', { a: 1 })
      .catch((error: unknown) => error);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refusal).toBeInstanceOf(HttpError);
    expect((refusal as HttpError).status).toBe(403);
    expect(mapApiError(refusal)).toBe(
      'Previews are read-only, so nothing was saved. Exit preview to make changes.',
    );
  });

  it("sends the same write once the preview ends, and the member's own writes during it", async () => {
    useUIStore.getState().setPreviewRole('rol_front_desk');
    await apiClient.patch('/api/v1/users/me/settings', { a: 1 });
    await apiClient.post('/api/v1/app/invoices/preview', { a: 1 });
    useUIStore.getState().setPreviewRole(null);
    await apiClient.post('/api/v1/app/appointments', { a: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
