import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AppointmentStatusPill } from './AppointmentStatusPill.tsx';

describe('AppointmentStatusPill', () => {
  it.each([
    ['scheduled', 'Scheduled', 'butter'],
    ['confirmed', 'Confirmed', 'sky'],
    ['checked_in', 'Checked in', 'lav'],
    ['completed', 'Completed', 'sage'],
    ['cancelled', 'Cancelled', 'stone'],
    ['no_show', 'No show', 'blush'],
  ] as const)(
    'draws %s as "%s" in %s with the tone’s dot (H:3420)',
    (status, label, tone) => {
      render(<AppointmentStatusPill status={status} />);
      const pill = screen.getByText(label).closest('[data-slot="pill"]');
      expect(pill).toHaveAttribute('data-tone', tone);
      expect(pill?.querySelector('[aria-hidden="true"]')).toHaveClass(
        `bg-tone-${tone}-dot`,
      );
    },
  );

  it('has no axe violations', async () => {
    const { container } = render(<AppointmentStatusPill status="confirmed" size="sm" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
