import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('has no accessibility violations', async () => {
    const { baseElement } = render(<ConfirmDialog {...base} />);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
