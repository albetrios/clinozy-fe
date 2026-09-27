import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ONBOARDING_STEPS } from '@/shared/store/useOnboardingStore/index.ts';

import { StepIndicator } from './StepIndicator.tsx';

describe('StepIndicator', () => {
  it('marks the current step with aria-current', () => {
    render(<StepIndicator current={1} steps={ONBOARDING_STEPS} />);
    const current = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('[aria-current="step"]'))
      .filter(Boolean);
    expect(current).toHaveLength(1);
  });
});
