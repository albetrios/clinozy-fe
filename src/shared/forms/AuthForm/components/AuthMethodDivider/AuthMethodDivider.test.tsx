import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AuthMethodDivider } from './AuthMethodDivider.tsx';

describe('AuthMethodDivider', () => {
  it('renders the or divider', () => {
    render(<AuthMethodDivider />);
    expect(screen.getByTestId('auth-method-divider')).toBeInTheDocument();
    expect(screen.getByText('or')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AuthMethodDivider />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
