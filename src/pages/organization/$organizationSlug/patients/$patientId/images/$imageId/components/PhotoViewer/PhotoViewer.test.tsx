import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { PatientPhoto } from '@/shared/api/clinic/patient-images-api.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { PhotoViewer, type PhotoViewerProps } from './PhotoViewer.tsx';

const PHOTO: PatientPhoto = {
  id: 'p1',
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
  fileUrl: 'organizations/o1/files/p1.jpg',
  fileName: 'IMG_5100',
  bodyPart: 'face',
  takenOn: '2026-09-24',
  caption: 'Left cheek',
  visit: null,
};

function renderViewer(props: Partial<PhotoViewerProps> = {}) {
  const handlers = { onStep: vi.fn(), onClose: vi.fn() };
  const view = render(
    <PhotoViewer
      photo={PHOTO}
      index={1}
      total={6}
      meta="Face · 24 Sep · General"
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

describe('PhotoViewer', () => {
  it('shows the photo’s name, its line and place, with the zoom group and hints', async () => {
    const { baseElement } = renderViewer({ onEdit: vi.fn(), onDelete: vi.fn() });
    const viewer = screen.getByTestId('patient-photo-viewer');
    expect(viewer).toHaveAttribute('data-surface', 'light-pinned');
    expect(screen.getByRole('dialog', { name: 'Left cheek' })).toBe(viewer);
    expect(viewer).toHaveTextContent('Face · 24 Sep · General');
    expect(viewer).toHaveTextContent('2 of 6');
    expect(screen.getByRole('group', { name: 'Zoom' })).toHaveTextContent('100%');
    expect(viewer).toHaveTextContent('Sample photo · no file attached');
    expect(viewer).toHaveTextContent('Esc close');
    expect(viewer).toHaveFocus();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('steps with ‹ › and ← →, and closes with × and Esc', async () => {
    const user = userEvent.setup();
    const { onStep, onClose } = renderViewer();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(onStep).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Previous photo' }));
    expect(onStep).toHaveBeenLastCalledWith(-1);
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowRight' });
    expect(onStep).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no ‹ › for a single photo, nor Edit and Delete for a member who can’t', () => {
    const { onStep } = renderViewer({ index: 0, total: 1 });
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-viewer-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-viewer-delete')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowRight' });
    expect(onStep).not.toHaveBeenCalled();
  });

  it('zooms on the wheel and a double-click, and swaps the cursor once zoomed', () => {
    renderViewer();
    const stage = screen.getByTestId('patient-photo-viewer-stage');
    const zoom = screen.getByTestId('patient-photo-viewer-zoom-reset');
    expect(stage).toHaveClass('cursor-zoom-in');
    fireEvent.wheel(stage, { deltaY: -100 });
    expect(zoom).toHaveTextContent('112%');
    fireEvent.doubleClick(stage);
    expect(zoom).toHaveTextContent('100%');
    fireEvent.doubleClick(stage);
    expect(zoom).toHaveTextContent('200%');
    expect(stage).toHaveClass('cursor-grab');
  });

  it('edits and deletes the photo', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderViewer({ onEdit, onDelete });
    await user.click(screen.getByRole('button', { name: 'Edit details' }));
    await user.click(screen.getByRole('button', { name: 'Delete photo' }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
