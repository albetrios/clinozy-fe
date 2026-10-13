import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const { dismissMock } = vi.hoisted(() => ({ dismissMock: vi.fn() }));
vi.mock('sonner', () => ({ toast: { dismiss: dismissMock } }));

import { CustomToast } from './CustomToast.tsx';

describe('CustomToast', () => {
  it('draws the design bar: the title and description, no icon, no ×', async () => {
    const { container } = render(
      <CustomToast id="t1" type="success" title="Saved" description="All good" />,
    );
    const el = screen.getByTestId('app-toast');
    expect(el).toHaveTextContent('Saved · All good');
    expect(el).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(el.querySelector('svg')).toBeNull();
    expect(screen.queryByTestId('toast-dismiss')).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a persistent toast gets the dismiss ×, which dismisses its own id', async () => {
    // The caller's onDismiss rides on the Sonner toast, which fires it on this
    // dismiss — the surface only asks Sonner to let go of the toast.
    const user = userEvent.setup();
    dismissMock.mockReset();
    const { container } = render(
      <CustomToast
        id="update"
        type="info"
        title="Update available"
        persistent
        action={{ label: 'Refresh now', onClick: vi.fn() }}
      />,
    );
    const dismiss = screen.getByTestId('toast-dismiss');
    expect(dismiss).toHaveAccessibleName('Dismiss notification');
    await user.click(dismiss);
    expect(dismissMock).toHaveBeenCalledExactlyOnceWith('update');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('dismisses its OWN id right after running the inline action', async () => {
    // The mechanism behind the deferred-commit bug: whatever the action does,
    // the toast that carried it is torn down immediately afterwards. Anything
    // the action writes back to THIS id therefore disappears with it — which is
    // why `notifyDeferredCommit` gives its "Undone" toast an id of its own.
    const user = userEvent.setup();
    const order: string[] = [];
    dismissMock.mockImplementation((id: string) => order.push(`dismiss:${id}`));
    render(
      <CustomToast
        id="deferred-commit"
        type="success"
        title="Removing Jo…"
        action={{ label: 'Undo', onClick: () => order.push('action') }}
      />,
    );

    await user.click(screen.getByTestId('toast-action'));

    expect(order).toEqual(['action', 'dismiss:deferred-commit']);
    dismissMock.mockReset();
  });

  it('a loading toast shows its text with neither an action nor a ×', () => {
    render(
      <CustomToast
        id="t4"
        type="loading"
        title="Saving…"
        persistent
        action={{ label: 'Undo', onClick: vi.fn() }}
      />,
    );
    expect(screen.getByTestId('app-toast')).toHaveTextContent('Saving…');
    expect(screen.queryByTestId('toast-action')).toBeNull();
    expect(screen.queryByTestId('toast-dismiss')).toBeNull();
  });
});
