import { vi } from 'vitest';

import { useUIStore } from './useUIStore.ts';

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
