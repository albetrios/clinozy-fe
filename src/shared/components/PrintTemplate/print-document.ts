import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import {
  PRINT_OPEN_DELAY_MS,
  PRINT_TEMPLATE_TEST_IDS,
} from './print-template.constants.ts';

/** On `<html>` while a document prints: `index.css` then shows only the print host. */
export const PRINTING_ATTRIBUTE = 'data-printing';

/** The print-only host a sheet renders into — never shown on screen (`index.css`). */
const PRINT_HOST_ATTRIBUTE = 'data-print-root';

let cancelCurrent: (() => void) | null = null;

/**
 * Print one document (KICKOFF §3.5, H:4423): render `sheet` — an
 * `InvoicePrint` or `PrescriptionPrint` — into a print-only host at the end of
 * `<body>`, open the browser's print dialog 260ms later on the next frame, and
 * remove the host on `afterprint`. While it prints, the page is the sheet alone,
 * on A4 with no margins.
 *
 * The host is its own React root, so the sheet gets every record as props; its
 * copy and formats come from the global i18n instance and the locale store.
 * A second call replaces a print whose dialog has not opened yet, so a double
 * click prints once. Resolves when the host is gone.
 */
export function printDocument(sheet: ReactNode): Promise<void> {
  cancelCurrent?.();
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute(PRINT_HOST_ATTRIBUTE, '');
    host.setAttribute('data-testid', PRINT_TEMPLATE_TEST_IDS.root);
    document.body.append(host);
    const root = createRoot(host);
    flushSync(() => root.render(sheet));
    document.documentElement.setAttribute(PRINTING_ATTRIBUTE, '');

    let timer = 0;
    let frame = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', finish);
      document.documentElement.removeAttribute(PRINTING_ATTRIBUTE);
      root.unmount();
      host.remove();
      if (cancelCurrent === finish) cancelCurrent = null;
      resolve();
    };
    cancelCurrent = finish;
    window.addEventListener('afterprint', finish);
    timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(() => {
        try {
          window.print();
        } catch {
          // No print dialog here (an embedded view): nothing will print.
          finish();
        }
      });
    }, PRINT_OPEN_DELAY_MS);
  });
}
