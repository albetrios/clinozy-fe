import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

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
  it('renders the Lucide glyph', () => {
    const { container } = render(<Boxes className="size-4" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('lucide');
  });

  it('draws Receipt as the design’s slip with text lines, not Lucide’s dollar receipt (H:3012)', () => {
    const { container } = render(<icons.Receipt className="size-4" />);
    const svgClass = container.querySelector('svg')?.getAttribute('class') ?? '';
    expect(svgClass).toContain('lucide-receipt-text');
  });

  it('draws every export', () => {
    // childElementCount, not a `svg > *` query: under jsdom that selector
    // matches only the first svg a test renders.
    const blank = Object.entries(icons).filter(
      ([, Icon]) => !render(<Icon />).container.querySelector('svg')?.childElementCount,
    );

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

describe('local brand marks follow the icon axes', () => {
  // The Icon weight / Icon colour rules in index.css target `svg.lucide`; a
  // mark without the class kept stroke 2 beside 1.5 Lucide glyphs.
  it.each([...LOCAL_MARKS, { name: 'GithubMark', Mark: icons.Github }])(
    '$name carries the lucide class and keeps a caller class',
    ({ Mark }) => {
      const { container } = render(<Mark className="size-4" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('lucide');
      expect(svg).toHaveClass('size-4');
    },
  );
});
