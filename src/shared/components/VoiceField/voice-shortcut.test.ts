import { afterEach, describe, expect, it, vi } from 'vitest';

import { isVoiceShortcut, voiceShortcutKeys } from './voice-shortcut.ts';

/** A key press with every modifier up unless named. */
function press(overrides: Partial<Parameters<typeof isVoiceShortcut>[0]>) {
  return {
    key: ' ',
    code: 'Space',
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    isComposing: false,
    ...overrides,
  };
}

describe('voiceShortcutKeys', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws ⌘ ⇧ Space on a Mac and Ctrl Shift Space elsewhere, with their aria names', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh)' });
    expect(voiceShortcutKeys()).toEqual({ label: '⌘ ⇧ Space', aria: 'Meta+Shift+Space' });
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
    expect(voiceShortcutKeys()).toEqual({
      label: 'Ctrl Shift Space',
      aria: 'Control+Shift+Space',
    });
  });
});

describe('isVoiceShortcut', () => {
  it('answers ⌘ ⇧ Space and Ctrl Shift Space', () => {
    expect(isVoiceShortcut(press({ metaKey: true, shiftKey: true }))).toBe(true);
    expect(isVoiceShortcut(press({ ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(
      isVoiceShortcut(press({ ctrlKey: true, shiftKey: true, code: '', key: ' ' })),
    ).toBe(true);
  });

  it('leaves Space alone without both modifiers, with Alt, mid-composition or once taken', () => {
    expect(isVoiceShortcut(press({ shiftKey: true }))).toBe(false);
    expect(isVoiceShortcut(press({ ctrlKey: true }))).toBe(false);
    expect(isVoiceShortcut(press({ ctrlKey: true, shiftKey: true, altKey: true }))).toBe(
      false,
    );
    expect(
      isVoiceShortcut(press({ ctrlKey: true, shiftKey: true, isComposing: true })),
    ).toBe(false);
    expect(
      isVoiceShortcut(press({ ctrlKey: true, shiftKey: true, defaultPrevented: true })),
    ).toBe(false);
    expect(
      isVoiceShortcut(
        press({ ctrlKey: true, shiftKey: true, key: 'Enter', code: 'Enter' }),
      ),
    ).toBe(false);
  });
});
