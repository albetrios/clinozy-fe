import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';
import { TOAST_VARIANTS } from '@/shared/theme/index.ts';

import { AppToaster } from './AppToaster.tsx';
import { notify } from './notify.ts';

describe('toast dismiss integration', () => {
  // The platform designs carry a close button; the clinic bar (the default
  // preset's toast) has none, by design, and leaves on its timer or a swipe.
  beforeEach(() => {
    useThemeStore.setState({ toastVariant: TOAST_VARIANTS.indexOf('tint') });
  });

  afterEach(() => {
    act(() => {
      notify.dismiss();
    });
  });

  it('dismisses when the close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppToaster />);

    act(() => {
      notify.success('Hello');
    });

    // Wait for Sonner to take the toast over from the immediate host: a click
    // on the host's button during that handoff lands on a node being removed.
    await waitFor(
      () =>
        expect(screen.getByTestId('app-toast')).toHaveAttribute(
          'data-toast-variant',
          'tint',
        ),
      { timeout: 5000 },
    );

    await user.click(screen.getByTestId('toast-dismiss'));

    await waitFor(
      () => expect(screen.queryByTestId('app-toast')).not.toBeInTheDocument(),
      {
        timeout: 5000,
      },
    );
  });

  it('draws the clinic bar without a close button', async () => {
    useThemeStore.setState({ toastVariant: TOAST_VARIANTS.indexOf('bar') });
    render(<AppToaster />);
    act(() => {
      notify.success('Saved');
    });
    const toast = await screen.findByTestId('app-toast', undefined, { timeout: 5000 });
    expect(toast).toHaveAttribute('data-toast-variant', 'bar');
    expect(screen.queryByTestId('toast-dismiss')).toBeNull();
  });
});
