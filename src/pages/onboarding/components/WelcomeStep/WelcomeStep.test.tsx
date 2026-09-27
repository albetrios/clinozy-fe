import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
});
