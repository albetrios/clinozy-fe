import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { QuickLineParse } from './quick-line.types.ts';
import { QuickLine } from './QuickLine.tsx';

/** Where the line's row stands: every element in it is laid out there. */
const ROW = { x: 40, y: 100, width: 700, height: 44 };

/** A 1440 × 900 viewport — jsdom's is 0 × 0, which would clamp every placement. */
function stubViewport() {
  const html = document.documentElement;
  vi.spyOn(html, 'clientWidth', 'get').mockReturnValue(1440);
  vi.spyOn(html, 'clientHeight', 'get').mockReturnValue(900);
}

/** Where an element stands: the page itself fills the viewport; a detached one is nowhere. */
function placeOf(element: HTMLElement) {
  if (element === document.documentElement || element === document.body) {
    return { x: 0, y: 0, width: 1440, height: 900 };
  }
  return element.isConnected ? ROW : { x: 0, y: 0, width: 0, height: 0 };
}

/** Every connected element at the row, in a 1440 × 900 viewport. */
function stubLayout() {
  stubViewport();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function rect(this: HTMLElement) {
      const { x, y, width, height } = placeOf(this);
      return {
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      };
    },
  );
}

const parse = (text: string): QuickLineParse<object> => ({
  words: text.split(/\s+/).filter(Boolean),
  tags: [],
  values: {},
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QuickLine under Strict Mode (main.tsx mounts the app in it)', () => {
  it('anchors the Browse panel to the row, not to the button its remount detached', async () => {
    stubLayout();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <QuickLine<string, object>
          placeholder="Type medicine and qty"
          parse={parse}
          matches={() => []}
          onPick={() => undefined}
          browse={{
            groups: [{ id: 'all', label: 'All' }],
            tiles: () => [],
            count: () => 0,
            added: 0,
            onStep: () => undefined,
          }}
          testId="line"
        />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Browse all' }));
    const panel = await screen.findByTestId('line-browse-panel');
    const wrapper = panel.parentElement as HTMLElement;
    // Under the row's start, 6px below it — never pinned to the viewport's corner.
    await waitFor(() => expect(wrapper.style.transform).toBe('translate(40px, 150px)'));
    // The panel takes the row's width (`w-(--radix-popover-trigger-width)`).
    expect(wrapper.style.getPropertyValue('--radix-popper-anchor-width')).toBe('700px');
  });
});
