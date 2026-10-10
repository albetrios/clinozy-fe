import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { platformConfig } from '@/core/config/env.ts';
import { useConsentStore } from '@/shared/store/useConsentStore/index.ts';

import { AccountPrivacyCard } from './AccountPrivacyCard.tsx';

type MutableConfig = { privacyPolicyUrl: string | undefined };
const config = platformConfig as unknown as MutableConfig;
const originalPolicyUrl = config.privacyPolicyUrl;

const capture = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('@/shared/analytics/capture-consent-decision.ts', () => ({
  captureAnalyticsConsentDecision: capture,
}));

describe('AccountPrivacyCard (D161)', () => {
  beforeEach(() => {
    capture.mockClear();
    config.privacyPolicyUrl = undefined;
    useConsentStore.getState().resetAnalyticsConsent();
  });

  afterEach(() => {
    config.privacyPolicyUrl = originalPolicyUrl;
  });

  it('reads "Not answered yet" with the switch off until the person answers', () => {
    render(<AccountPrivacyCard />);
    expect(screen.getByTestId('account-privacy-status')).toHaveTextContent(
      'Not answered yet',
    );
    // a11y guard: the switch is named by its label.
    expect(
      screen.getByRole('switch', { name: 'Product analytics and session recordings' }),
    ).not.toBeChecked();
  });

  it('turning it on grants consent from Settings', async () => {
    const user = userEvent.setup();
    render(<AccountPrivacyCard />);

    await user.click(screen.getByTestId('account-privacy-analytics'));

    expect(useConsentStore.getState().analyticsConsent).toBe('granted');
    expect(screen.getByTestId('account-privacy-status')).toHaveTextContent(
      /^Allowed on /,
    );
    await waitFor(() => expect(capture).toHaveBeenCalledWith('granted', 'settings'));
  });

  it('turning it off withdraws consent as easily as it was given', async () => {
    useConsentStore.getState().setAnalyticsConsent('granted');
    const user = userEvent.setup();
    render(<AccountPrivacyCard />);

    await user.click(screen.getByTestId('account-privacy-analytics'));

    expect(useConsentStore.getState().analyticsConsent).toBe('denied');
    expect(screen.getByTestId('account-privacy-status')).toHaveTextContent(
      /^Declined on /,
    );
    await waitFor(() => expect(capture).toHaveBeenCalledWith('denied', 'settings'));
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
