import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { APP_TITLE } from '@/lib/routes/page-head.ts';

// Link needs a router context; the page only needs an anchor here.
const routerHistory = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useRouter: () => ({ history: routerHistory }),
}));

import { Component as NotFoundPage } from './NotFoundPage.tsx';

describe('NotFoundPage', () => {
  beforeEach(() => {
    document.title = `Dashboard · ${APP_TITLE}`; // simulate a stale previous title
  });

  it('renders the 404 content with a way home', () => {
    render(<NotFoundPage />);

    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/');
  });

  it('replaces a stale document title (guard-thrown notFound path)', () => {
    render(<NotFoundPage />);

    expect(document.title).toBe(`Page not found · ${APP_TITLE}`);
  });

  it('is the public emblem on the signed-out canvas: "Error 404" in the page heading', () => {
    render(<NotFoundPage />);

    const page = screen.getByTestId('not-found-page');
    expect(page).toHaveClass('bg-canvas');
    expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    // The e2e lane finds this heading by "404" (navigation.e2e.test.ts).
    const heading = screen.getByRole('heading', { level: 1, name: /404/ });
    expect(heading).toHaveTextContent('Error 404');
    expect(heading).toHaveTextContent('We can’t find that page');
    expect(screen.getByTestId('fallback-emblem')).toHaveAttribute(
      'data-emblem',
      'missing',
    );
    expect(screen.queryByTestId('fallback-illustration')).toBeNull();
  });

  it('offers a way back when this tab has somewhere to go back to', () => {
    window.history.pushState(null, '', '/somewhere-unknown');
    render(<NotFoundPage />);
    screen.getByTestId('not-found-back').click();
    expect(routerHistory.back).toHaveBeenCalledTimes(1);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<NotFoundPage />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
