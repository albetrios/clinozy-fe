import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEscapeLayer } from './useEscapeLayer.ts';

/** A surface outside the Radix stack, open while it has an `onEscape`. */
function Surface({ onEscape }: { onEscape?: () => void }) {
  useEscapeLayer(onEscape);
  return null;
}

/** A `<body>` child with a focusable control — a portal, as Radix mounts its layers. */
function portal(): { container: HTMLDivElement; control: HTMLButtonElement } {
  const container = document.createElement('div');
  const control = document.createElement('button');
  container.append(control);
  document.body.append(container);
  return { container, control };
}

/** A listener where Radix's `useEscapeKeydown` listens: the document, capture phase. */
const layerUnder = vi.fn();

beforeEach(() => {
  layerUnder.mockReset();
  document.addEventListener('keydown', layerUnder, true);
});
afterEach(() => {
  document.removeEventListener('keydown', layerUnder, true);
});

describe('useEscapeLayer', () => {
  it('takes Esc before the layers under it hear the key, and marks it handled', () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(layerUnder).not.toHaveBeenCalled();
  });

  it('lets every other key through, and Esc too once the surface is closed', () => {
    const onEscape = vi.fn();
    const { rerender } = render(<Surface onEscape={onEscape} />);
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(layerUnder).toHaveBeenCalledOnce();
    rerender(<Surface />);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
    expect(layerUnder).toHaveBeenCalledTimes(2);
  });

  it('answers from the newest of two open surfaces, once', () => {
    const older = vi.fn();
    const newer = vi.fn();
    render(
      <>
        <Surface onEscape={older} />
        <Surface onEscape={newer} />
      </>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(newer).toHaveBeenCalledOnce();
    expect(older).not.toHaveBeenCalled();
  });

  it('takes Esc from the focus in what was open under it — the drawer it covers', () => {
    const drawer = portal();
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    fireEvent.keyDown(drawer.control, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledOnce();
    expect(layerUnder).not.toHaveBeenCalled();
    drawer.container.remove();
  });

  it('leaves Esc to a layer opened over it, which holds the focus', () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    const select = portal();
    fireEvent.keyDown(select.control, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
    expect(layerUnder).toHaveBeenCalledOnce();
    select.container.remove();
  });
});
