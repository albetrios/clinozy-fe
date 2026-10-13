import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  REJECT_ALL_CONSENT_PREFERENCES,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import {
  resetConsentForTests,
  setGlobalPrivacyControlForTests,
} from '@/tests/utils/consent-cookie.ts';

import { ConsentBannerLazy } from './ConsentBannerLazy.tsx';

const env = vi.hoisted(() => ({ privacyPolicyUrl: undefined as string | undefined }));
vi.mock('@/core/config/env.ts', () => ({ platformConfig: env }));

const reportError = vi.hoisted(() => vi.fn());
vi.mock('@/shared/errors/errorHandler.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  reportError,
}));

describe('ConsentBannerLazy', () => {
  beforeEach(() => {
    setGlobalPrivacyControlForTests(false);
    resetConsentForTests();
  });

  afterEach(() => {
    setGlobalPrivacyControlForTests(false);
    vi.doUnmock('./ConsentBanner.tsx');
    vi.resetAllMocks();
  });

  it('loads and shows the card for a browser with no answer', async () => {
    render(<ConsentBannerLazy />);

    expect(await screen.findByTestId('consent-banner')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Cookie settings' })).toBeVisible();
  });

  it.each([
    ['accepted', ACCEPT_ALL_CONSENT_PREFERENCES],
    ['rejected', REJECT_ALL_CONSENT_PREFERENCES],
  ] as const)(
    'renders nothing — and mounts no card — once cookies are %s',
    (_, preferences) => {
      // The returning visitor is the common case, and the reason this is lazy:
      // they never see the card, so they should never download it.
      useConsentStore.getState().savePreferences(preferences);

      const { container } = render(<ConsentBannerLazy />);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it('renders nothing for a browser that sends Global Privacy Control', () => {
    setGlobalPrivacyControlForTests(true);
    const { container } = render(<ConsentBannerLazy />);
    expect(container).toBeEmptyDOMElement();
  });

  it('comes back when Privacy choices reopens it over a standing answer', async () => {
    useConsentStore.getState().savePreferences(REJECT_ALL_CONSENT_PREFERENCES);
    render(<ConsentBannerLazy />);
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();

    act(() => useConsentStore.getState().openPreferences());

    expect(await screen.findByTestId('consent-banner')).toBeInTheDocument();
  });

  it('goes away as soon as an answer is given', async () => {
    render(<ConsentBannerLazy />);
    await screen.findByTestId('consent-banner');

    act(() => screen.getByTestId('consent-reject').click());

    await vi.waitFor(() =>
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument(),
    );
    expect(useConsentStore.getState().preferences).toEqual(
      REJECT_ALL_CONSENT_PREFERENCES,
    );
  });

  // The chunk-in-flight case lives in ConsentBannerLazy.in-flight.test.tsx: it
  // needs a module registry that nothing in this file has touched.
});

describe('ConsentBannerLazy — the entry chunk', () => {
  it('is the ONLY thing the barrel exports, so the root route cannot import the card', async () => {
    // The root route mounts this barrel: a static re-export of `ConsentBanner`
    // would put the whole card back in the entry chunk of every load.
    const barrel = await import('./index.ts');

    expect(Object.keys(barrel)).toEqual(['ConsentBannerLazy']);
  });
});
