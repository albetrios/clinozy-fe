import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { PersonChip } from './PersonChip.tsx';

describe('PersonChip', () => {
  it('shows the avatar, the name and the sub line', () => {
    const { container } = render(
      <PersonChip name="Rhea Shah" sub="+91 98250 44120" tone="lav" />,
    );
    expect(screen.getByText('RS')).toHaveClass('bg-tone-lav');
    expect(screen.getByText('Rhea Shah')).toHaveClass(
      'text-body',
      'font-medium',
      'truncate',
    );
    expect(screen.getByText('+91 98250 44120')).toHaveClass(
      'text-muted-foreground',
      'text-xs',
    );
    expect(container.querySelector('[data-testid="patient-badge"]')).toBeNull();
  });

  it('marks a patient with the "P" badge and says so to a screen reader', () => {
    render(<PersonChip name="Dharti Galani" tone="sage" patient />);
    expect(screen.getByTestId('patient-badge')).toHaveTextContent('P');
    // Visible name "Dharti Galani", spoken "Dharti Galani, Patient".
    expect(screen.getByText('Dharti Galani', { exact: false })).toHaveTextContent(
      'Dharti Galani, Patient',
    );
    expect(screen.getByText(', Patient')).toHaveClass('sr-only');
  });

  it('uses the record initials when given', () => {
    render(<PersonChip name="Dr. Rakesh Patel" initials="RP" tone="sky" />);
    expect(screen.getByText('RP')).toBeInTheDocument();
  });

  it('passes props through to the root (a card trigger needs them)', () => {
    render(<PersonChip name="Rhea Shah" tone="lav" data-testid="chip" title="Rhea" />);
    expect(screen.getByTestId('chip')).toHaveAttribute('title', 'Rhea');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PersonChip name="Rhea Shah" sub="#3508" tone="sage" patient />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
