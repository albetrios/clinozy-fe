import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { type ReactNode, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmPanel } from '@/shared/components/ConfirmDialog/index.ts';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/shared/components/ui/drawer.tsx';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/shared/components/ui/sheet.tsx';

import { AppToaster } from './AppToaster.tsx';
import { notify } from './notify.ts';

// From `md` the confirm is the end panel (an alert dialog); below it, the
// bottom sheet the table already covers.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
}));

/**
 * Toasts are the top layer (KICKOFF L-20): above every drawer, sheet and the
 * confirm panel — the prototype's z 50 left them under its drawers and sheets
 * (§7.3) — and still usable there: "Retry" on a failed save is pressed while the
 * drawer holding the draft is open, and that press must not dismiss the drawer.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
/** Sonner's toaster `z-index` — the host it renders into, and the immediate host's `z-[…]`. */
const TOAST_LAYER = 999_999_999;

/** Every `.tsx` under `src/`, tests aside. */
function sourceFiles(dir = join(ROOT, 'src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

/**
 * A layer's z-index: computed when a stylesheet declares it (Sonner injects
 * its own), else read off the Tailwind utility — jsdom compiles no Tailwind.
 */
function zIndexOf(element: Element): number {
  const computed = Number.parseInt(getComputedStyle(element).zIndex, 10);
  if (Number.isFinite(computed)) return computed;
  const utility = /(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?=\s|$)/.exec(
    element.getAttribute('class') ?? '',
  );
  return Number(utility?.[1] ?? utility?.[2] ?? Number.NaN);
}

/** The confirm frame at `md` and up: the end panel, "Keep it" focused. */
function ConfirmOverlay({ onOpenChange }: { onOpenChange: () => void }) {
  const keepRef = useRef<HTMLButtonElement>(null);
  return (
    <ConfirmPanel
      open
      onDismiss={onOpenChange}
      title="Delete this lead?"
      description={<p>Priya Shah · #2363</p>}
      initialFocusRef={keepRef}
      testId="confirm"
      footer={() => (
        <button ref={keepRef} type="button">
          Keep it
        </button>
      )}
    />
  );
}

afterEach(() => {
  act(() => {
    notify.dismiss();
  });
});

describe('toasts are the top layer', () => {
  it('no surface in the app declares a z-index at or above the toasts', () => {
    const sonnerCss = readFileSync(
      join(ROOT, 'node_modules/sonner/dist/styles.css'),
      'utf8',
    );
    const toaster = /\[data-sonner-toaster\]\s*\{([^}]*)\}/.exec(sonnerCss)?.[1] ?? '';
    expect(Number(/z-index:\s*(\d+)/.exec(toaster)?.[1])).toBe(TOAST_LAYER);

    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const where = relative(ROOT, file);
      // The toast hosts themselves sit AT the layer, by definition.
      if (where.startsWith('src/shared/notify/')) continue;
      for (const match of readFileSync(file, 'utf8').matchAll(
        /\bz-(?:\[(\d+)\]|(\d+))/g,
      )) {
        const z = Number(match[1] ?? match[2]);
        if (z >= TOAST_LAYER) offenders.push(`${where}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /** Each modal surface the app opens, by the role it takes. */
  const overlays: Record<
    string,
    {
      role: 'dialog' | 'alertdialog';
      Overlay: (props: { onOpenChange: () => void }) => ReactNode;
    }
  > = {
    'drawer (end sheet)': {
      role: 'dialog',
      Overlay: ({ onOpenChange }) => (
        <Sheet open onOpenChange={onOpenChange}>
          <SheetContent>
            <SheetTitle>New lead</SheetTitle>
            <SheetDescription>Enquiry details</SheetDescription>
          </SheetContent>
        </Sheet>
      ),
    },
    'bottom sheet': {
      role: 'dialog',
      Overlay: ({ onOpenChange }) => (
        <Drawer open onOpenChange={onOpenChange}>
          <DrawerContent>
            <DrawerTitle>Pick a doctor</DrawerTitle>
            <DrawerDescription>Doctors on shift</DrawerDescription>
          </DrawerContent>
        </Drawer>
      ),
    },
    'confirm panel': { role: 'alertdialog', Overlay: ConfirmOverlay },
  };

  it.each(Object.entries(overlays))(
    'a toast over an open %s sits above it, stays exposed and its action leaves it open',
    async (_name, { role, Overlay }) => {
      // jsdom applies no Tailwind, so it cannot see the toast's
      // `pointer-events-auto` (asserted below) under the modal's
      // `pointer-events: none` on <body>; the real browser can.
      const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
      const onOpenChange = vi.fn();
      const retry = vi.fn();
      render(<AppToaster />);
      render(<Overlay onOpenChange={onOpenChange} />);
      const overlay = screen.getByRole(role);

      act(() => {
        notify.error('Couldn’t save · connection dropped.', {
          id: 'save-failed',
          action: { label: 'Retry', onClick: retry },
        });
      });
      await waitFor(
        () =>
          expect(
            screen
              .getByText('Couldn’t save · connection dropped.')
              .closest('[data-sonner-toast]'),
          ).not.toBeNull(),
        { timeout: 5000 },
      );
      const toast = screen
        .getByText('Couldn’t save · connection dropped.')
        .closest('[data-sonner-toast]') as HTMLElement;
      const toaster = toast.closest('[data-sonner-toaster]') as HTMLElement;

      // Above: the toaster outranks the overlay's own layer.
      expect(zIndexOf(toaster)).toBe(TOAST_LAYER);
      expect(zIndexOf(toaster)).toBeGreaterThan(zIndexOf(overlay));
      // Exposed: the modal hides everything else from assistive tech, not the toasts.
      expect(toast.closest('[aria-hidden="true"]')).toBeNull();
      expect(toast).toHaveClass('pointer-events-auto');

      // A press on the toast itself — reading it, starting a swipe — is not the
      // overlay's outside press: the drawer and its draft stay.
      await user.click(screen.getByText('Couldn’t save · connection dropped.'));
      expect(onOpenChange).not.toHaveBeenCalled();
      // Usable: "Retry" runs, and the drawer is still there.
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(retry).toHaveBeenCalledOnce();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole(role)).toBe(overlay);
    },
  );
});
