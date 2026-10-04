import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { useMedicalDates } from './medical-dates.ts';
import { MakerPills, NamePills, TextCell } from './MedicalCells.tsx';

describe('MedicalCells', () => {
  it('draws a two-line cell with a toned sub line', async () => {
    const { container } = render(
      <TextCell text="Glycolac Cream" sub="Needs MRP and composition" subTone="butter" />,
    );
    expect(screen.getByText('Needs MRP and composition')).toHaveClass(
      'text-tone-butter-foreground',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('draws makers in their tones and names as grey or toned pills', () => {
    render(
      <>
        <MakerPills
          makers={[
            { id: 'a', name: 'ALVI', tone: 'lav' },
            { id: 'b', name: 'DERM', tone: 'sky' },
          ]}
        />
        <NamePills names={[{ id: 'r', name: 'Alvio Pharma · Rakesh' }]} tone="mint" />
      </>,
    );
    expect(screen.getByText('ALVI').closest('[data-slot="pill"]')).toHaveAttribute(
      'data-tone',
      'lav',
    );
    expect(
      screen.getByText('Alvio Pharma · Rakesh').closest('[data-slot="pill"]'),
    ).toHaveAttribute('data-tone', 'mint');
  });

  it('names an instant "Today …" and a date by its day', () => {
    const { result } = renderHook(() => useMedicalDates());
    expect(result.current.when(new Date().toISOString())).toMatch(/^Today /);
    expect(result.current.day(clinicToday())).toMatch(/\d/);
  });
});
