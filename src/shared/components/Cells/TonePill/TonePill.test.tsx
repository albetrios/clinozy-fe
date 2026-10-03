import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TONE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Phone } from '@/shared/icons/index.ts';

import { TonePill } from './TonePill.tsx';

describe('TonePill', () => {
  it.each(TONE_VALUES)('paints the %s tone from the one tone map', (tone) => {
    render(<TonePill tone={tone}>Status</TonePill>);
    const pill = screen.getByText('Status');
    for (const token of TONE_CLASSES[tone].surface.split(' ')) {
      expect(pill).toHaveClass(token);
    }
    expect(pill).toHaveAttribute('data-tone', tone);
  });

  it('is a 24px table pill by default and a 22px card pill when small', () => {
    const { rerender } = render(<TonePill tone="sky">Booked</TonePill>);
    expect(screen.getByText('Booked')).toHaveClass('h-6', 'px-2.5', 'text-xs');

    rerender(
      <TonePill tone="sky" size="sm">
        Booked
      </TonePill>,
    );
    expect(screen.getByText('Booked')).toHaveClass('h-5.5', 'px-2', 'text-caption');
  });

  it('squares under the Sharp shape: rounded-full rides on the pill slot', () => {
    render(<TonePill tone="sage">Patient</TonePill>);
    const pill = screen.getByText('Patient');
    expect(pill).toHaveClass('rounded-full');
    expect(pill).toHaveAttribute('data-slot', 'pill');
  });

  it('has the neutral and inverse surfaces for pills without a tone', () => {
    const { rerender } = render(<TonePill tone="neutral">Treating</TonePill>);
    expect(screen.getByText('Treating')).toHaveClass(
      'bg-muted',
      'text-muted-foreground-strong',
    );
    rerender(<TonePill tone="inverse">Assigned</TonePill>);
    expect(screen.getByText('Assigned')).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
    );
  });

  it('draws a dot in the ink and a hidden leading icon', () => {
    const { container } = render(
      <TonePill tone="blush" dot icon={<Phone />}>
        Overdue
      </TonePill>,
    );
    const [dot, icon] = Array.from(
      container.querySelectorAll('[data-slot="pill"] > [aria-hidden="true"]'),
    );
    expect(dot).toHaveClass('bg-current', 'size-1.5');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TonePill tone="lav" dot>
        Contacted
      </TonePill>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
