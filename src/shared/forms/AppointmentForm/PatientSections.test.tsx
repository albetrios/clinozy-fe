import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  CONFIRM_TEST_IDS,
  confirmReasonTestId,
} from '@/shared/components/ConfirmDialog/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The upload tray, settled at once: every accepted file is uploaded under a key. */
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({
    enqueue: (
      files: readonly File[],
      options: { onUploaded: (key: string, file: File) => Promise<void> },
    ) => {
      for (const file of files) void options.onUploaded(`uploads/${file.name}`, file);
      return { accepted: files.length, skipped: 0 };
    },
  }),
}));

import { APPOINTMENT_FORM_TEST_IDS as IDS } from './appointment-form.constants.ts';
import {
  NotPatientCard,
  VisitPhotos,
  type VisitPhotosProps,
} from './PatientSections.tsx';

/** Dharti's consultation, completed with three photos (`IMAGE_ROWS`). */
const VISIT = ref.appointment(2790);

function wrap(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>,
  );
}

function renderPhotos(props: Partial<VisitPhotosProps> = {}) {
  const onOpenPhoto = vi.fn();
  const onEditPhoto = vi.fn();
  const view = wrap(
    <VisitPhotos
      appointmentId={VISIT}
      firstName="Dharti"
      open
      canPrivate={false}
      canEdit
      onOpenPhoto={onOpenPhoto}
      onEditPhoto={onEditPhoto}
      {...props}
    />,
  );
  return { ...view, onOpenPhoto, onEditPhoto };
}

const photosOfVisit = () =>
  clinicFixtures.patientImages.snapshot((image) => image.appointmentId === VISIT);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('VisitPhotos — locked until the patient is in (H:2796)', () => {
  it('says so, and offers "Check in now" when the visit can be checked in', async () => {
    const user = userEvent.setup();
    const onCheckIn = vi.fn();
    renderPhotos({ open: false, onCheckIn });
    const section = screen.getByTestId(IDS.photos);
    expect(section).toHaveTextContent(
      'Photos open once the patient is at the clinic · check them in first',
    );
    expect(within(section).queryByTestId(IDS.photosUpload)).not.toBeInTheDocument();
    await user.click(within(section).getByTestId(IDS.photosCheckIn));
    expect(onCheckIn).toHaveBeenCalledOnce();
  });

  it('offers no check-in when the visit cannot be checked in now', () => {
    renderPhotos({ open: false });
    expect(screen.queryByTestId(IDS.photosCheckIn)).not.toBeInTheDocument();
  });
});

describe('VisitPhotos — the visit’s photos (H:2797–2801)', () => {
  it('lists the photos with their album, opens one and its details', async () => {
    const user = userEvent.setup();
    const { onOpenPhoto, onEditPhoto, container } = renderPhotos();
    const tiles = await screen.findAllByTestId(IDS.photoTile);
    expect(tiles).toHaveLength(3);
    expect(screen.getByTestId(IDS.photos)).toHaveTextContent(
      '3 photos · they show in Dharti’s file under this visit',
    );
    const first = tiles[0]!;
    await user.click(within(first).getByRole('button', { name: /^Open / }));
    expect(onOpenPhoto).toHaveBeenCalledOnce();
    await user.click(within(first).getByRole('button', { name: 'Edit details' }));
    expect(onEditPhoto).toHaveBeenCalledWith(onOpenPhoto.mock.calls[0]?.[0]);
    expect(
      await axe(container, { rules: { region: { enabled: false } } }),
    ).toHaveNoViolations();
  });

  it('offers the Private album only to doctors and admins', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPhotos();
    const albums = screen.getByRole('radiogroup', { name: 'Album' });
    expect(
      within(albums)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['General', 'LHR']);
    await user.click(within(albums).getByRole('radio', { name: 'LHR' }));
    expect(within(albums).getByRole('radio', { name: 'LHR' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    unmount();
    renderPhotos({ canPrivate: true });
    expect(
      within(screen.getByRole('radiogroup', { name: 'Album' })).getByRole('radio', {
        name: 'Private',
      }),
    ).toBeInTheDocument();
  });

  it('files an uploaded image under the visit, in the album picked', async () => {
    const user = userEvent.setup();
    const { container } = renderPhotos();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Album' })).getByRole('radio', {
        name: 'LHR',
      }),
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    await user.upload(input, [
      new File(['a'], 'after.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'notes.pdf', { type: 'application/pdf' }),
    ]);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 photo attached to this visit'),
    );
    expect(photosOfVisit().find((photo) => photo.fileName === 'after.jpg')).toMatchObject(
      {
        album: 'lhr',
      },
    );
  });

  it('takes photos dropped on the card', async () => {
    renderPhotos();
    fireEvent.drop(screen.getByTestId(IDS.photos), {
      dataTransfer: { files: [new File(['c'], 'before.png', { type: 'image/png' })] },
    });
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 photo attached to this visit'),
    );
  });

  it('deletes a photo with a reason — the Undo brings it back', async () => {
    const user = userEvent.setup();
    renderPhotos();
    const tiles = await screen.findAllByTestId(IDS.photoTile);
    await user.click(within(tiles[0]!).getByTestId(IDS.photoDelete));
    const confirm = await screen.findByTestId(CONFIRM_TEST_IDS.dialog);
    expect(confirm).toHaveTextContent('Delete this photo?');
    await user.click(screen.getByTestId(confirmReasonTestId('duplicate')));
    await user.click(screen.getByTestId(CONFIRM_TEST_IDS.accept));
    await waitFor(() => expect(screen.getAllByTestId(IDS.photoTile)).toHaveLength(2));
    expect(photosOfVisit()).toHaveLength(2);
  });

  it('reads without Edit: no albums, no upload, no delete', async () => {
    renderPhotos({ canEdit: false });
    const tiles = await screen.findAllByTestId(IDS.photoTile);
    expect(screen.queryByRole('radiogroup', { name: 'Album' })).not.toBeInTheDocument();
    expect(screen.queryByTestId(IDS.photosUpload)).not.toBeInTheDocument();
    expect(within(tiles[0]!).queryByTestId(IDS.photoDelete)).not.toBeInTheDocument();
  });

  it('asks for the first photos while a visit has none', () => {
    renderPhotos({ appointmentId: ref.appointment(2861), firstName: 'Rhea' });
    expect(screen.getByTestId(IDS.photos)).toHaveTextContent(
      'Take before / after photos while Rhea is at the clinic · they file under this visit',
    );
  });
});

describe('NotPatientCard — step 3 (H:2795)', () => {
  it('offers "Create patient record" only to a member who may edit', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const { unmount } = wrap(<NotPatientCard onCreate={onCreate} />);
    const card = screen.getByTestId(IDS.notPatient);
    expect(card).toHaveTextContent('Not a patient yet');
    await user.click(within(card).getByTestId(IDS.createPatient));
    expect(onCreate).toHaveBeenCalledOnce();
    unmount();
    wrap(<NotPatientCard />);
    expect(screen.queryByTestId(IDS.createPatient)).not.toBeInTheDocument();
  });
});
