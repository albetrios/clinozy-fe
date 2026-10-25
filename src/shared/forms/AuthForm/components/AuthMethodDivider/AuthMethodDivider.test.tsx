import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AuthMethodDivider } from './AuthMethodDivider.tsx';

describe('AuthMethodDivider', () => {
  it('says what comes after the one-click methods', () => {
    render(<AuthMethodDivider />);
    expect(screen.getByTestId('auth-method-divider')).toBeInTheDocument();
    expect(screen.getByText('or use your email')).toBeInTheDocument();
  });

  it('sets the words in the muted caption, as written (no uppercase eyebrow)', () => {
    render(<AuthMethodDivider />);
    const words = screen.getByText('or use your email');
    expect(words).toHaveClass('text-caption', 'text-muted-foreground');
    expect(words).not.toHaveClass('uppercase');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AuthMethodDivider />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
