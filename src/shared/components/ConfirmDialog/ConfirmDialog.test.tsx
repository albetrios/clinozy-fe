import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { ConfirmDialog } from './ConfirmDialog.tsx';

const base = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Delete role?',
  description: 'This action cannot be undone.',
  onConfirm: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders the title + description when open', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete role?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('stays the centred alert dialog without `reason`', () => {
    render(<ConfirmDialog {...base} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Delete role?' });
    expect(dialog).toBe(screen.getByTestId('confirm-dialog'));
    expect(dialog).not.toHaveAttribute('data-layout');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
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

  it('confirms once for a double click that lands before the re-render', async () => {
    let release!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<ConfirmDialog {...base} onConfirm={onConfirm} />);
    const accept = screen.getByTestId('confirm-accept');

    await act(async () => {
      accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      accept.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
    });
  });

  it('returns focus to what was focused when it opened', async () => {
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
  });

  it('has no accessibility violations', async () => {
    const { baseElement } = render(<ConfirmDialog {...base} />);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
