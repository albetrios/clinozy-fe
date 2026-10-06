import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog.tsx';

/**
 * Local changes to the shadcn dialog: it is the design's one centred dialog
 * frame (the command menu's, H:2669–2671) for every platform dialog — Settings,
 * create organization / role, invite, API key, webhooks, MFA, step-up.
 */
function renderDialog() {
  return render(
    <Dialog open>
      <DialogContent data-testid="dialog">
        <DialogHeader data-testid="header">
          <DialogTitle>Create an API key</DialogTitle>
          <DialogDescription>Name the key.</DialogDescription>
        </DialogHeader>
        <p>Body</p>
        <DialogFooter data-testid="footer">
          <button type="button">Cancel</button>
          <button type="button">Create</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe('Dialog', () => {
  it('draws the command menu’s frame: 12px corners over the .35 backdrop', () => {
    renderDialog();
    const dialog = screen.getByTestId('dialog');
    expect(dialog).toHaveClass(
      'rounded-xl',
      'border',
      'data-[state=open]:animate-dropdown-in',
    );
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toHaveClass('bg-overlay/35');
  });

  it('heads it with a hairline band in the drawer title’s type, aligned to the start', () => {
    renderDialog();
    const header = screen.getByTestId('header');
    // Flush with the frame (it undoes the content's p-6) and clear of the ×.
    expect(header).toHaveClass('-mx-6', '-mt-6', 'border-b', 'pe-12', 'text-start');
    expect(header.className).not.toMatch(/\btext-(left|center)\b/);
    expect(screen.getByRole('heading', { name: 'Create an API key' })).toHaveClass(
      'text-lg',
      'tracking-[-0.01em]',
    );
    expect(screen.getByText('Name the key.')).toHaveClass('text-body');
  });

  it('keeps its × above a pinned head row', () => {
    // The Settings pane's head row is `sticky z-10`; a z-auto close button
    // would paint beneath it and vanish.
    renderDialog();
    const close = screen.getByRole('button', { name: 'Close', exact: true });
    expect(close).toHaveClass('absolute', 'end-4', 'top-4', 'z-20');
  });

  it('ends it with the canvas footer band, actions at the inline end', () => {
    renderDialog();
    expect(screen.getByTestId('footer')).toHaveClass(
      'bg-canvas',
      'border-t',
      '-mb-6',
      'justify-end',
      'rounded-b-xl',
    );
  });

  it('has no accessibility violations', async () => {
    renderDialog();
    expect(await axeForDialog(screen.getByTestId('dialog'))).toHaveNoViolations();
  });
});
