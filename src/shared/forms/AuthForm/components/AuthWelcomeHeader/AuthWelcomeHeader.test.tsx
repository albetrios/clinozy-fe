import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AuthWelcomeHeader } from './AuthWelcomeHeader.tsx';

describe('AuthWelcomeHeader', () => {
  it('renders the welcome heading and subheading', () => {
    render(<AuthWelcomeHeader />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one account for sign-in and sign-up/i)).toBeInTheDocument();
  });

  it('renders focused verify copy with the destination email', () => {
    render(<AuthWelcomeHeader variant="emailVerify" email="user@example.com" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/verification code to/i)).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(
      screen.queryByText(/one account for sign-in and sign-up/i),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AuthWelcomeHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
