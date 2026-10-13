import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';

import { FormError } from './FormError.tsx';

describe('FormError', () => {
  it('returns null when message is null/undefined', () => {
    const { container } = render(<FormError message={null} />);
    expect(container.firstChild).toBeNull();

    const { container: container2 } = render(<FormError />);
    expect(container2.firstChild).toBeNull();
  });

  it('renders error message', () => {
    render(<FormError message="Invalid credentials" />);
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    render(<FormError message="API error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<FormError message="Something went wrong" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("is the design's danger soft line — flat, never a lifted card", () => {
    render(<FormError message="Invalid code" data-testid="banner" />);
    const banner = screen.getByTestId('banner');
    expect(banner).toHaveClass(
      'bg-destructive-tint',
      'text-destructive',
      'border-destructive-border',
      'rounded-lg',
      'text-body',
    );
    expect(banner).not.toHaveAttribute('data-slot');
  });

  it('carries an inline action after the message', () => {
    render(
      <FormError message="Couldn’t save" action={<button type="button">Retry</button>} />,
    );
    expect(screen.getByRole('alert')).toContainElement(
      screen.getByRole('button', { name: 'Retry' }),
    );
  });
});
