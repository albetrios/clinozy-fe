import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  REJECT_ALL_CONSENT_PREFERENCES,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import {
  answerConsentForTests,
  readConsentCookieForTests,
  resetConsentForTests,
  setGlobalPrivacyControlForTests,
} from '@/tests/utils/consent-cookie.ts';

import { ConsentBanner } from './ConsentBanner.tsx';

const env = vi.hoisted(() => ({ privacyPolicyUrl: undefined as string | undefined }));
vi.mock('@/core/config/env.ts', () => ({
  platformConfig: env,
}));

const recordConsentDecision = vi.fn(async () => undefined);
vi.mock('@/shared/analytics/record-consent-decision.ts', () => ({
  recordConsentDecision: (...args: unknown[]) => recordConsentDecision(...args),
}));

/** Tailwind classes on the card, as a list — assertions read better than regexes. */
function cardClasses(): string[] {
  return screen.getByTestId('consent-banner').className.split(/\s+/);
}

describe('ConsentBanner', () => {
  beforeEach(() => {
    setGlobalPrivacyControlForTests(false);
    resetConsentForTests();
    recordConsentDecision.mockClear();
    env.privacyPolicyUrl = undefined;
  });

  afterEach(() => {
    setGlobalPrivacyControlForTests(false);
  });

  describe('the first view (claude.com: Customize · Reject · Accept)', () => {
    it('is a non-modal dialog named "Cookie settings"', () => {
      render(<ConsentBanner />);
      const card = screen.getByRole('dialog', { name: 'Cookie settings' });
      expect(card.tagName).toBe('DIALOG');
      expect(card).toHaveAttribute('open');
      expect(card).not.toHaveAttribute('aria-modal');
      expect(screen.getByRole('heading', { name: 'Cookie settings' })).toBeVisible();
    });

    it('describes itself with translated copy that names the product', () => {
      render(<ConsentBanner />);
      // `{{productName}}` is an i18n default variable — locale files never carry the brand.
      expect(
        screen.getByRole('dialog', { name: 'Cookie settings' }),
      ).toHaveAccessibleDescription(expect.stringContaining(PRODUCT_NAME));
    });

    it('offers Customize, Reject all and Accept all — long labels, short ones for a phone', () => {
      render(<ConsentBanner />);
      expect(screen.getByTestId('consent-customize')).toHaveTextContent(
        'CustomizeCustomize cookie settings',
      );
      expect(screen.getByTestId('consent-reject')).toHaveTextContent(
        'RejectReject all cookies',
      );
      expect(screen.getByTestId('consent-accept')).toHaveTextContent(
        'AcceptAccept all cookies',
      );
      // There is no close button: closing without an answer is Escape, which rejects.
      expect(screen.queryByTestId('consent-close')).not.toBeInTheDocument();
    });

    it('links the Privacy Policy with a safe rel for an external _blank target', () => {
      env.privacyPolicyUrl = 'https://example.com/privacy';
      render(<ConsentBanner />);
      const link = screen.getByTestId('consent-policy-link');
      expect(link).toHaveTextContent('here');
      expect(link).toHaveAttribute('href', 'https://example.com/privacy');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('omits the policy sentence when no policy URL is configured', () => {
      render(<ConsentBanner />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('gives Reject and Accept equal weight', () => {
      render(<ConsentBanner />);
      const reject = screen.getByTestId('consent-reject');
      const accept = screen.getByTestId('consent-accept');
      const sizing = (element: HTMLElement) =>
        element.className
          .split(/\s+/)
          .filter((c) => /^(sm:)?(h|min-h|w|min-w|px|col-span)-/.test(c));
      expect(sizing(accept)).toEqual(sizing(reject));
    });

    it('does not take focus when it appears', () => {
      // A non-modal notice: stealing focus would pull a keyboard user out of the sign-in form.
      render(<ConsentBanner />);
      expect(screen.getByTestId('consent-banner')).not.toContainElement(
        document.activeElement as HTMLElement | null,
      );
    });

    it('Accept all saves Analytics on and records the decision', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-accept'));
      expect(useConsentStore.getState().preferences).toEqual(
        ACCEPT_ALL_CONSENT_PREFERENCES,
      );
      expect(readConsentCookieForTests()).toMatchObject({ analytics: true });
      await waitFor(() =>
        expect(recordConsentDecision).toHaveBeenCalledWith(
          ACCEPT_ALL_CONSENT_PREFERENCES,
          'consent_banner',
        ),
      );
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
    });

    it('Reject all saves Analytics off and records the decision', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-reject'));
      expect(useConsentStore.getState().preferences).toEqual(
        REJECT_ALL_CONSENT_PREFERENCES,
      );
      await waitFor(() =>
        expect(recordConsentDecision).toHaveBeenCalledWith(
          REJECT_ALL_CONSENT_PREFERENCES,
          'consent_banner',
        ),
      );
    });

    it('Escape inside the card rejects all (claude.com)', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      screen.getByTestId('consent-reject').focus();
      await user.keyboard('{Escape}');
      expect(useConsentStore.getState().preferences).toEqual(
        REJECT_ALL_CONSENT_PREFERENCES,
      );
    });

    it('Escape elsewhere on the page answers nothing (it closes the app’s own surfaces)', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">elsewhere</button>
          <ConsentBanner />
        </>,
      );
      screen.getByRole('button', { name: 'elsewhere' }).focus();
      await user.keyboard('{Escape}');
      expect(useConsentStore.getState().preferences).toBeNull();
    });
  });

  describe('Customize — the same card, categories and Save', () => {
    it('swaps to Necessary (Required, locked on) and Analytics (Off), and focuses the switch', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-customize'));

      expect(screen.getByTestId('consent-banner')).toHaveAttribute(
        'data-view',
        'customize',
      );
      const necessary = screen.getByRole('switch', { name: 'Necessary' });
      expect(necessary).toBeChecked();
      expect(necessary).toBeDisabled();
      expect(screen.getByTestId('consent-option-necessary')).toHaveTextContent(
        'Required',
      );

      const analytics = screen.getByRole('switch', { name: 'Analytics' });
      expect(analytics).not.toBeChecked();
      expect(analytics).toHaveFocus();
      expect(screen.getByTestId('consent-option-analytics')).toHaveTextContent('Off');
      expect(screen.queryByTestId('consent-accept')).not.toBeInTheDocument();
    });

    it('starts from the current answer when reopened', async () => {
      const user = userEvent.setup();
      answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
      useConsentStore.getState().openPreferences();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-customize'));
      expect(screen.getByRole('switch', { name: 'Analytics' })).toBeChecked();
      expect(screen.getByTestId('consent-option-analytics')).toHaveTextContent('On');
    });

    it('Save preferences stores exactly the switches', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-customize'));
      await user.click(screen.getByRole('switch', { name: 'Analytics' }));
      expect(screen.getByTestId('consent-option-analytics')).toHaveTextContent('On');
      await user.click(screen.getByTestId('consent-save'));

      expect(useConsentStore.getState().preferences).toEqual({ analytics: true });
      await waitFor(() =>
        expect(recordConsentDecision).toHaveBeenCalledWith(
          { analytics: true },
          'consent_banner',
        ),
      );
    });

    it('a tap on the category name toggles its switch', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      await user.click(screen.getByTestId('consent-customize'));
      await user.click(
        within(screen.getByTestId('consent-option-analytics')).getByText('Analytics'),
      );
      expect(screen.getByRole('switch', { name: 'Analytics' })).toBeChecked();
    });
  });

  describe('Global Privacy Control', () => {
    it('says why, locks Accept all and the Analytics switch, and saves Analytics off', async () => {
      setGlobalPrivacyControlForTests(true);
      useConsentStore.getState().openPreferences();
      const user = userEvent.setup();
      render(<ConsentBanner />);

      expect(screen.getByTestId('consent-gpc-note')).toHaveTextContent(
        'Global Privacy Control',
      );
      expect(screen.getByTestId('consent-accept')).toBeDisabled();

      await user.click(screen.getByTestId('consent-customize'));
      expect(screen.getByRole('switch', { name: 'Analytics' })).toBeDisabled();
      expect(screen.getByTestId('consent-save')).toHaveFocus();
      await user.click(screen.getByTestId('consent-save'));
      expect(useConsentStore.getState().preferences).toEqual(
        REJECT_ALL_CONSENT_PREFERENCES,
      );
    });
  });

  it('has no accessibility violations, in either view', async () => {
    env.privacyPolicyUrl = 'https://example.com/privacy';
    const user = userEvent.setup();
    const { container } = render(<ConsentBanner />);
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByTestId('consent-customize'));
    expect(await axe(container)).toHaveNoViolations();
  });

  // ── A corner card, not a full-width bar ──────────────────────────────────

  describe('placement', () => {
    it('is a corner card at most 456px wide from `sm` up — never a viewport-wide bar', () => {
      render(<ConsentBanner />);
      const classes = cardClasses();
      expect(classes).not.toContain('inset-x-0');
      expect(classes).not.toContain('bottom-0');
      expect(classes).toContain('sm:inset-x-auto');
      expect(classes).toContain('sm:w-[28.5rem]');
    });

    it('takes the bottom-START corner, 24px in, with logical properties so RTL mirrors it', () => {
      render(<ConsentBanner />);
      const classes = cardClasses();
      expect(classes).toContain('sm:start-6');
      // The END corner belongs to the feedback trigger and the edge controls.
      expect(classes.filter((c) => /(^|:)(end|right|left)-/.test(c))).toEqual([]);
    });

    it('widens into an inset sheet below `sm` instead of touching the screen edges', () => {
      render(<ConsentBanner />);
      expect(cardClasses()).toEqual(expect.arrayContaining(['inset-x-3', 'w-auto']));
    });

    it('rides above the mobile tab bar via --floating-bottom-offset', () => {
      render(<ConsentBanner />);
      const bottoms = cardClasses().filter((c) => c.includes('bottom-['));
      expect(bottoms).toHaveLength(2);
      for (const bottom of bottoms) {
        expect(bottom).toContain('var(--floating-bottom-offset,0rem)');
        expect(bottom).toContain('env(safe-area-inset-bottom,0rem)');
      }
    });

    it('is a themed floating surface — elevation, separation and shape apply', () => {
      render(<ConsentBanner />);
      const card = screen.getByTestId('consent-banner');
      expect(card).toHaveAttribute('data-slot', 'surface');
      expect(card).toHaveAttribute('data-floating');
      expect(cardClasses()).toContain('rounded-3xl');
      expect(cardClasses().filter((c) => c.includes('shadow'))).toEqual([]);
    });

    it('honors reduced motion on its entrance', () => {
      render(<ConsentBanner />);
      expect(cardClasses()).toContain('motion-reduce:animate-none');
    });
  });

  describe('page clearance (--consent-card-height)', () => {
    const published = () =>
      document.documentElement.style.getPropertyValue('--consent-card-height');

    it('publishes its measured height while it is up', () => {
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        height: 173.4,
      } as DOMRect);
      render(<ConsentBanner />);
      expect(published()).toBe('174px');
      vi.restoreAllMocks();
    });

    it('withdraws the reservation once answered', async () => {
      const user = userEvent.setup();
      render(<ConsentBanner />);
      expect(published()).not.toBe('');
      await user.click(screen.getByTestId('consent-reject'));
      await waitFor(() => expect(published()).toBe(''));
    });

    it('withdraws the reservation on unmount', () => {
      const { unmount } = render(<ConsentBanner />);
      unmount();
      expect(published()).toBe('');
    });

    it('renders and reserves nothing while an answer stands and nobody reopened it', () => {
      answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
      render(<ConsentBanner />);
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
      expect(published()).toBe('');
    });
  });
});
