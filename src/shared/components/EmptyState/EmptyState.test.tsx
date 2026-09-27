import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { EmptyState } from './EmptyState.tsx';

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(
      <EmptyState
        title="No members yet"
        description="Invite your first teammate."
        action={<button type="button">Invite</button>}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('Invite your first teammate.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('renders an icon when provided', () => {
    render(<EmptyState icon={<svg data-testid="empty-icon" />} title="Empty" />);
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState title="Nothing here" description="Try again later." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
