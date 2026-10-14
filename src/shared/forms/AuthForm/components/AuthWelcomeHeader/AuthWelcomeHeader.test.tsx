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

  it('sets the heading at the sign-in screen’s display size, start-aligned', () => {
    render(<AuthWelcomeHeader />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Welcome back' });
    expect(heading).toHaveClass('text-2xl', 'xl:text-3xl', 'font-semibold');
    expect(heading.parentElement).not.toHaveClass('text-center');
  });

  it('keeps the address whole and left to right inside the sentence', () => {
    render(<AuthWelcomeHeader variant="emailVerify" email="user@example.com" />);
    const address = screen.getByText('user@example.com');
    expect(address).toHaveAttribute('dir', 'ltr');
    expect(address).toHaveClass('wrap-anywhere');
  });
});
