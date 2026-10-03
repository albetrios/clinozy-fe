import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';

import { IdPill } from './IdPill.tsx';

describe('IdPill', () => {
  it('draws the 22px muted id pill with tabular figures', () => {
    render(<IdPill>{displayId.patient(3508)}</IdPill>);
    const pill = screen.getByText('#3508');
    expect(pill).toHaveClass(
      'h-5.5',
      'bg-muted',
      'text-muted-foreground-strong',
      'text-caption',
      'rounded-md',
      'tabular-nums',
    );
    expect(pill).toHaveAttribute('data-slot', 'id-pill');
  });

  it('takes extra classes and attributes', () => {
    render(
      <IdPill className="ms-1" title="Payment">
        {displayId.payment(5512)}
      </IdPill>,
    );
    const pill = screen.getByText('PAY-5512');
    expect(pill).toHaveClass('ms-1');
    expect(pill).toHaveAttribute('title', 'Payment');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<IdPill>#2841</IdPill>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
