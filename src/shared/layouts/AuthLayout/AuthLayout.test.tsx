import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('is the signed-out canvas: the logo, the controls, and the form in a 360px card that docks from xl', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    const layout = await findByTestId('auth-layout');
    expect(layout).toHaveClass('bg-canvas', 'min-h-dvh');
    // The logo where the clinic header draws it.
    expect(within(layout).getByRole('img', { name: PRODUCT_NAME })).toHaveAttribute(
      'data-testid',
      'brand-logo',
    );
    // Theme toggle and language picker sit at the header's end — from xl, at
    // the top of the form's panel.
    const controls = getByTestId('public-frame-controls');
    expect(within(controls).getByTestId('theme-toggle')).toBeInTheDocument();
    expect(controls).toHaveClass('auth-layout-controls');
    // The form sits in a 360px card below xl; from xl the panel is its surface
    // (`auth-layout-card` drops the card's own chrome there).
    const card = (await findByTestId('auth-form-container')).parentElement;
    expect(card).toHaveAttribute('data-slot', 'surface');
    expect(card).toHaveClass('auth-layout-card', 'max-w-90', 'rounded-2xl');
    expect(within(layout).getByRole('main')).toHaveAttribute('id', 'main-content');
    // "Privacy choices" stays in the footer, under the panel from xl.
    expect(getByTestId('privacy-choices').closest('footer')).toHaveClass(
      'auth-layout-footer',
    );
  });

  it('docks the form in a full-height panel from xl only', () => {
    // auth-layout.css rides the lazy chunk: the panel and the split grid exist
    // only from xl (80rem), and the card drops its chrome there.
    const css = readFileSync(
      join(process.cwd(), 'src/shared/layouts/AuthLayout/auth-layout.css'),
      'utf8',
    );
    expect(css).toMatch(/^\.auth-layout-panel \{\s*display: none;/m);
    const fromXl = css.slice(css.indexOf('@media (min-width: 80rem)'));
    expect(fromXl).toMatch(/\.auth-layout-panel \{\s*display: block;/);
    expect(fromXl).toMatch(
      /grid-template-columns: minmax\(0, 1fr\) auto var\(--auth-panel\);/,
    );
    expect(fromXl).toMatch(/\.auth-layout-card \{[^}]*box-shadow: none;/);
  });

  it('frames the card with the showcase, in the order hero → card → dial → values', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );
    const card = (await findByTestId('auth-form-container')).parentElement;
    const hero = getByTestId('auth-showcase-hero');
    const board = getByTestId('auth-showcase');
    const values = getByTestId('auth-showcase-values');
    const follows = (first: Node, second: Node) =>
      Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    // The tab order reaches the email field before anything in the showcase.
    expect(card && follows(hero, card)).toBe(true);
    expect(card && follows(card, board)).toBe(true);
    expect(follows(board, values)).toBe(true);
    // The card stays the page's `h1`; the hero's headline is an `h2`.
    expect(within(hero).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Your whole clinic, calm in one place.',
    );
    expect(getByTestId('auth-showcase-privacy')).toHaveTextContent(
      'Private by design — each clinic sees only its own records.',
    );
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
