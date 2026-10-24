import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AuthLayout } from './AuthLayout.tsx';

const platformOverrides = vi.hoisted(() => ({ themeLock: false }));
// The deployment's theme lock (`VITE_THEME_LOCK`), read per render.
vi.mock('@/core/config/env.ts', async (importOriginal) => {
  const actual = await importOriginal<{ platformConfig: Record<string, unknown> }>();
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      get themeLock() {
        return platformOverrides.themeLock;
      },
    },
  };
});

const LANGUAGE = pickerTestIds('auth-locale-select');

/** Renders `ui` as the page at one sign-in path: the tour reads the path. */
function renderAt(ui: ReactElement, { at }: { at: '/login' | '/mfa' }) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const page = createRoute({
    getParentRoute: () => rootRoute,
    path: at,
    component: () => ui,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([page]),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('AuthLayout', () => {
  beforeEach(() => {
    platformOverrides.themeLock = false;
    useLocaleStore.setState({ locale: 'en', textDirection: 'auto' });
  });

  it('renders the layout shell and its children', async () => {
    const { findByTestId, getByText } = renderWithProviders(
      <AuthLayout>
        <div data-testid="child">Form content</div>
      </AuthLayout>,
    );

    expect(await findByTestId('auth-layout')).toBeInTheDocument();
    expect(await findByTestId('auth-form-container')).toBeInTheDocument();
    expect(getByText('Form content')).toBeInTheDocument();
  });

  it('is the sign-in frame: the logo, the controls, the form on the page, the footer', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    const layout = await findByTestId('auth-layout');
    expect(layout).toHaveClass('auth-layout', 'bg-background', 'min-h-dvh');
    // The logo where the clinic header draws it.
    expect(within(layout).getByRole('img', { name: PRODUCT_NAME })).toHaveAttribute(
      'data-testid',
      'brand-logo',
    );
    // Theme toggle and language picker at the header's end.
    const controls = getByTestId('public-frame-controls');
    expect(within(controls).getByTestId('theme-toggle')).toBeInTheDocument();
    expect(controls.closest('header')).toHaveClass('auth-layout-header');
    // No card: the form sits on the page, in the column's block.
    const block = (await findByTestId('auth-form-container')).parentElement;
    expect(block).toHaveClass('auth-layout-block');
    expect(block).not.toHaveAttribute('data-slot');
    expect(within(layout).getByRole('main')).toHaveAttribute('id', 'main-content');
    // "Privacy choices" and the year's line in the footer.
    const footer = getByTestId('privacy-choices').closest('footer');
    expect(footer).toHaveClass('auth-layout-footer');
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()} ${PRODUCT_NAME}`);
  });

  it('is one column below 68.75rem — the form first — and two from it, the stage held in view', () => {
    // auth-layout.css rides the lazy chunk.
    const css = readFileSync(
      join(process.cwd(), 'src/shared/layouts/AuthLayout/auth-layout.css'),
      'utf8',
    ).replaceAll(/\s+/g, ' ');
    expect(css).toContain("grid-template-areas: 'header' 'main' 'stage' 'footer';");
    const twoColumns = css.slice(css.indexOf('@media (min-width: 68.75rem)'));
    expect(twoColumns).toContain(
      'grid-template-columns: var(--auth-form-column) minmax(0, 1fr);',
    );
    expect(twoColumns).toContain(
      "grid-template-areas: 'header stage' 'main stage' 'footer stage';",
    );
    expect(twoColumns).toMatch(/\.auth-layout-stage \{ position: sticky;/);
  });

  it('reaches the form before the tour, and plays the tour only on /login', async () => {
    const { findByTestId, getByTestId } = renderAt(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
      { at: '/login' },
    );
    const form = await findByTestId('auth-form-container');
    const stage = getByTestId('auth-showcase');
    // The tab order reaches the email field before the tour's steps and pause button.
    expect(
      Boolean(form.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
    // The form keeps the page's `h1`; the stage's title is an `h2`.
    expect(within(stage).getByRole('heading', { level: 2 })).toHaveTextContent(
      'The whole clinic day, in one calm place.',
    );
    expect(within(stage).getByTestId('auth-showcase-toggle')).toBeInTheDocument();
    expect(getByTestId('auth-showcase-privacy')).toHaveTextContent(
      'Private by design. Each clinic sees only its own records.',
    );
  });

  it('shows the tour still away from /login: no pause button, nothing moves', async () => {
    const { findByTestId } = renderAt(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
      { at: '/mfa' },
    );
    const stage = await findByTestId('auth-showcase');
    expect(within(stage).queryByTestId('auth-showcase-toggle')).toBeNull();
  });

  it('on a theme-locked deployment, the header keeps the language picker and drops the theme toggle', async () => {
    platformOverrides.themeLock = true;
    const { findByTestId, getByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    expect(await findByTestId('auth-layout')).toBeInTheDocument();
    const controls = getByTestId('public-frame-controls');
    expect(await within(controls).findByTestId(LANGUAGE.trigger)).toBeInTheDocument();
    expect(within(controls).queryByTestId('theme-toggle')).not.toBeInTheDocument();
  });

  it('shows the auth language picker in multi-locale builds, and it switches the UI', async () => {
    const user = userEvent.setup();
    const { findByTestId } = renderWithProviders(
      <AuthLayout>
        <div>child</div>
      </AuthLayout>,
    );
    expect(await findByTestId('auth-layout')).toBeInTheDocument();
    // The picker loads on its own; until then an inert copy of its trigger holds the spot.
    const trigger = await findByTestId(LANGUAGE.trigger);
    expect(trigger).toHaveAccessibleName(/English/);

    await user.click(trigger);
    await user.click(await findByTestId(LANGUAGE.option('de')));
    await waitFor(() => expect(useLocaleStore.getState().locale).toBe('de'));
    await act(() => useLocaleStore.getState().setLocale('en'));
  });

  it('has no accessibility violations', async () => {
    const { container, findByTestId } = renderWithProviders(
      <AuthLayout>
        <div>child</div>
      </AuthLayout>,
    );
    await findByTestId('auth-layout');

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
