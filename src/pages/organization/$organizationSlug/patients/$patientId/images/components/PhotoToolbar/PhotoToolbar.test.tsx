import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PhotoToolbar, type PhotoToolbarProps } from './PhotoToolbar.tsx';

const VISIT = {
  appointmentId: '00000000-0000-4000-8000-000000002790',
  seq: 2790,
  date: '2026-09-24',
  serviceLabel: 'Hydrafacial',
  status: 'completed' as const,
};

function renderToolbar(props: Partial<PhotoToolbarProps> = {}) {
  const handlers = {
    onAlbumChange: vi.fn(),
    onAppointmentChange: vi.fn(),
    onSizeChange: vi.fn(),
  };
  const view = renderWithProviders(
    <PhotoToolbar
      album="general"
      albums={['general', 'private', 'lhr']}
      count={3}
      albumCount={3}
      appointment={undefined}
      visits={[{ visit: VISIT, count: 3 }]}
      dayLabel={() => '24 Sep'}
      size="medium"
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

describe('PhotoToolbar', () => {
  it('lays out the albums, the count, the visit filter and the sizes', async () => {
    const { container } = renderToolbar();
    const tabs = await screen.findByRole('tablist', { name: 'Albums' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['General', 'Private', 'LHR']);
    expect(screen.getByText('3 photos')).toBeInTheDocument();
    expect(screen.getByTestId('patient-photos-visit-filter')).toHaveTextContent(
      'All photos',
    );
    expect(
      screen.getByRole('radiogroup', { name: 'Thumbnail size' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium thumbnails' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('picks an album', async () => {
    const user = userEvent.setup();
    const { onAlbumChange } = renderToolbar();
    await user.click(await screen.findByRole('tab', { name: 'LHR' }));
    expect(onAlbumChange).toHaveBeenCalledWith('lhr');
  });

  it('offers every photo, those under no visit, and each visit with photos', async () => {
    const user = userEvent.setup();
    const { onAppointmentChange } = renderToolbar();
    await user.click(await screen.findByTestId('patient-photos-visit-filter'));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining('All photos'),
      expect.stringContaining('Not attached to a visit'),
      expect.stringContaining('24 Sep · Hydrafacial'),
    ]);
    expect(options[0]).toHaveTextContent('3 in General');
    expect(options[2]).toHaveTextContent('#2790 · Completed');
    expect(options[2]).toHaveTextContent('3 photos');
    await user.click(options[2] as HTMLElement);
    expect(onAppointmentChange).toHaveBeenCalledWith(VISIT.appointmentId);
  });

  it('goes back to every photo from a visit', async () => {
    const user = userEvent.setup();
    const { onAppointmentChange } = renderToolbar({ appointment: 'none' });
    await user.click(await screen.findByTestId('patient-photos-visit-filter'));
    await user.click(await screen.findByRole('option', { name: /All photos/ }));
    expect(onAppointmentChange).toHaveBeenCalledWith(undefined);
  });

  it('moves the size with the arrow keys and hides an empty count', async () => {
    const { onSizeChange } = renderToolbar({ count: 0, size: 'large' });
    fireEvent.keyDown(await screen.findByRole('radio', { name: 'Large thumbnails' }), {
      key: 'ArrowRight',
    });
    expect(onSizeChange).toHaveBeenLastCalledWith('small');
    expect(screen.queryByText(/^\d+ photos?$/)).not.toBeInTheDocument();
  });
});
