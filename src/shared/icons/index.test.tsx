import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import { loadIconSet } from './icon-registry.ts';
import * as icons from './index.ts';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  InstagramMark,
  PanelRightClose,
  PanelRightOpen,
  Star,
  WhatsAppMark,
  X,
} from './index.ts';

afterEach(() => {
  useThemeStore.setState({ iconLibrary: 'lucide' });
  useAuthStore.setState({ isAuthenticated: false, isLoading: false });
});

/** The local brand marks — lucide-react ships no brand icons. */
const LOCAL_MARKS = [
  { name: 'WhatsAppMark', Mark: WhatsAppMark },
  { name: 'InstagramMark', Mark: InstagramMark },
];

/**
 * Glyphs that point along the reading direction. The registry does not mirror
 * them itself: the call site adds `rtl:-scale-x-100` (KICKOFF §3.4), so the
 * class must reach the svg.
 */
const DIRECTIONAL = [
  { name: 'ChevronLeft', Icon: ChevronLeft },
  { name: 'ChevronRight', Icon: ChevronRight },
  { name: 'PanelRightOpen', Icon: PanelRightOpen },
  { name: 'PanelRightClose', Icon: PanelRightClose },
];

describe('icon barrel', () => {
  it('renders the Lucide icon by default', () => {
    const { container } = render(<Boxes className="size-4" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('lucide');
  });

  it('swaps to the selected library once its lazy chunk loads', async () => {
    useAuthStore.setState({ isAuthenticated: true, isLoading: false });
    const { container } = render(<Boxes className="size-4" />);
    useThemeStore.getState().setIconLibrary('tabler');
    loadIconSet('tabler');
    await waitFor(
      () => {
        expect(container.querySelector('svg')?.getAttribute('class')).toContain(
          'tabler-icon',
        );
      },
      { timeout: 12_000 },
    );
  });

  it('registers every export under its own name and draws it by default', () => {
    const exports = Object.entries(icons);
    // The alt sets are looked up by this name — a mismatch swaps in another glyph.
    const misnamed = exports.filter(([name, Icon]) => Icon.displayName !== name);
    // childElementCount, not a `svg > *` query: under jsdom that selector
    // matches only the first svg a test renders.
    const blank = exports.filter(
      ([, Icon]) => !render(<Icon />).container.querySelector('svg')?.childElementCount,
    );

    expect(misnamed.map(([name]) => name)).toEqual([]);
    expect(blank.map(([name]) => name)).toEqual([]);
  });

  it.each([
    { name: 'Star', Icon: Star },
    { name: 'X', Icon: X },
  ])('draws $name, a key the prototype registry was missing', ({ Icon }) => {
    const { container } = render(<Icon className="size-3" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('lucide', 'size-3');
    expect(svg?.childElementCount).toBeGreaterThan(0);
  });

  it.each(LOCAL_MARKS)(
    'draws $name in currentColor, decorative by default',
    ({ Mark }) => {
      const { container } = render(<Mark className="size-4" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
      expect(svg).toHaveClass('size-4');
    },
  );

  it.each(LOCAL_MARKS)('lets a caller name $name (its props win)', ({ Mark }) => {
    render(<Mark role="img" aria-hidden={false} aria-label="Channel" />);
    expect(screen.getByRole('img', { name: 'Channel' })).toBeInTheDocument();
  });

  it.each(LOCAL_MARKS)('has no axe violations for $name', async ({ Mark }) => {
    const { container } = render(<Mark />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(DIRECTIONAL)(
    'carries the call-site RTL mirror onto the $name svg',
    ({ Icon }) => {
      const { container } = render(<Icon className="rtl:-scale-x-100" />);
      expect(container.querySelector('svg')).toHaveClass('rtl:-scale-x-100');
    },
  );
});
