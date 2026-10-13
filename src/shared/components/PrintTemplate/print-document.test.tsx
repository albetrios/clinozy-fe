import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

import { printDocument, PRINTING_ATTRIBUTE } from './print-document.ts';
import {
  PRINT_OPEN_DELAY_MS,
  PRINT_TEMPLATE_TEST_IDS,
} from './print-template.constants.ts';

const host = () =>
  document.querySelector<HTMLElement>(`[data-testid="${PRINT_TEMPLATE_TEST_IDS.root}"]`);

/**
 * Ask for a print and let it load its copy (cached in tests) and render — the
 * render follows `ensureNamespace`'s promise by a few microtasks.
 */
async function startPrint(...sheets: ReactNode[]) {
  const printed: Promise<void>[] = [];
  await act(async () => {
    for (const sheet of sheets) printed.push(printDocument(sheet));
    for (let hop = 0; hop < 20; hop += 1) await Promise.resolve();
  });
  return printed;
}

/** Let the 260ms delay and the next frame pass. */
async function openDialog() {
  await act(async () => {
    vi.advanceTimersByTime(PRINT_OPEN_DELAY_MS);
    vi.advanceTimersToNextFrame();
  });
}

describe('printDocument', () => {
  let print: MockInstance<() => void>;

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
      ],
    });
    print = vi.spyOn(window, 'print').mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mounts the sheet in the print host and marks the page as printing', async () => {
    await startPrint(<section data-testid="invoice-print">INV-787</section>);
    expect(host()).toHaveAttribute('data-print-root');
    expect(host()?.parentElement).toBe(document.body);
    expect(host()).toContainElement(
      document.querySelector('[data-testid="invoice-print"]') as HTMLElement,
    );
    expect(document.documentElement).toHaveAttribute(PRINTING_ATTRIBUTE);
  });

  it('opens the print dialog 260ms after the sheet renders, on the next frame', async () => {
    await startPrint(<p>Rx #500</p>);
    await act(async () => {
      vi.advanceTimersByTime(PRINT_OPEN_DELAY_MS - 1);
    });
    expect(print).not.toHaveBeenCalled();
    await openDialog();
    expect(print).toHaveBeenCalledTimes(1);
    expect(host()).toHaveTextContent('Rx #500');
  });

  it('removes the sheet after printing', async () => {
    let printed = false;
    const [done] = await startPrint(<p>INV-787</p>);
    void done?.then(() => {
      printed = true;
    });
    await openDialog();
    await act(async () => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(host()).toBeNull();
    expect(document.documentElement).not.toHaveAttribute(PRINTING_ATTRIBUTE);
    expect(printed).toBe(true);
  });

  it('prints once when asked twice before the dialog opens', async () => {
    await startPrint(<p>first</p>, <p>second</p>);
    expect(document.querySelectorAll('[data-print-root]')).toHaveLength(1);
    await openDialog();
    expect(print).toHaveBeenCalledTimes(1);
    expect(host()).toHaveTextContent('second');
  });

  it('cleans up when the browser has no print dialog', async () => {
    print.mockImplementation(() => {
      throw new Error('Not implemented: window.print');
    });
    await startPrint(<p>INV-787</p>);
    await openDialog();
    expect(host()).toBeNull();
    expect(document.documentElement).not.toHaveAttribute(PRINTING_ATTRIBUTE);
  });
});
