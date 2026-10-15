import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { BillingSubscription } from '@/shared/api/billing-contracts.ts';

const resume = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
vi.mock('@/shared/hooks/useSubscription/index.ts', () => ({
  useResumeSubscription: () => resume,
}));

import { subscriptionFixture } from './billing-plan.fixtures.ts';
import { BillingSubscriptionNotice } from './BillingSubscriptionNotice.tsx';

function renderNotice(
  subscription: BillingSubscription | null,
  canManage = true,
): ReturnType<typeof render> {
  return render(
    <BillingSubscriptionNotice
      subscription={subscription}
      planName="Starter"
      canManage={canManage}
    />,
  );
}

const notice = () => screen.getByTestId('billing-notice');

beforeEach(() => {
  resume.mutate.mockReset();
  resume.isPending = false;
});

describe('BillingSubscriptionNotice', () => {
  it('says nothing on Free', () => {
    renderNotice(null);
    expect(screen.queryByTestId('billing-notice')).not.toBeInTheDocument();
  });

  it('says when a running plan renews, as a day', () => {
    renderNotice(subscriptionFixture());
    expect(notice()).toHaveTextContent('Your plan renews on Nov 1, 2026.');
    expect(screen.queryByTestId('billing-resubscribe')).not.toBeInTheDocument();
  });

  it('says when a plan set to end is canceled, with Resubscribe beside it', async () => {
    const user = userEvent.setup();
    renderNotice(subscriptionFixture({ cancelAtPeriodEnd: true }));
    expect(notice()).toHaveAttribute('data-kind', 'ends');
    expect(notice()).toHaveTextContent(
      'Your subscription will be canceled on Nov 1, 2026.',
    );
    await user.click(screen.getByTestId('billing-resubscribe'));
    expect(resume.mutate).toHaveBeenCalledWith('sub_test');
  });

  it('spins Resubscribe while it runs', () => {
    resume.isPending = true;
    renderNotice(subscriptionFixture({ cancelAtPeriodEnd: true }));
    expect(screen.getByTestId('billing-resubscribe')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('leaves Resubscribe to a member who may manage billing', () => {
    renderNotice(subscriptionFixture({ cancelAtPeriodEnd: true }), false);
    expect(notice()).toHaveTextContent('will be canceled');
    expect(screen.queryByTestId('billing-resubscribe')).not.toBeInTheDocument();
  });

  it('says when a trial ends', () => {
    renderNotice(
      subscriptionFixture({ status: 'trialing', trialEnd: '2026-10-20T00:00:00.000Z' }),
    );
    expect(notice()).toHaveTextContent('Your trial ends on Oct 20, 2026.');
  });

  it('warns about a payment that failed, or has not gone through yet', () => {
    const { unmount } = renderNotice(subscriptionFixture({ status: 'past_due' }));
    expect(notice()).toHaveAttribute('data-kind', 'pastDue');
    expect(notice()).toHaveTextContent(
      "Your last payment didn't go through. Update your payment method to keep Starter.",
    );
    unmount();
    renderNotice(subscriptionFixture({ status: 'incomplete' }));
    expect(notice()).toHaveTextContent("Your first payment hasn't gone through yet.");
  });

  it('has no axe violations', async () => {
    const { container } = renderNotice(subscriptionFixture({ cancelAtPeriodEnd: true }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
