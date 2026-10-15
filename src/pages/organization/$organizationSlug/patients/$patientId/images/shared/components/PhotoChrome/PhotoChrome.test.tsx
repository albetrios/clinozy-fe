import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PhotoRoundButton, PhotoZoomGroup } from './PhotoChrome.tsx';

const TEST_IDS = { zoomOut: 'zoom-out', zoomReset: 'zoom-reset', zoomIn: 'zoom-in' };

describe('PhotoChrome', () => {
  it('names the round button and runs it', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <PhotoRoundButton
        label="Close viewer"
        hint="Close (Esc)"
        onClick={onClick}
        testId="close"
      >
        ×
      </PhotoRoundButton>,
    );
    const button = screen.getByRole('button', { name: 'Close viewer' });
    expect(button).toHaveAttribute('title', 'Close (Esc)');
    expect(button).toHaveAttribute('data-slot', 'pill');
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('turns destructive on hover for Delete', () => {
    render(
      <PhotoRoundButton
        label="Delete photo"
        hint="Delete photo"
        onClick={vi.fn()}
        danger
        testId="delete"
      >
        ×
      </PhotoRoundButton>,
    );
    expect(screen.getByTestId('delete').className).toContain('hover:bg-destructive');
  });

  it('zooms out, resets at the level and zooms in, under the test ids it is given', async () => {
    const user = userEvent.setup();
    const handlers = { onZoomIn: vi.fn(), onZoomOut: vi.fn(), onReset: vi.fn() };
    const { container } = render(
      <PhotoZoomGroup level={1.25} testIds={TEST_IDS} {...handlers} />,
    );
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    await user.click(screen.getByTestId('zoom-reset'));
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(handlers.onZoomOut).toHaveBeenCalled();
    expect(handlers.onReset).toHaveBeenCalled();
    expect(handlers.onZoomIn).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a glass pill on a photo, named for it, on every screen (variant panel)', () => {
    render(
      <PhotoZoomGroup
        level={2}
        testIds={TEST_IDS}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onReset={vi.fn()}
        variant="panel"
        label="Zoom of IMG_5100"
      />,
    );
    const group = screen.getByRole('group', { name: 'Zoom of IMG_5100' });
    expect(group).toHaveAttribute('data-slot', 'pill');
    expect(group.className).not.toContain('max-md:hidden');
    expect(screen.getByTestId('zoom-reset')).toHaveTextContent('200%');
  });

  it('is hidden on a phone in the bar (the pinch zooms)', () => {
    render(
      <PhotoZoomGroup
        level={1}
        testIds={TEST_IDS}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    const group = screen.getByRole('group', { name: 'Zoom' });
    expect(group.className).toContain('max-md:hidden');
    expect(group).not.toHaveAttribute('data-slot');
  });
});
