import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientRow } from '@/shared/api/clinic/patients-contracts.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { followUpWhen, patientAge } from './patient-cells.ts';
import {
  PatientAgeCell,
  PatientBadges,
  PatientDueCell,
  PatientFollowUpCell,
  PatientIdCell,
  PatientNameCell,
  PatientUpdatedCell,
} from './PatientCells.tsx';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');
const TODAY = '2026-10-03';

const patient: PatientRow = {
  organizationId: '00000000-0000-4000-8000-0000000c1a10',
  createdAt: '2026-09-24T09:10:00.000Z',
  updatedAt: '2026-10-03T03:30:00.000Z',
  createdById: '00000000-0000-4000-8000-0000000a0001',
  updatedById: '00000000-0000-4000-8000-0000000a0001',
  deletedAt: null,
  deleteReason: null,
  deleteNote: null,
  id: '0b6d2f0e-5c7a-4c1e-9b2a-3d4e5f6a7b8c',
  seq: 3508,
  firstName: 'Dharti',
  lastName: 'Galani',
  phone: '+918200603212',
  phone2: null,
  email: null,
  gender: 'female',
  dateOfBirth: '1995-10-27',
  address: 'Umra, Velanja',
  homeBranchId: '00000000-0000-4000-8000-0000000b0001',
  types: ['aesthetic'],
  status: 'regular',
  conversion: 'not_converted',
  referralSource: null,
  referredByName: null,
  referredByPatientId: null,
  consentGiven: true,
  consents: ['data', 'photos'],
  doctorId: null,
  followUpAt: '2026-10-03T09:20:00.000Z',
  notes: null,
  complaints: null,
  diagnosis: null,
  treatmentSuggestions: null,
  futureSuggestions: null,
  leadId: null,
  dueTotal: 200_000,
  updatedBy: {
    id: '00000000-0000-4000-8000-0000000a0001',
    name: 'Riya Shah',
    initials: 'RS',
    tone: 'butter',
  },
};

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

  it('tones the follow-up badge butter today, blush past and sky ahead', async () => {
    renderWithProviders(
      <div>
        <PatientFollowUpCell followUpAt="2026-10-03T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt="2026-09-30T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt="2026-10-09T09:20:00.000Z" today={TODAY} />
        <PatientFollowUpCell followUpAt={null} today={TODAY} />
      </div>,
    );
    const tones = (await screen.findAllByText(/·/)).map((node) =>
      node.closest('[data-tone]')?.getAttribute('data-tone'),
    );
    expect(tones).toEqual(['butter', 'blush', 'sky']);
  });

  it('shows what is due in the blush ink, else a muted dash', async () => {
    const { unmount } = renderWithProviders(<PatientDueCell dueTotal={200_000} />);
    const due = await screen.findByText(/2,000/);
    expect(due).toHaveClass('text-tone-blush-foreground', 'font-semibold');
    unmount();
    renderWithProviders(<PatientDueCell dueTotal={0} />);
    expect(await screen.findByText('—')).toHaveClass('text-muted-foreground');
  });

  it('names who last saved the patient, and when', async () => {
    renderWithProviders(<PatientUpdatedCell patient={patient} />);
    expect(await screen.findByText('Riya S.')).toBeInTheDocument();
    expect(screen.getByText(/·/)).toBeInTheDocument();
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
