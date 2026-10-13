import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { TONE_VALUES } from '@/shared/api/app/app-schema.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Phone } from '@/shared/icons/index.ts';

import { TonePill } from './TonePill.tsx';

/** The pill around a label — the label itself sits in the pill's truncating span. */
function pill(label: string) {
  return screen.getByText(label).closest('[data-slot="pill"]');
}

describe('TonePill', () => {
  it.each(TONE_VALUES)('paints the %s tone from the one tone map', (tone) => {
    render(<TonePill tone={tone}>Status</TonePill>);
    const status = pill('Status');
    for (const token of TONE_CLASSES[tone].surface.split(' ')) {
      expect(status).toHaveClass(token);
    }
    expect(status).toHaveAttribute('data-tone', tone);
  });

  it('is a 24px table pill by default and a 22px card pill when small', () => {
    const { rerender } = render(<TonePill tone="sky">Booked</TonePill>);
    expect(pill('Booked')).toHaveClass('h-6', 'px-2.5', 'text-xs');

    rerender(
      <TonePill tone="sky" size="sm">
        Booked
      </TonePill>,
    );
    expect(pill('Booked')).toHaveClass('h-5.5', 'px-2', 'text-caption');

    rerender(
      <TonePill tone="sky" size="xs">
        Booked
      </TonePill>,
    );
    expect(pill('Booked')).toHaveClass('h-4.5', 'px-1.75', 'text-tiny');
  });

  it('squares under the Sharp shape: rounded-full rides on the pill slot', () => {
    render(<TonePill tone="sage">Patient</TonePill>);
    const patient = pill('Patient');
    expect(patient).toHaveClass('rounded-full');
    expect(patient).toHaveAttribute('data-slot', 'pill');
  });

  it('has the neutral and inverse surfaces for pills without a tone', () => {
    const { rerender } = render(<TonePill tone="neutral">Treating</TonePill>);
    expect(pill('Treating')).toHaveClass('bg-muted', 'text-muted-foreground-strong');
    rerender(<TonePill tone="inverse">Assigned</TonePill>);
    expect(pill('Assigned')).toHaveClass('bg-primary', 'text-primary-foreground');
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

  it('draws the dot in the tone’s dot colour when asked (the status pills)', () => {
    const { container } = render(
      <TonePill tone="butter" dot="tone">
        Scheduled
      </TonePill>,
    );
    const dot = container.querySelector('[data-slot="pill"] > [aria-hidden="true"]');
    expect(dot).toHaveClass('bg-tone-butter-dot');
    expect(dot).not.toHaveClass('bg-current');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <TonePill tone="lav" dot>
        Contacted
      </TonePill>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('isolates the label in its own direction; the dot stays with the page', () => {
    // On a right-to-left page a Latin tag keeps its brackets and full stop in place.
    const { container } = render(
      <div dir="rtl">
        <TonePill tone="lav" dot>
          Hair-fall (PRP)
        </TonePill>
      </div>,
    );
    expect(screen.getByText('Hair-fall (PRP)')).toHaveAttribute('dir', 'auto');
    expect(pill('Hair-fall (PRP)')).not.toHaveAttribute('dir');
    expect(container).toHaveTextContent('Hair-fall (PRP)');
  });

  it('truncates a long label inside the pill and keeps a sized icon its size', () => {
    render(
      <TonePill tone="sky" icon={<Phone className="size-3.5" />}>
        Consultation follow-up
      </TonePill>,
    );
    expect(screen.getByText('Consultation follow-up')).toHaveClass('min-w-0', 'truncate');
    expect(pill('Consultation follow-up')).toHaveClass('max-w-full', 'min-w-0');
  });
});
