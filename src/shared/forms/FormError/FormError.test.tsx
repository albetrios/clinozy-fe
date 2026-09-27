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
});
