import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { platformConfig } from '@/core/config/env.ts';
import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import {
  readConsentCookieForTests,
  resetConsentForTests,
  setGlobalPrivacyControlForTests,
} from '@/tests/utils/consent-cookie.ts';

import { AccountPrivacyCard } from './AccountPrivacyCard.tsx';

type MutableConfig = { privacyPolicyUrl: string | undefined };
const config = platformConfig as unknown as MutableConfig;
const originalPolicyUrl = config.privacyPolicyUrl;

const record = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/shared/analytics/record-consent-decision.ts', () => ({
  recordConsentDecision: record,
}));

describe('AccountPrivacyCard — this browser’s cookie settings', () => {
  beforeEach(() => {
    record.mockClear();
    config.privacyPolicyUrl = undefined;
    setGlobalPrivacyControlForTests(false);
    resetConsentForTests();
  });

  afterEach(() => {
    config.privacyPolicyUrl = originalPolicyUrl;
    setGlobalPrivacyControlForTests(false);
  });

  it('draws the Customize rows: Necessary required and locked, Analytics off until answered', () => {
    render(<AccountPrivacyCard />);
    const necessary = screen.getByRole('switch', { name: 'Necessary' });
    expect(necessary).toBeChecked();
    expect(necessary).toBeDisabled();
    expect(screen.getByTestId('account-privacy-necessary')).toHaveTextContent('Required');
    expect(screen.getByRole('switch', { name: 'Analytics' })).not.toBeChecked();
    expect(screen.getByTestId('account-privacy-status')).toHaveTextContent(
      'Not answered yet',
    );
  });

  it('turning Analytics on saves it in this browser at once and records it from Settings', async () => {
    const user = userEvent.setup();
    render(<AccountPrivacyCard />);

    await user.click(screen.getByTestId('account-privacy-analytics-switch'));

    expect(useConsentStore.getState().preferences).toEqual({ analytics: true });
    expect(readConsentCookieForTests()).toMatchObject({ analytics: true });
    expect(screen.getByTestId('account-privacy-analytics')).toHaveTextContent('On');
    expect(screen.getByTestId('account-privacy-status')).toHaveTextContent(/^Saved on /);
    await waitFor(() =>
      expect(record).toHaveBeenCalledWith({ analytics: true }, 'settings'),
    );
  });

  it('turning it off withdraws as easily as it was given', async () => {
    useConsentStore.getState().savePreferences(ACCEPT_ALL_CONSENT_PREFERENCES);
    const user = userEvent.setup();
    render(<AccountPrivacyCard />);

    await user.click(screen.getByTestId('account-privacy-analytics-switch'));

    expect(useConsentStore.getState().preferences).toEqual({ analytics: false });
    expect(screen.getByTestId('account-privacy-analytics')).toHaveTextContent('Off');
    await waitFor(() =>
      expect(record).toHaveBeenCalledWith({ analytics: false }, 'settings'),
    );
  });

  it('locks Analytics off under Global Privacy Control and says why', () => {
    setGlobalPrivacyControlForTests(true);
    useConsentStore.getState().savePreferences(ACCEPT_ALL_CONSENT_PREFERENCES);
    render(<AccountPrivacyCard />);
    const toggle = screen.getByRole('switch', { name: 'Analytics' });
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeDisabled();
    expect(screen.getByTestId('consent-gpc-note')).toHaveTextContent(
      'Global Privacy Control',
    );
  });

  it('links the privacy policy when one is configured', () => {
    config.privacyPolicyUrl = 'https://example.com/privacy';
    render(<AccountPrivacyCard />);
    const link = screen.getByTestId('account-privacy-policy');
    expect(link).toHaveAttribute('href', 'https://example.com/privacy');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AccountPrivacyCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
