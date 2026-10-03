import { describe, expect, it } from 'vitest';

import { sectionShortcut } from './section-bar-shortcuts.ts';

const key = (
  pressed: string,
  held: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey', boolean>> = {},
) => ({
  key: pressed,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  defaultPrevented: false,
  ...held,
});

describe('sectionShortcut', () => {
  it('toggles All sections on G, either case', () => {
    expect(sectionShortcut(key('g'), 10)).toEqual({ kind: 'toggle' });
    expect(sectionShortcut(key('G'), 10)).toEqual({ kind: 'toggle' });
  });

  it('opens the 1st–9th room on 1–9 and the 10th on 0 (H:3165)', () => {
    expect(sectionShortcut(key('1'), 10)).toEqual({ kind: 'open', index: 0 });
    expect(sectionShortcut(key('9'), 10)).toEqual({ kind: 'open', index: 8 });
    expect(sectionShortcut(key('0'), 10)).toEqual({ kind: 'open', index: 9 });
  });

  it('ignores a number past the rooms the role can see', () => {
    expect(sectionShortcut(key('4'), 3)).toBeNull();
    expect(sectionShortcut(key('0'), 9)).toBeNull();
  });

  it('stands down with ⌘, Ctrl or Alt held, or once another handler took the key', () => {
    expect(sectionShortcut(key('g', { metaKey: true }), 10)).toBeNull();
    expect(sectionShortcut(key('1', { ctrlKey: true }), 10)).toBeNull();
    expect(sectionShortcut(key('g', { altKey: true }), 10)).toBeNull();
    expect(sectionShortcut({ ...key('g'), defaultPrevented: true }, 10)).toBeNull();
  });

  it('ignores every other key', () => {
    for (const pressed of ['h', '/', 'Enter', 'Escape', ' ']) {
      expect(sectionShortcut(key(pressed), 10)).toBeNull();
    }
  });
});
