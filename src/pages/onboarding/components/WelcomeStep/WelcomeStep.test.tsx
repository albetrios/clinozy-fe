import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { WelcomeStep } from './WelcomeStep.tsx';

describe('WelcomeStep', () => {
  it('pitches profile-only setup when the flow has no team steps (default)', () => {
    // Regression: hybrid/personal flows have no organization or invite step,
    // but the pitch promised "create your first organization, and invite your
    // team" — copy the wizard never delivered.
    render(<WelcomeStep />);
    expect(screen.getByText(/personalize your workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/create your first organization/i)).not.toBeInTheDocument();
  });

  it('pitches org creation + invites only when the flow includes team setup', () => {
    render(<WelcomeStep teamSetupIncluded />);
    expect(screen.getByText(/create your first organization/i)).toBeInTheDocument();
    expect(screen.getByText(/invite your team/i)).toBeInTheDocument();
  });

  it("sets the pitch beside the design's 40px tile, in the neutral stone tone", () => {
    const { container } = render(<WelcomeStep />);
    const tile = container.querySelector('[aria-hidden="true"]');
    expect(tile).toHaveClass('size-10', 'rounded-xl', 'bg-tone-stone');
    expect(screen.getByText(/personalize your workspace/i)).toHaveClass('text-body');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<WelcomeStep />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
