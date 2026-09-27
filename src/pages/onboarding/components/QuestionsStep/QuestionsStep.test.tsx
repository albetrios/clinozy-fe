import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

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
});
