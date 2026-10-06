import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import { preloadPublicLayoutVariants, PublicLayout } from './PublicLayout.tsx';

function renderInRouter() {
  const rootRoute = createRootRoute({ component: PublicLayout });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div data-testid="child">child content</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return render(<RouterProvider router={router} />);
}

describe('PublicLayout', () => {
  // Preload lazy shells so Suspense doesn't flake under full-suite contention.
  beforeAll(async () => {
    await preloadPublicLayoutVariants();
  }, 30_000);

  beforeEach(() => {
    useThemeStore.setState({ publicVariant: 0 });
  });

  it('defaults to the launch canvas: the logo, the theme toggle, the routed child', async () => {
    renderInRouter();
    const layout = await screen.findByTestId('public-layout', {}, { timeout: 15_000 });
    expect(layout).toHaveClass('bg-canvas', 'min-h-dvh');
    expect(screen.getByTestId('child')).toHaveTextContent('child content');
    // The logo sits where the clinic header draws it, named once.
    expect(within(layout).getByRole('img', { name: PRODUCT_NAME })).toHaveAttribute(
      'data-testid',
      'brand-logo',
    );
    expect(
      within(screen.getByTestId('public-frame-controls')).getByTestId('theme-toggle'),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'public-main-content');
  });

  it('has no accessibility violations on the canvas', async () => {
    const { container } = renderInRouter();
    await screen.findByTestId('public-layout', {}, { timeout: 15_000 });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the centered preview variant (1)', async () => {
    useThemeStore.setState({ publicVariant: 1 });
    renderInRouter();
    expect(
      await screen.findByTestId('public-layout', {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('child content');
  });

  it('renders the card preview variant (2)', async () => {
    useThemeStore.setState({ publicVariant: 2 });
    renderInRouter();
    expect(
      await screen.findByTestId('public-layout', {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('child content');
  });

  it('renders the brand preview variant (3) with its header chrome', async () => {
    useThemeStore.setState({ publicVariant: 3 });
    renderInRouter();
    expect(
      await screen.findByTestId('public-layout', {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('child content');
    // Brand chrome: the header carries a link back to /login (plus the skip link).
    const loginLinks = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href') === '/login');
    expect(loginLinks).toHaveLength(1);
  });
});
