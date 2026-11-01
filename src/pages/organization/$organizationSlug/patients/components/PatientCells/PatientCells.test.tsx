import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';
import { patientRow } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { followUpWhen, patientAge } from './patient-cells.ts';
import {
  PatientAgeCell,
  PatientBadges,
  PatientFollowUpCell,
  PatientIdCell,
  PatientNameCell,
  PatientUpdatedCell,
} from './PatientCells.tsx';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const TODAY = '2026-10-03';

const patient = patientRow({
  firstName: 'Dharti',
  lastName: 'Galani',
  name: 'Dharti Galani',
  phone: '+918200603212',
  status: 'regular',
  consents: ['data', 'photos'],
  followUpAt: '2026-10-03T09:20:00.000Z',
  createdAt: '2026-09-24T09:10:00.000Z',
  updatedAt: '2026-10-03T03:30:00.000Z',
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('the cells’ rules', () => {
  it('places a follow-up against the clinic’s today', () => {
    expect(followUpWhen('2026-10-02T12:00:00.000Z', TODAY)).toBe('past');
    expect(followUpWhen('2026-10-03T12:00:00.000Z', TODAY)).toBe('today');
    expect(followUpWhen('2026-10-04T04:00:00.000Z', TODAY)).toBe('future');
  });

  it('counts an age in whole years, none without a birth date', () => {
    expect(patientAge('1995-10-27', TODAY)).toBe(30);
    expect(patientAge('1995-10-02', TODAY)).toBe(31);
    expect(patientAge(null, TODAY)).toBeNull();
  });
});

describe('PatientCells', () => {
  it('draws the ID pill, one badge per value, and nothing for no badge', async () => {
    renderWithProviders(
      <div>
        <PatientIdCell seq={3508} />
        <PatientBadges
          badges={[
            { id: 'aesthetic', label: 'Aesthetic', tone: 'lav' },
            { id: 'lhr', label: 'LHR', tone: 'blush' },
          ]}
        />
        <PatientBadges badges={[]} />
      </div>,
    );
    expect(await screen.findByText('#3508')).toBeInTheDocument();
    expect(screen.getByText('Aesthetic').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'lav',
    );
    expect(screen.getByText('LHR').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'blush',
    );
  });

  it('shows the age over the birth date, or a dash', async () => {
    const { unmount } = renderWithProviders(
      <PatientAgeCell dateOfBirth="1995-10-27" today={TODAY} />,
    );
    expect(await screen.findByText('30 yrs')).toBeInTheDocument();
    expect(screen.getByText(/1995/)).toBeInTheDocument();
    unmount();
    renderWithProviders(<PatientAgeCell dateOfBirth={null} today={TODAY} />);
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('marks an age the desk typed "approx." instead of its estimated date (feat-approximate-age)', async () => {
    renderWithProviders(
      <PatientAgeCell dateOfBirth="1992-10-03" approximate today={TODAY} />,
    );
    expect(await screen.findByText('34 yrs')).toBeInTheDocument();
    expect(screen.getByTestId('patient-age-approximate')).toHaveTextContent('approx.');
    expect(screen.queryByText(/1992/)).not.toBeInTheDocument();
  });

  it('tones the follow-up badge butter today, blush past and sky ahead', async () => {
    renderWithProviders(
      <div>
        <PatientFollowUpCell followUpAt="2026-10-03T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt="2026-09-30T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt="2026-10-09T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt={null} today={TODAY} />
      </div>,
    );
    const badges = await screen.findAllByText(/2:50/);
    const tones = badges.map((node) =>
      node.closest('[data-tone]')?.getAttribute('data-tone'),
    );
    expect(tones).toEqual(['butter', 'blush', 'sky']);
    // The rooms' one time rule: today the time, this week the weekday, ahead the date.
    expect(
      badges.map((node) => withoutBidiMarks(node.textContent).replace(/\s/gu, ' ')),
    ).toEqual(['Today 2:50 PM', 'Wed 2:50 PM', 'Oct 9 2:50 PM']);
  });

  it('says when the patient was last saved — the time alone, no one named', async () => {
    renderWithProviders(<PatientUpdatedCell patient={patient} />);
    // Saved at 09:00 this morning: the rooms' one time rule names the day.
    // The rule's time is an isolated token beside its day word.
    expect(await screen.findByText(/^Today \u20689:00\sAM\u2069$/)).toBeInTheDocument();
    expect(screen.queryByText('Riya S.')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="person-chip"]')).toBeNull();
  });

  it('draws the patient chip — sage avatar, "P" badge, name over the mobile — and is accessible', async () => {
    const { container } = renderWithProviders(
      <PatientNameCell patient={patient} today={TODAY} actions={{}} />,
    );
    expect(await screen.findByText('Dharti Galani')).toBeInTheDocument();
    expect(screen.getByText('+91 82006 03212')).toBeInTheDocument();
    expect(screen.getByTestId('patient-badge')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
