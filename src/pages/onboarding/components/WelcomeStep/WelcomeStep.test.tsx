import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { WelcomeStep } from './WelcomeStep.tsx';

describe('WelcomeStep', () => {
  it('pitches profile-only setup when the flow has no team steps (default)', () => {
    // Regression: hybrid/personal flows have no organization step, but the
    // pitch promised "create your first organization" — copy the wizard never
    // delivered.
    render(<WelcomeStep />);
    expect(screen.getByText(/personalize your workspace/i)).toBeInTheDocument();
    expect(screen.queryByText(/create your first organization/i)).not.toBeInTheDocument();
  });

  it('pitches org creation only when the flow includes team setup — never invites', () => {
    // Inviting moved to the setup guide (clinic-setup D4): no step here asks for
    // teammates, so the pitch must not promise it.
    render(<WelcomeStep teamSetupIncluded />);
    expect(screen.getByText(/create your first organization/i)).toBeInTheDocument();
    expect(screen.queryByText(/invite/i)).not.toBeInTheDocument();
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
