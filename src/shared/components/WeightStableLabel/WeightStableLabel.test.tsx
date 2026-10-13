import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { WeightStableLabel } from './WeightStableLabel.tsx';

describe('WeightStableLabel', () => {
  it('shows the label once — the width reserve is a pseudo-element, not a second text node', () => {
    const { container } = render(<WeightStableLabel label="Appointments" />);
    expect(screen.getByText('Appointments')).toBeInTheDocument();
    expect(container.textContent).toBe('Appointments');
  });

  it('reserves the 600-weight width in the same grid cell, hidden from assistive tech', () => {
    const { container } = render(<WeightStableLabel label="Appointments" />);
    const reserve = container.querySelector('[data-slot="weight-reserve"]');
    expect(reserve).toHaveAttribute('data-label', 'Appointments');
    expect(reserve).toHaveAttribute('aria-hidden', 'true');
    expect(reserve).toHaveClass(
      'invisible',
      'font-semibold',
      'h-0',
      'col-start-1',
      'row-start-1',
      'before:content-[attr(data-label)]',
    );
    // The shown label sits in the same cell, inherits the tab's weight and truncates.
    const shown = screen.getByText('Appointments');
    expect(shown).toHaveClass('col-start-1', 'row-start-1', 'truncate');
    expect(shown).not.toHaveClass('font-semibold');
  });

  it('takes the caller’s classes on the grid box', () => {
    const { container } = render(
      <WeightStableLabel label="More" className="text-center" />,
    );
    expect(container.firstElementChild).toHaveClass('inline-grid', 'text-center');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <a href="/leads">
        <WeightStableLabel label="Leads" />
      </a>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
