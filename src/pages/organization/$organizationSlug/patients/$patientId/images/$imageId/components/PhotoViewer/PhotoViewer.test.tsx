import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { photoDouble } from '../../../__tests__/integration/photo-api-double.ts';
import { PhotoViewer, type PhotoViewerProps } from './PhotoViewer.tsx';

const PHOTO = photoDouble({ caption: 'Left cheek', bodyPart: 'face' });

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
  it('shows the photo from its link with its name, line and place, the zoom group and hints (D86)', async () => {
    const { baseElement } = renderViewer({ onEdit: vi.fn(), onDelete: vi.fn() });
    const viewer = screen.getByTestId('patient-photo-viewer');
    expect(viewer).toHaveAttribute('data-surface', 'light-pinned');
    expect(screen.getByRole('dialog', { name: 'Left cheek' })).toBe(viewer);
    expect(viewer).toHaveTextContent('Face · 24 Sep · General');
    expect(viewer).toHaveTextContent('2 of 6');
    const stage = screen.getByTestId('patient-photo-viewer-stage');
    const image = stage.querySelector('img');
    expect(image).toHaveAttribute('src', PHOTO.fileUrl);
    expect(image).toHaveClass('object-contain');
    expect(screen.getByRole('group', { name: 'Zoom' })).toHaveTextContent('100%');
    expect(viewer).toHaveTextContent('← → browse');
    expect(viewer).toHaveTextContent('Scroll or + − zoom');
    expect(viewer).toHaveTextContent('Drag to move · double-click to reset');
    expect(viewer).toHaveTextContent('Esc close');
    expect(viewer).toHaveFocus();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('shows the file’s name in the image’s place when its link is gone', () => {
    renderViewer({ photo: { ...PHOTO, fileUrl: null } });
    const stage = screen.getByTestId('patient-photo-viewer-stage');
    expect(within(stage).getByText('IMG_5100.png')).toBeInTheDocument();
    expect(stage).toHaveTextContent('Preview not available');
    expect(stage.querySelector('img')).toBeNull();
  });

  it('zooms on the wheel, a double-click and the keys, and swaps the cursor once zoomed', () => {
    renderViewer();
    const viewer = screen.getByTestId('patient-photo-viewer');
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
    fireEvent.keyDown(viewer, { key: '0' });
    expect(zoom).toHaveTextContent('100%');
    fireEvent.keyDown(viewer, { key: '+' });
    expect(zoom).toHaveTextContent('125%');
    fireEvent.keyDown(viewer, { key: '-' });
    expect(zoom).toHaveTextContent('100%');
  });

  it('zooms with the group’s buttons, and its level resets', async () => {
    const user = userEvent.setup();
    renderViewer();
    const zoom = screen.getByTestId('patient-photo-viewer-zoom-reset');
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoom).toHaveTextContent('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoom).toHaveTextContent('100%');
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    await user.click(zoom);
    expect(zoom).toHaveTextContent('100%');
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
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowLeft' });
    expect(onStep).toHaveBeenLastCalledWith(-1);
    await user.click(screen.getByRole('button', { name: 'Close viewer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no ‹ › for a single photo or one not among those read, nor Edit and Delete for a member who can’t', () => {
    const { onStep, unmount } = renderViewer({ index: 0, total: 1 });
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-viewer-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-viewer-delete')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowRight' });
    expect(onStep).not.toHaveBeenCalled();
    unmount();
    renderViewer({ index: null, total: 6 });
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(screen.getByTestId('patient-photo-viewer')).not.toHaveTextContent('of 6');
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
