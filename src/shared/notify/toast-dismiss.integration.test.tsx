import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppToaster } from './AppToaster.tsx';
import { notify } from './notify.ts';

/** Sonner has taken the toast over from the immediate host (which marks its own). */
async function sonnerToast(): Promise<HTMLElement> {
  let toast: HTMLElement | undefined;
  await waitFor(
    () => {
      toast = screen.getByTestId('app-toast');
      expect(toast).not.toHaveAttribute('data-toast-pending');
    },
    { timeout: 5000 },
  );
  return toast as HTMLElement;
}

describe('toast dismiss integration', () => {
  // Every toast is the design's bar: no close button, it leaves on its timer
  // or a swipe — except a toast with no timer, which carries a dismiss ×.
  afterEach(() => {
    act(() => {
      notify.dismiss();
    });
  });

  it('draws the bar without a close button for a timed toast', async () => {
    render(<AppToaster />);
    act(() => {
      notify.success('Saved');
    });
    const toast = await sonnerToast();
    expect(toast).toHaveTextContent('Saved');
    expect(screen.queryByTestId('toast-dismiss')).toBeNull();
  });

  it('dismisses a persistent toast on its ×, firing onDismiss once', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<AppToaster />);
    act(() => {
      notify.info('Update available', {
        id: 'update',
        duration: Number.POSITIVE_INFINITY,
        onDismiss,
      });
    });
    await sonnerToast();

    await user.click(screen.getByTestId('toast-dismiss'));

    await waitFor(
      () => expect(screen.queryByTestId('app-toast')).not.toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
