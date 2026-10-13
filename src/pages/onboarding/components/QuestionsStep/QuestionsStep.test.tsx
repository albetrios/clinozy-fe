import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import { QuestionsStep } from './QuestionsStep.tsx';

describe('QuestionsStep', () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset();
  });

  it('renders the three optional question groups', () => {
    render(<QuestionsStep />);
    expect(screen.getByTestId('onboarding-team-size')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-use-case')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-referral')).toBeInTheDocument();
  });

  it('writes a selected choice into the onboarding store', async () => {
    const user = userEvent.setup();
    render(<QuestionsStep />);

    const chip = within(screen.getByTestId('onboarding-team-size')).getByRole('button', {
      name: '2–10',
    });
    await user.click(chip);

    expect(useOnboardingStore.getState().data.teamSize).toBe('2–10');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles a choice off when re-clicked (all questions optional)', async () => {
    const user = userEvent.setup();
    render(<QuestionsStep />);
    const chip = within(screen.getByTestId('onboarding-referral')).getByRole('button', {
      name: 'Search',
    });

    await user.click(chip);
    expect(useOnboardingStore.getState().data.referralSource).toBe('Search');

    await user.click(chip);
    expect(useOnboardingStore.getState().data.referralSource).toBe('');
  });

  it("draws the drawer's chip groups: 24px pills under the field label, kebab ids", () => {
    render(<QuestionsStep />);
    const group = screen.getByTestId('onboarding-team-size');
    // A <fieldset>: a group by its own semantics, named by the field label.
    expect(screen.getByRole('group', { name: 'How big is your team?' })).toBe(group);
    expect(screen.getByText('How big is your team?')).toHaveClass(
      'text-xs',
      'font-medium',
    );
    const chip = screen.getByTestId('onboarding-team-size-two-to-ten');
    expect(chip).toHaveTextContent('2–10');
    expect(chip).toHaveAttribute('data-slot', 'pill');
    expect(chip).toHaveClass('h-6', 'rounded-full');
    expect(
      screen.getByTestId('onboarding-referral-friend-or-colleague'),
    ).toBeInTheDocument();
  });

  it('shows a stored answer as the picked chip', () => {
    useOnboardingStore.getState().patch({ primaryUseCase: 'Internal tools' });
    render(<QuestionsStep />);
    expect(screen.getByTestId('onboarding-use-case-internal-tools')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('onboarding-use-case-something-else')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<QuestionsStep />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
