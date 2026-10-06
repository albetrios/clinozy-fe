import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import { ConfirmDialog } from './ConfirmDialog.tsx';
import { isConfirmedWriteRunning } from './confirmed-write.ts';

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Delete role?',
  description: 'This action cannot be undone.',
  onConfirm: vi.fn(),
};

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('ConfirmDialog', () => {
  it('renders the title + description when open', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete role?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('carries a surface’s own test ids when it names them', () => {
    render(
      <ConfirmDialog
        {...base}
        testIds={{ dialog: 'billing-cancel-dialog', accept: 'billing-cancel-confirm' }}
      />,
    );
    expect(screen.getByTestId('billing-cancel-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('billing-cancel-confirm')).toHaveTextContent('Confirm');
    // A role the surface does not name keeps the shared id.
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Cancel');
  });

  it.each(['desktop', 'tablet'] as const)(
    'takes the reason confirm’s frame without `reason`: the end panel on %s',
    (tier) => {
      viewport.tier = tier;
      render(<ConfirmDialog {...base} />);
      const dialog = screen.getByRole('alertdialog', { name: 'Delete role?' });
      expect(dialog).toBe(screen.getByTestId('confirm-dialog'));
      expect(dialog).toHaveAttribute('data-layout', 'panel');
      expect(dialog).toHaveAccessibleDescription('This action cannot be undone.');
      expect(screen.getByTestId('confirm-close')).toHaveAccessibleName('Close');
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    },
  );

  it('is the bottom sheet on a phone, as the reason confirm is', () => {
    viewport.tier = 'phone';
    render(<ConfirmDialog {...base} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete role?' });
    expect(dialog).toBe(screen.getByTestId('confirm-dialog'));
    expect(dialog).toHaveAttribute('data-layout', 'sheet');
    expect(dialog).toHaveAttribute('data-vaul-drawer-direction', 'bottom');
    expect(screen.getByTestId('confirm-close')).toHaveAccessibleName('Close');
  });

  it.each(['desktop', 'phone'] as const)('starts on Cancel (%s)', async (tier) => {
    viewport.tier = tier;
    render(<ConfirmDialog {...base} />);
    await waitFor(() => expect(screen.getByTestId('confirm-cancel')).toHaveFocus());
  });

  it('keeps the destructive action red', () => {
    render(<ConfirmDialog {...base} destructive confirmLabel="Delete" />);
    expect(screen.getByTestId('confirm-accept')).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('the backdrop, the ×, Cancel and Esc all dismiss it', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} onOpenChange={onOpenChange} />);

    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]');
    expect(overlay).not.toBeNull();
    await user.click(overlay as Element);
    await user.click(screen.getByTestId('confirm-close'));
    await user.click(screen.getByTestId('confirm-cancel'));
    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledTimes(4);
    expect(onOpenChange.mock.calls.every(([open]) => open === false)).toBe(true);
    expect(base.onConfirm).not.toHaveBeenCalled();
  });

  it('labels its buttons and fallback description from the locale', () => {
    render(<ConfirmDialog {...base} description={undefined} />);
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Cancel');
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Confirm');
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      'Please confirm this action.',
    );
  });

  it('confirms and closes on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onOpenChange={onOpenChange} />);

    await user.click(screen.getByTestId('confirm-accept'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('stays open when confirm rejects (caller surfaces the error)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('nope'));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onOpenChange={onOpenChange} />);

    await user.click(screen.getByTestId('confirm-accept'));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it.each(['desktop', 'phone'] as const)(
    'confirms once for a double click that lands before the re-render, and holds every exit meanwhile (%s)',
    async (tier) => {
      viewport.tier = tier;
      let release!: () => void;
      const onConfirm = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      const onOpenChange = vi.fn();
      const user = userEvent.setup();
      render(
        <ConfirmDialog {...base} onConfirm={onConfirm} onOpenChange={onOpenChange} />,
      );
      const accept = screen.getByTestId('confirm-accept');

      await act(async () => {
        accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('confirm-dialog')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
      expect(screen.getByTestId('confirm-close')).toBeDisabled();
      await user.keyboard('{Escape}');
      expect(onOpenChange).not.toHaveBeenCalled();

      await act(async () => {
        release();
      });
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false));
    },
  );

  it.each(['desktop', 'phone'] as const)(
    'returns focus to what was focused when it opened (%s)',
    async (tier) => {
      viewport.tier = tier;
      const user = userEvent.setup();
      function Opener() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Remove member
            </button>
            <ConfirmDialog {...base} open={open} onOpenChange={setOpen} />
          </>
        );
      }
      render(<Opener />);
      const opener = screen.getByRole('button', { name: 'Remove member' });

      await user.click(opener);
      await user.click(await screen.findByTestId('confirm-cancel'));

      await waitFor(() => expect(opener).toHaveFocus());
    },
  );

  it.each(['desktop', 'phone'] as const)(
    'has no accessibility violations (%s)',
    async (tier) => {
      viewport.tier = tier;
      const { baseElement } = render(<ConfirmDialog {...base} />);
      expect(await axeForDialog(baseElement)).toHaveNoViolations();
    },
  );

  it('marks its write as running for exactly as long as onConfirm runs (L-64)', async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    const onConfirm = vi.fn(async () => {
      seen.push(isConfirmedWriteRunning());
      await Promise.resolve();
      seen.push(isConfirmedWriteRunning());
    });
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);
    expect(isConfirmedWriteRunning()).toBe(false);
    await user.click(screen.getByTestId('confirm-accept'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(isConfirmedWriteRunning()).toBe(false));
    expect(seen).toEqual([true, true]);
  });

  it('ends the running write when onConfirm fails, too', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog {...base} onConfirm={() => Promise.reject(new Error('nope'))} />,
    );
    await user.click(screen.getByTestId('confirm-accept'));
    await waitFor(() => expect(screen.getByTestId('confirm-accept')).toBeEnabled());
    expect(isConfirmedWriteRunning()).toBe(false);
  });
});
