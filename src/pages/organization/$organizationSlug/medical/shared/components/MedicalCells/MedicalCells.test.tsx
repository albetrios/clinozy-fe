import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { addCivilDays, clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { useMedicalDates } from './medical-dates.ts';
import { MakerPills, NamePills } from './MedicalCells.tsx';

describe('MedicalCells', () => {
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

  it('names an instant and a visit by the rooms’ one time rule, a record by its date', () => {
    const { result } = renderHook(() => useMedicalDates());
    // The day named, with its time: "Today 10:12 am".
    expect(result.current.when(new Date().toISOString())).toMatch(/^Today \d{1,2}:\d{2}/);
    expect(result.current.visit(clinicToday())).toBe('Today');
    expect(result.current.visit(addCivilDays(clinicToday(), -1))).toBe('Yesterday');
    expect(result.current.day(clinicToday())).toMatch(/\d/);
  });
});
