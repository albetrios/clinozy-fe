import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

const { viewport } = vi.hoisted(() => ({
  viewport: { tier: 'desktop' as ViewportTier },
}));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));

import { CONFIRM_BUTTON_CLASS } from './confirm-dialog.constants.ts';
import { ConfirmPanel, type ConfirmPanelProps } from './confirm-panel.tsx';

/** A frame with two footer buttons; the second takes the initial focus. */
function Frame(props: Partial<ConfirmPanelProps>) {
  const answerRef = useRef<HTMLButtonElement>(null);
  return (
    <ConfirmPanel
      open
      title="Session expiring"
      description={<div>You will be signed out soon.</div>}
      initialFocusRef={answerRef}
      testId="frame"
      footer={(layout) => (
        <>
          <button type="button" className={CONFIRM_BUTTON_CLASS[layout]}>
            Leave
          </button>
          <button ref={answerRef} type="button" className={CONFIRM_BUTTON_CLASS[layout]}>
            Stay
          </button>
        </>
      )}
      {...props}
    />
  );
}

beforeEach(() => {
  viewport.tier = 'desktop';
});

describe('ConfirmPanel', () => {
  it.each([
    ['desktop', 'panel'],
    ['tablet', 'panel'],
    ['phone', 'sheet'],
  ] as const)('on %s it is the %s, named and described', (tier, layout) => {
    viewport.tier = tier;
    render(<Frame />);
    const frame = screen.getByRole('alertdialog', { name: 'Session expiring' });
    expect(frame).toBe(screen.getByTestId('frame'));
    expect(frame).toHaveAttribute('data-layout', layout);
    expect(frame).toHaveAccessibleDescription('You will be signed out soon.');
    // The footer's buttons take the frame's size.
    expect(screen.getByRole('button', { name: 'Stay' }).className).toContain(
      CONFIRM_BUTTON_CLASS[layout],
    );
  });

  it.each(['desktop', 'phone'] as const)(
    'focuses what the caller names, not the first button (%s)',
    async (tier) => {
      viewport.tier = tier;
      render(<Frame />);
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Stay' })).toHaveFocus(),
      );
    },
  );

  it.each(['desktop', 'phone'] as const)(
    'without onDismiss it owes an answer: no ×, and Esc does nothing (%s)',
    async (tier) => {
      viewport.tier = tier;
      const user = userEvent.setup();
      render(<Frame />);

      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
      await user.keyboard('{Escape}');

      expect(screen.getByTestId('frame')).toBeVisible();
    },
  );

  it('without onDismiss the backdrop does nothing either', async () => {
    const user = userEvent.setup();
    render(<Frame />);
    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]');
    expect(overlay).not.toBeNull();

    await user.click(overlay as Element);

    expect(screen.getByTestId('frame')).toBeVisible();
  });

  it.each(['desktop', 'phone'] as const)(
    'reads busy and holds its × while busy (%s)',
    (tier) => {
      viewport.tier = tier;
      const onDismiss = vi.fn();
      render(<Frame busy onDismiss={onDismiss} />);

      expect(screen.getByTestId('frame')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('confirm-close')).toBeDisabled();
    },
  );

  it('draws the × outside the panel’s start edge from md', () => {
    render(<Frame onDismiss={vi.fn()} />);
    expect(screen.getByTestId('confirm-close')).toHaveAttribute(
      'data-slot',
      'floating-edge',
    );
  });

  it.each(['desktop', 'phone'] as const)(
    'has no accessibility violations (%s)',
    async (tier) => {
      viewport.tier = tier;
      const { baseElement } = render(<Frame onDismiss={vi.fn()} />);
      expect(await axeForDialog(baseElement)).toHaveNoViolations();
    },
  );
});
