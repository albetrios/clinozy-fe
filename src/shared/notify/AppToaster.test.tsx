import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { toasterMock, toastMock, transport } = vi.hoisted(() => ({
  toasterMock: vi.fn(() => null),
  toastMock: { custom: vi.fn(), promise: vi.fn(), dismiss: vi.fn() },
  transport: { attempts: 0, release: undefined as (() => void) | undefined },
}));
vi.mock('sonner', () => ({ Toaster: toasterMock, toast: toastMock }));
vi.mock('./notify-runtime.tsx', async (importOriginal) => {
  transport.attempts += 1;
  if (transport.attempts === 1) {
    await new Promise<void>((resolve) => {
      transport.release = resolve;
    });
    throw new Error('Renderer unavailable');
  }
  return importOriginal();
});

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

import { AppToaster } from './AppToaster.tsx';
import { notify } from './notify.ts';

/**
 * The toast stack's bottom edge: 16px over the phone's bottom stack — the tab
 * bar, a notice pill, a floating "New" (`index.css`, D30) — and the safe area.
 */
const BOTTOM_EDGE =
  'calc(1rem + var(--floating-bottom-offset, 0rem) + var(--floating-notice-height, 0rem) + var(--floating-fab-height, 0rem) + env(safe-area-inset-bottom, 0rem))';
const squash = (value: string) => value.replaceAll(/\s+/g, '');

afterEach(() => {
  act(() => {
    notify.dismiss();
  });
});

describe('AppToaster', () => {
  it('shows actionable messages during a delayed or failed load and retries on new work', async () => {
    const user = userEvent.setup();
    useThemeStore.getState().setToastPosition('bottom-center');
    render(<AppToaster />);
    expect(transport.attempts).toBe(0);
    expect(toasterMock).not.toHaveBeenCalled();

    const undo = vi.fn();
    const onDismiss = vi.fn();
    act(() => {
      notify.error('Could not save', {
        id: 'save',
        action: { label: 'Undo', onClick: undo },
        onDismiss,
      });
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
    // The immediate host sits where Sonner will: 16px over the phone's bottom
    // stack, the width less 12px a side below `sm`, above every overlay.
    const host = screen.getByRole('alert').closest('section');
    expect(host).toHaveClass(
      `bottom-[${squash(BOTTOM_EDGE)}]`,
      'w-[calc(100vw-1.5rem)]',
      'sm:w-[min(100vw-2rem,20rem)]',
      'z-[999999999]',
    );
    await waitFor(() => expect(transport.release).toBeDefined());
    await act(async () => {
      transport.release?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText('Could not save')).toBeVisible();
    await user.click(screen.getByTestId('toast-action'));
    expect(undo).toHaveBeenCalledOnce();
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      notify.info('Next message');
    });
    await waitFor(() =>
      expect(toasterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          position: 'bottom-center',
          // The platform keeps a stack of four; a toast that names no lifetime gets 5.2s.
          visibleToasts: 4,
          duration: 5200,
          offset: { bottom: BOTTOM_EDGE },
          mobileOffset: { bottom: BOTTOM_EDGE, left: '0.75rem', right: '0.75rem' },
        }),
        undefined,
      ),
    );
    expect(transport.attempts).toBe(2);
    expect(toastMock.custom).toHaveBeenCalledOnce();
    expect(toastMock.custom.mock.calls[0]?.[1]).toHaveProperty('id');
    expect(screen.queryByText('Could not save')).not.toBeInTheDocument();

    act(() => {
      useThemeStore.getState().setToastPosition('top-right');
    });
    expect(toasterMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        position: 'top-right',
        offset: { top: '4.5rem' },
        mobileOffset: { top: '4rem', left: '0.75rem', right: '0.75rem' },
      }),
      undefined,
    );
  });

  it('starts bottom-centre — the default the v5 migration moves top-right onto', () => {
    expect(useThemeStore.getInitialState().toastPosition).toBe('bottom-center');
  });
});
