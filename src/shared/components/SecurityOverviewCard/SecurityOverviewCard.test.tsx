import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { SecurityOverviewCard } from './SecurityOverviewCard.tsx';

describe('SecurityOverviewCard', () => {
  it('shows partial score when MFA is off', () => {
    render(<SecurityOverviewCard mfaEnabled={false} passkeyCount={1} />);
    expect(screen.getByTestId('security-overview-score')).toHaveTextContent('2 of 3');
    expect(screen.getByTestId('security-overview-mfa')).toBeInTheDocument();
  });

  it('shows full score when MFA and passkeys are active', () => {
    render(<SecurityOverviewCard mfaEnabled passkeyCount={2} />);
    expect(screen.getByTestId('security-overview-score')).toHaveTextContent('3 of 3');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SecurityOverviewCard mfaEnabled passkeyCount={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
