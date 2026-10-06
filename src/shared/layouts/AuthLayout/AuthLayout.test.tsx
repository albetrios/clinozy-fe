import { act, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { pickerTestIds } from '@/shared/components/Picker/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AuthLayout, preloadAuthLayoutVariants } from './AuthLayout.tsx';

const LANGUAGE = pickerTestIds('auth-locale-select');

/** The earlier previews, behind the launch's canvas (variant 0). */
const SPLIT = 1;
const SPOTLIGHT = 2;
const MINIMAL = 3;

describe('AuthLayout', () => {
  // Preload lazy shells so Suspense doesn't flake under full-suite contention.
  beforeAll(async () => {
    await preloadAuthLayoutVariants();
  });

  beforeEach(() => {
    // Default to the launch canvas; the earlier previews are opt-in below.
    useThemeStore.setState({ authVariant: 0 });
    useLocaleStore.setState({ locale: 'en', textDirection: 'auto' });
  });

  it('renders the layout shell and its children', async () => {
    const { findByTestId, getByText } = renderWithProviders(
      <AuthLayout>
        <div data-testid="child">Form content</div>
      </AuthLayout>,
    );

    expect(
      await findByTestId('auth-layout', {}, { timeout: 15_000 }),
    ).toBeInTheDocument();
    expect(await findByTestId('auth-form-container')).toBeInTheDocument();
    expect(getByText('Form content')).toBeInTheDocument();
  });

  it('defaults to the launch canvas: the logo, the controls and one 360px card', async () => {
    const { findByTestId, getByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    const layout = await findByTestId('auth-layout');
    expect(layout).toHaveClass('bg-canvas', 'min-h-dvh');
    // The logo where the clinic header draws it — the marketing hero is gone.
    expect(within(layout).getByRole('img', { name: PRODUCT_NAME })).toHaveAttribute(
      'data-testid',
      'brand-logo',
    );
    expect(
      within(layout).queryByText('The operating system for your organization.'),
    ).toBeNull();
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

  it('shows the brand value props on the split preview', async () => {
    useThemeStore.setState({ authVariant: SPLIT });
    const { findByText } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    expect(
      await findByText('The operating system for your organization.'),
    ).toBeInTheDocument();
    expect(await findByText('All systems operational')).toBeInTheDocument();
  });

  it('keeps the split hero growing on big monitors (3xl / 4xl)', async () => {
    // Without the tier the hero stayed a 28rem column pinned to the corner of a
    // 1400px panel on a 2560px monitor.
    useThemeStore.setState({ authVariant: SPLIT });
    const { findByText, findByTestId } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    const headline = await findByText('The operating system for your organization.');
    expect(headline).toHaveClass('xl:text-5xl', '3xl:text-6xl', '4xl:text-7xl');
    expect(headline.closest('.max-w-md')).toHaveClass('3xl:max-w-xl', '4xl:max-w-2xl');
    // The form column widens with it — a 420px form looks lost beside a 7xl hero.
    expect((await findByTestId('auth-form-container')).parentElement).toHaveClass(
      'max-w-[420px]',
      '3xl:max-w-[480px]',
    );
  });

  it('tags the status chip as a pill, so the Sharp shape squares it', async () => {
    useThemeStore.setState({ authVariant: SPLIT });
    const { findByText } = renderWithProviders(
      <AuthLayout>
        <span>child</span>
      </AuthLayout>,
    );

    const chip = (await findByText('All systems operational')).closest('[data-slot]');
    expect(chip).toHaveAttribute('data-slot', 'pill');
    expect(chip).toHaveClass('rounded-full');
  });

  it('renders the spotlight preview variant', async () => {
    useThemeStore.setState({ authVariant: SPOTLIGHT });
    const { findByTestId } = renderWithProviders(
      <AuthLayout>
        <div>child</div>
      </AuthLayout>,
    );
    expect(await findByTestId('auth-layout')).toBeInTheDocument();
    expect(await findByTestId('auth-form-container')).toBeInTheDocument();
  });

  it('renders the minimal preview variant', async () => {
    useThemeStore.setState({ authVariant: MINIMAL });
    const { findByTestId } = renderWithProviders(
      <AuthLayout>
        <div>child</div>
      </AuthLayout>,
    );
    expect(await findByTestId('auth-layout')).toBeInTheDocument();
    expect(await findByTestId('auth-form-container')).toBeInTheDocument();
  });

  it('falls back to the canvas for an index with no variant', async () => {
    useThemeStore.setState({ authVariant: 42 });
    const { findByTestId } = renderWithProviders(
      <AuthLayout>
        <div>child</div>
      </AuthLayout>,
    );
    expect(await findByTestId('auth-layout')).toHaveClass('bg-canvas');
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
