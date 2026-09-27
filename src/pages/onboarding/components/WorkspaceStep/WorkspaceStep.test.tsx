import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useOnboardingStore } from '@/shared/store/useOnboardingStore/index.ts';

import { WorkspaceStep } from './WorkspaceStep.tsx';

describe('WorkspaceStep', () => {
  it('patches the organization name into the onboarding store', async () => {
    const user = userEvent.setup();
    render(<WorkspaceStep />);
    await user.type(screen.getByTestId('onboarding-organization-name'), 'Acme');
    expect(useOnboardingStore.getState().data.organizationName).toContain('Acme');
  });
});
