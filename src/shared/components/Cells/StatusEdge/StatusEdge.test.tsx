import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusEdge } from './StatusEdge.tsx';

const edge = (container: HTMLElement) =>
  container.querySelector('[data-slot="status-edge"]');

describe('StatusEdge', () => {
  it('paints the 3px inline-start edge in the tone ink', () => {
    const { container } = render(<StatusEdge tone="sky" />);
    expect(edge(container)).toHaveClass(
      'absolute',
      'start-0',
      'w-[3px]',
      'text-tone-sky-foreground',
      'bg-current',
    );
    expect(edge(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('greys a closed row', () => {
    const { container } = render(<StatusEdge tone="neutral" />);
    expect(edge(container)).toHaveClass('bg-border');
  });

  it('stays transparent unless the screen tones the row', () => {
    expect(edge(render(<StatusEdge />).container)).toBeNull();
    expect(edge(render(<StatusEdge tone={null} />).container)).toBeNull();
  });
});
