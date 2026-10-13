import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { CountBadge } from './CountBadge.tsx';

describe('CountBadge', () => {
  it('shows the count as an 18px pill the Sharp shape can square', () => {
    render(<CountBadge count={3} data-testid="badge" />);
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent(/^3$/);
    expect(badge).toHaveAttribute('data-slot', 'pill');
    expect(badge).toHaveClass('h-4.5', 'min-w-4.5', 'rounded-full', 'tabular-nums');
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('caps a large count at "<max>+"', () => {
    const { rerender } = render(<CountBadge count={120} data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('99+');
    rerender(<CountBadge count={12} max={9} data-testid="badge" />);
    expect(screen.getByTestId('badge')).toHaveTextContent('9+');
  });

  it('paints the success and inverse tones', () => {
    render(
      <>
        <CountBadge count={2} tone="success" data-testid="success" />
        <CountBadge count={2} tone="inverse" data-testid="inverse" />
      </>,
    );
    expect(screen.getByTestId('success')).toHaveClass('bg-success');
    expect(screen.getByTestId('inverse')).toHaveClass('bg-foreground', 'text-background');
  });

  it('reads its own words when given them, and an sr label in place of the figure', () => {
    render(
      <>
        <CountBadge count={2} data-testid="words">
          2 new
        </CountBadge>
        <button type="button">
          Activity <CountBadge count={4} srLabel="4 unread" />
        </button>
      </>,
    );
    expect(screen.getByTestId('words')).toHaveTextContent('2 new');
    expect(screen.getByRole('button')).toHaveAccessibleName('Activity 4 unread');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CountBadge count={5} srLabel="5 filters applied" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
