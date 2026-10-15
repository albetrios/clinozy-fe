import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pastedImages, usePhotoPaste } from './usePhotoPaste.ts';

const jpg = new File(['x'], 'cheek.jpg', { type: 'image/jpeg' });
const text = new File(['x'], 'notes.txt', { type: 'text/plain' });

/** A paste event carrying `files`, sent to `target`. */
function paste(files: File[], target: EventTarget = document.body): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: { files } as unknown as DataTransfer,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('pastedImages', () => {
  it('keeps the image files only', () => {
    expect(pastedImages({ files: [jpg, text] } as unknown as DataTransfer)).toEqual([
      jpg,
    ]);
    expect(pastedImages(null)).toEqual([]);
  });
});

describe('usePhotoPaste', () => {
  it('hands a pasted image to onFiles and takes the paste', () => {
    const onFiles = vi.fn();
    renderHook(() => usePhotoPaste(onFiles));
    const event = paste([jpg, text]);
    expect(onFiles).toHaveBeenCalledWith([jpg]);
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a paste without an image alone', () => {
    const onFiles = vi.fn();
    renderHook(() => usePhotoPaste(onFiles));
    const event = paste([text]);
    expect(onFiles).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('leaves a paste into a field to the field', () => {
    const onFiles = vi.fn();
    renderHook(() => usePhotoPaste(onFiles));
    const input = document.createElement('input');
    document.body.append(input);
    paste([jpg], input);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('stands down while a dialog is open', () => {
    const onFiles = vi.fn();
    renderHook(() => usePhotoPaste(onFiles));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    paste([jpg]);
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('is off without onFiles and stops listening once unmounted', () => {
    const onFiles = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ handler }: { handler: ((files: readonly File[]) => void) | null }) =>
        usePhotoPaste(handler),
      { initialProps: { handler: null as ((files: readonly File[]) => void) | null } },
    );
    paste([jpg]);
    expect(onFiles).not.toHaveBeenCalled();
    rerender({ handler: onFiles });
    paste([jpg]);
    expect(onFiles).toHaveBeenCalledTimes(1);
    unmount();
    paste([jpg]);
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});
