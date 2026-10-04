import { describe, expect, it } from 'vitest';

import { focusSurfaceOnOpen } from './focus-surface.ts';

describe('focusSurfaceOnOpen', () => {
  it('keeps Radix off the first control and focuses the surface itself', () => {
    const surface = document.createElement('div');
    surface.tabIndex = -1;
    const button = document.createElement('button');
    surface.append(button);
    document.body.append(surface);

    const event = new Event('focusOutside', { cancelable: true });
    surface.addEventListener('focusOutside', focusSurfaceOnOpen);
    surface.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(surface);
    surface.remove();
  });

  it('only prevents the default when the target is not an element', () => {
    const event = new Event('open', { cancelable: true });
    focusSurfaceOnOpen(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
