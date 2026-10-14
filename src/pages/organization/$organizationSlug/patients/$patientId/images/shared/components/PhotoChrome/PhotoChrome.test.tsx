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
});
