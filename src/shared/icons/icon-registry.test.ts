import { render, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import type { IconName } from './icon-names.ts';
import { initDeferredIconSets, loadIconSet, useIconSet } from './icon-registry.ts';
import type { AppIcon } from './icon-types.ts';
import * as icons from './index.ts';

const TABLER_STUB = { Boxes: (() => null) as never };
const PHOSPHOR_STUB = { Boxes: (() => null) as never };

vi.mock('./iconset-tabler.ts', () => ({ iconSet: TABLER_STUB }));
vi.mock('./iconset-phosphor.ts', () => ({ iconSet: PHOSPHOR_STUB }));
vi.mock('@/lib/app-splash.ts', () => ({
  afterPaint: (cb: () => void) => cb(),
}));

/**
 * The clinic launch's additions (KICKOFF §3.4, L-08): 39 Lucide exports and the
 * two local brand marks. `satisfies` makes each one a compile-time canonical name.
 */
const LAUNCH_ICONS = [
  'ArrowDownLeft',
  'ArrowUpRight',
  'ArrowUpDown',
  'Calendar',
  'Camera',
  'ChevronDown',
  'ClipboardList',
  'Clock',
  'Compass',
  'FileIcon',
  'FolderOpen',
  'House',
  'ImageIcon',
  'Info',
  'LayoutGrid',
  'LinkIcon',
  'ListFilter',
  'Lock',
  'MapPin',
  'Maximize',
  'Minimize',
  'MessageSquare',
  'Package',
  'PanelRightOpen',
  'PanelRightClose',
  'Pause',
  'Play',
  'PenLine',
  'Phone',
  'Pill',
  'Printer',
  'Receipt',
  'RefreshCw',
  'Send',
  'SquareCheck',
  'Star',
  'Stethoscope',
  'Tag',
  'Wallet',
  'WhatsAppMark',
  'InstagramMark',
] as const satisfies readonly IconName[];

type IconSetModule = { iconSet: Record<IconName, AppIcon> };

/** The real lazy sets — this file stubs both modules for the loader tests. */
async function realIconSets() {
  const [tabler, phosphor] = await Promise.all([
    vi.importActual<IconSetModule>('./iconset-tabler.ts'),
    vi.importActual<IconSetModule>('./iconset-phosphor.ts'),
  ]);
  return { tabler: tabler.iconSet, phosphor: phosphor.iconSet };
}

/** Whether an icon renders an svg with something drawn in it (not an empty box). */
function drawsGlyph(Icon: AppIcon): boolean {
  const svg = render(createElement(Icon)).container.querySelector('svg');
  // childElementCount, not a `svg > *` query: under jsdom that selector
  // matches only the first svg a test renders.
  return (svg?.childElementCount ?? 0) > 0;
}

describe('icon-registry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({ isAuthenticated: false, isLoading: false });
    useThemeStore.setState({ iconLibrary: 'lucide' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('useIconSet returns null for lucide (the always-loaded default)', () => {
    const { result } = renderHook(() => useIconSet('lucide'));
    expect(result.current).toBeNull();
  });

  it('loadIconSet ignores lucide and unknown libraries', () => {
    loadIconSet('lucide');
    loadIconSet('does-not-exist');

    const { result } = renderHook(() => useIconSet('does-not-exist'));
    expect(result.current).toBeNull();
  });

  it('loading tabler resolves the lazy set and notifies subscribed hooks', async () => {
    vi.useRealTimers(); // dynamic import resolution needs real microtasks
    const { result } = renderHook(() => useIconSet('tabler'));
    expect(result.current).toBeNull();

    loadIconSet('tabler');

    await waitFor(() => expect(result.current).toBe(TABLER_STUB));
    // Second call is a cache no-op — the set identity is stable.
    loadIconSet('tabler');
    expect(result.current).toBe(TABLER_STUB);
  });

  it('initDeferredIconSets loads the alt set once the session becomes authenticated', async () => {
    useThemeStore.setState({ iconLibrary: 'phosphor' });
    initDeferredIconSets();

    const { result } = renderHook(() => useIconSet('phosphor'));
    expect(result.current).toBeNull();

    // Sign-in transition → afterPaint (sync mock) → setTimeout fallback (no rIC in jsdom).
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    vi.advanceTimersByTime(2000);

    vi.useRealTimers();
    await waitFor(() => expect(result.current).toBe(PHOSPHOR_STUB));
  });

  it('switching the icon library while signed in loads the new set immediately', async () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    initDeferredIconSets();
    vi.useRealTimers();

    useThemeStore.setState({ iconLibrary: 'tabler' });

    const { result } = renderHook(() => useIconSet('tabler'));
    await waitFor(() => expect(result.current).toBe(TABLER_STUB));
  });
});

describe('lazy icon sets', () => {
  it('key Tabler and Phosphor by exactly the barrel names, launch additions included', async () => {
    const { tabler, phosphor } = await realIconSets();
    const names = Object.keys(icons).sort();

    expect(Object.keys(tabler).sort()).toEqual(names);
    expect(Object.keys(phosphor).sort()).toEqual(names);
    expect(names).toEqual(expect.arrayContaining([...LAUNCH_ICONS]));
  });

  it('resolve every name to a drawn glyph in both sets', async () => {
    const sets = await realIconSets();

    const blank = Object.entries(sets).flatMap(([library, set]) =>
      Object.entries(set)
        .filter(([, Icon]) => !drawsGlyph(Icon))
        .map(([name]) => `${library}:${name}`),
    );

    expect(blank).toEqual([]);
  });
});
