import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { ONBOARDING_STEPS } from '@/shared/store/useOnboardingStore/index.ts';

import { StepIndicator } from './StepIndicator.tsx';

describe('StepIndicator', () => {
  it('counts the four steps: Welcome, Your name, Clinic name, Done', () => {
    render(<StepIndicator current={0} steps={ONBOARDING_STEPS} />);
    const circles = screen.getAllByRole('listitem');
    expect(circles).toHaveLength(4);
    expect(circles.map((item) => item.textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('marks the current step with aria-current', () => {
    render(<StepIndicator current={1} steps={ONBOARDING_STEPS} />);
    const current = screen
      .getAllByRole('listitem')
      .map((li) => li.querySelector('[aria-current="step"]'))
      .filter(Boolean);
    expect(current).toHaveLength(1);
  });

  it("draws the drawer's step circles: done green with a check, open ink, later grey", () => {
    const { container } = render(<StepIndicator current={2} steps={ONBOARDING_STEPS} />);
    const circles = Array.from(container.querySelectorAll('[data-state]'));
    expect(circles.map((circle) => circle.getAttribute('data-state'))).toEqual(
      ONBOARDING_STEPS.map((_, i) => {
        if (i < 2) return 'done';
        return i === 2 ? 'current' : 'upcoming';
      }),
    );
    const [done, , current, upcoming] = circles;
    expect(done).toHaveClass('bg-success', 'size-6');
    expect(done?.querySelector('svg')).not.toBeNull();
    expect(current).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(current).toHaveTextContent('3');
    expect(upcoming).toHaveClass('bg-border', 'text-muted-foreground-strong');
    expect(upcoming).toHaveTextContent('4');
  });

  it('shares the width: every step but the last grows with its hairline, green once done', () => {
    render(<StepIndicator current={1} steps={ONBOARDING_STEPS} />);
    const items = screen.getAllByRole('listitem');
    expect(items.slice(0, -1).every((li) => li.classList.contains('flex-1'))).toBe(true);
    expect(items.at(-1)).not.toHaveClass('flex-1');
    const firstLine = items[0]?.querySelector('[aria-hidden="true"].h-px');
    expect(firstLine).toHaveClass('bg-success', 'flex-1');
    const laterLine = items[1]?.querySelector('[aria-hidden="true"].h-px');
    expect(laterLine).toHaveClass('bg-border');
    expect(items.at(-1)?.querySelector('.h-px')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<StepIndicator current={0} steps={ONBOARDING_STEPS} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
