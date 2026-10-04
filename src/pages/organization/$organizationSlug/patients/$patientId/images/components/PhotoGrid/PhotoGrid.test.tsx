import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { PatientPhoto } from '@/shared/api/clinic/patient-images-api.ts';

import type { PhotoDay } from '../../shared/photo-view.ts';
import { PhotoGrid, type PhotoGridProps } from './PhotoGrid.tsx';

const VISIT = {
  appointmentId: '00000000-0000-4000-8000-000000002790',
  seq: 2790,
  date: '2026-09-24',
  serviceLabel: 'Hydrafacial',
  status: 'completed' as const,
};

function photo(id: string, fields: Partial<PatientPhoto> = {}): PatientPhoto {
  return {
    id,
    organizationId: 'org',
    createdAt: '2026-09-24T06:30:00.000Z',
    updatedAt: '2026-09-24T06:30:00.000Z',
    createdById: 'user',
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    patientId: 'patient',
    appointmentId: null,
    album: 'general',
    fileUrl: 'uploads/a.jpg',
    fileName: id,
    bodyPart: null,
    takenOn: '2026-09-24',
    caption: null,
    visit: null,
    ...fields,
  };
}

const DAYS: PhotoDay[] = [
  {
    date: '2026-09-24',
    photos: [
      photo('IMG_5100', {
        bodyPart: 'face',
        appointmentId: VISIT.appointmentId,
        visit: VISIT,
      }),
      photo('IMG_5101', { caption: 'Left cheek' }),
    ],
    visit: VISIT,
  },
  { date: '2026-09-20', photos: [photo('IMG_4974')], visit: null },
];

function renderGrid(props: Partial<PhotoGridProps> = {}) {
  const onOpen = vi.fn();
  const view = render(
    <PhotoGrid
      days={DAYS}
      size="medium"
      dayLabel={(date) => `day ${date.slice(8)}`}
      onOpen={onOpen}
      {...props}
    />,
  );
  return { ...view, onOpen };
}

describe('PhotoGrid', () => {
  it('groups the photos by day, naming the visit they were taken at', async () => {
    const { container } = renderGrid({ onEdit: vi.fn(), onDelete: vi.fn() });
    const days = screen.getAllByTestId('patient-photos-day');
    expect(days).toHaveLength(2);
    expect(days[0]).toHaveTextContent('day 24');
    expect(days[0]).toHaveTextContent('2 photos · day 24 · Hydrafacial');
    expect(days[1]).toHaveTextContent('1 photo');
    expect(days[1]).not.toHaveTextContent('·');
    expect(within(days[0] as HTMLElement).getByText('Face')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Left cheek' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens, edits and deletes a photo', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { onOpen } = renderGrid({ onEdit, onDelete });
    await user.click(screen.getByRole('button', { name: 'Open IMG_4974' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'IMG_4974' }));
    const [first] = screen.getAllByTestId('patient-photo-tile');
    await user.click(
      within(first as HTMLElement).getByRole('button', { name: 'Edit details' }),
    );
    await user.click(
      within(first as HTMLElement).getByRole('button', { name: 'Delete photo' }),
    );
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'IMG_5100' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'IMG_5100' }));
  });

  it('leaves Edit and Delete off small tiles, and off for a member who can’t', () => {
    const small = renderGrid({ size: 'small', onEdit: vi.fn(), onDelete: vi.fn() });
    expect(
      screen.queryByRole('button', { name: 'Edit details' }),
    ).not.toBeInTheDocument();
    small.unmount();
    renderGrid({ size: 'large' });
    expect(
      screen.queryByRole('button', { name: 'Delete photo' }),
    ).not.toBeInTheDocument();
  });

  it('sizes the grid S / M / L', () => {
    const { container, rerender } = renderGrid({ size: 'small' });
    expect(container.querySelector('ul')).toHaveClass('gap-1.5');
    rerender(
      <PhotoGrid days={DAYS} size="large" dayLabel={(date) => date} onOpen={vi.fn()} />,
    );
    expect(container.querySelector('ul')).toHaveClass('gap-3');
  });
});
