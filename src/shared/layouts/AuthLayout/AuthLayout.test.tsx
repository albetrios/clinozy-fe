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

  it('is the launch canvas: the logo, the controls and one 360px card', async () => {
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
    // Theme toggle and language picker sit at the header's end.
    expect(
      within(getByTestId('public-frame-controls')).getByTestId('theme-toggle'),
    ).toBeInTheDocument();
    // The form sits in the "Signed out" card (H:515): 360px, the card slot.
    const card = (await findByTestId('auth-form-container')).parentElement;
    expect(card).toHaveAttribute('data-slot', 'card');
    expect(card).toHaveClass('max-w-90', 'rounded-xl');
    expect(within(layout).getByRole('main')).toHaveAttribute('id', 'main-content');
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
