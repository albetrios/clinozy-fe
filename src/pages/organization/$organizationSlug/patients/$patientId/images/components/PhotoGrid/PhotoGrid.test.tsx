import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { photoDouble } from '../../__tests__/integration/photo-api-double.ts';
import type { PhotoDay } from '../../shared/photo-view.ts';
import { PhotoGrid, type PhotoGridProps } from './PhotoGrid.tsx';

const DAYS: PhotoDay[] = [
  {
    date: '2026-09-24',
    photos: [
      photoDouble({
        id: 'pimg_a',
        displayName: 'IMG_5100',
        bodyPart: 'face',
        stage: 'before',
        serviceLabel: 'Hydrafacial',
      }),
      photoDouble({ id: 'pimg_b', displayName: 'IMG_5101', caption: 'Left cheek' }),
    ],
    serviceLabel: 'Hydrafacial',
  },
  {
    date: '2026-09-20',
    photos: [photoDouble({ id: 'pimg_c', displayName: 'IMG_4974' })],
    serviceLabel: null,
  },
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
  it('groups the photos by day with their visit’s service, each tile its name, day and pills', async () => {
    const { container } = renderGrid({ onEdit: vi.fn(), onDelete: vi.fn() });
    const days = screen.getAllByTestId('patient-photos-day');
    expect(days).toHaveLength(2);
    expect(days[0]).toHaveTextContent('day 24');
    expect(days[0]).toHaveTextContent('Hydrafacial');
    expect(days[1]).not.toHaveTextContent('Hydrafacial');
    const [first] = screen.getAllByTestId('patient-photo-tile');
    expect(within(first as HTMLElement).getByText('Face')).toBeInTheDocument();
    expect(first).toHaveTextContent('IMG_5100');
    expect(first).toHaveTextContent('day 24');
    expect(screen.getByRole('button', { name: 'Open Left cheek' })).toBeInTheDocument();
    // Each tile shows its photo from its link (D86).
    expect(
      within(first as HTMLElement)
        .getByRole('button', { name: /^Open / })
        .querySelector('img'),
    ).toHaveAttribute('src', expect.stringContaining('X-Amz-Expires=900'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens, edits and deletes a photo', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const { onOpen } = renderGrid({ onEdit, onDelete });
    await user.click(screen.getByRole('button', { name: 'Open IMG_4974' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'pimg_c' }));
    const [first] = screen.getAllByTestId('patient-photo-tile');
    await user.click(
      within(first as HTMLElement).getByRole('button', { name: 'Edit details' }),
    );
    await user.click(
      within(first as HTMLElement).getByRole('button', { name: 'Delete photo' }),
    );
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'pimg_a' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'pimg_a' }));
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

  it('lets the day groups flow side by side at the tile’s width', () => {
    renderGrid();
    const [day] = screen.getAllByTestId('patient-photos-day');
    expect(day?.parentElement?.className).toContain('flex-wrap');
    const [tile] = screen.getAllByTestId('patient-photo-tile');
    expect(tile?.className).toContain('w-40');
  });

  it('picks a photo from its check circle, and opens it otherwise', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { onOpen } = renderGrid({
      selection: { active: false, ids: new Set(), full: false, onToggle },
    });
    await user.click(screen.getByRole('button', { name: 'Select IMG_5100' }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'pimg_a' }));
    await user.click(screen.getByRole('button', { name: 'Open IMG_5100' }));
    expect(onOpen).toHaveBeenCalled();
  });

  it('picks instead of opening while selecting, rings what is picked and steps Edit aside', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { onOpen, container } = renderGrid({
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      selection: { active: true, ids: new Set(['pimg_b']), full: false, onToggle },
    });
    const picked = screen.getByRole('button', { name: 'Select Left cheek' });
    expect(picked).toHaveAttribute('aria-pressed', 'true');
    expect(picked.closest('li')).toHaveAttribute('data-picked', 'true');
    await user.click(screen.getByRole('button', { name: 'Select IMG_5100' }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'pimg_a' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByTestId('patient-photo-edit')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
