import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';

import { AuthWelcomeHeader } from './AuthWelcomeHeader.tsx';

/** One screen signs in and signs up, and names the product it opens. */
const HEADING = `Sign in to ${PRODUCT_NAME}`;

describe('AuthWelcomeHeader', () => {
  it('renders the sign-in heading and its one line for a newcomer', () => {
    render(<AuthWelcomeHeader />);
    expect(screen.getByRole('heading', { level: 1, name: HEADING })).toBeInTheDocument();
    expect(
      screen.getByText('New here? The same steps create your account.'),
    ).toBeInTheDocument();
  });

  it('renders focused verify copy with the destination email', () => {
    render(<AuthWelcomeHeader variant="emailVerify" email="user@example.com" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check your email' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/6-character code we sent to/i)).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(
      screen.queryByText(/the same steps create your account/i),
    ).not.toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AuthWelcomeHeader />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('sets the heading at the sign-in screen’s display size, start-aligned', () => {
    render(<AuthWelcomeHeader />);
    const heading = screen.getByRole('heading', { level: 1, name: HEADING });
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
