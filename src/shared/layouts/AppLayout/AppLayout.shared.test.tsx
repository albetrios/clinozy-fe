import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { axeLabelInName } from '@/tests/utils/axe-label-in-name.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { AppMain, SearchTrigger } from './AppLayout.shared.tsx';

vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const userA: AuthUser = { id: 'user-a', email: 'ada@example.com', role: 'user' };
const userB: AuthUser = { id: 'user-b', email: 'bo@example.com', role: 'user' };

function signIn(user: AuthUser) {
  act(() => {
    useAuthStore.getState().setUser(user);
  });
}

/** What every local logout path does here: `clearLocalAuthState() → clearAuth()`. */
function signOut() {
  act(() => {
    useAuthStore.getState().clearAuth();
  });
}

/** Mount the scrolling content region and hand back its `<main>`. */
async function mountMain() {
  const view = renderWithProviders(<AppMain />);
  return { view, main: await view.findByTestId('main-content') };
}

/**
 * Scroll `<main>` and let the layout record the offset. The writer is throttled
 * to an animation frame on purpose, so dispatching the event is not enough —
 * the frame has to actually run.
 */
async function scrollMainTo(main: HTMLElement, top: number) {
  main.scrollTop = top;
  await act(async () => {
    main.dispatchEvent(new Event('scroll'));
    // Queued after the component's own callback, so it resolves behind it.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  });
}

describe('AppMain — scroll restore across a remount', () => {
  beforeEach(() => {
    // Reset the carried offset the way the app does, then start a session.
    signOut();
    signIn(userA);
  });

  it('sanity: jsdom stores a written scrollTop', () => {
    const { container } = render(<div data-testid="probe" />);
    const el = container.firstElementChild as HTMLElement;
    el.scrollTop = 120;
    expect(el.scrollTop).toBe(120);
  });

  it('SHELL-1 — carries the offset onto the replacement <main>', async () => {
    const first = await mountMain();
    await scrollMainTo(first.main, 240);
    first.view.unmount();

    // A shell rebuilt by its boundary's Retry mounts a DIFFERENT <main>; the
    // browser has nothing of its own to restore, so the position has to come
    // from the layout. Breaking this is the regression the module-level offset
    // exists to prevent.
    const second = await mountMain();
    expect(second.main.scrollTop).toBe(240);
  });

  describe('the offset belongs to the session, not to the tab', () => {
    it('does not chase the previous user to their position after a re-login', async () => {
      const first = await mountMain();
      await scrollMainTo(first.main, 360);
      first.view.unmount();

      signOut();
      signIn(userB);

      // Ada scrolled; Bo did not. Without the reset, Bo's first 1.5s on a page
      // he has never scrolled are spent being dragged to Ada's offset.
      const second = await mountMain();
      expect(second.main.scrollTop).toBe(0);
    });

    it('does not survive a re-login as the same user either', async () => {
      const first = await mountMain();
      await scrollMainTo(first.main, 180);
      first.view.unmount();

      signOut();
      signIn(userA);

      // A new session is a new session. Keying the offset to the user id would
      // pass the test above and quietly fail this one.
      const second = await mountMain();
      expect(second.main.scrollTop).toBe(0);
    });
  });
});

describe('AppMain — the room frame while the page rises', () => {
  const FRAME_CLIP = 'has-[>[data-replaying]]:overflow-y-clip';

  it('clips a flush room’s frame vertically only while the rise plays', async () => {
    const view = renderWithProviders(<AppMain flush />);
    const main = await view.findByTestId('main-content');
    const frame = main.firstElementChild;
    expect(frame).toHaveClass(FRAME_CLIP);
    // The page itself is the frame's direct child — what `>` in the variant needs.
    expect(frame?.firstElementChild).toHaveAttribute('data-route');
  });

  it('leaves a padded page alone: its padding already absorbs the 6px rise', async () => {
    const { main } = await mountMain();
    expect(main.firstElementChild).not.toHaveClass(FRAME_CLIP);
  });
});

describe('SearchTrigger — its name holds what it shows (WCAG 2.5.3)', () => {
  it('is named by its words, never an aria-label over them', async () => {
    const { container } = render(<SearchTrigger />);
    const trigger = screen.getByTestId('search-trigger');
    expect(trigger).not.toHaveAttribute('aria-label');
    // From md the field's words; on a phone (icon only) the screen-reader words.
    expect(trigger).toHaveAccessibleName(/Search patients, leads…/);
    expect(trigger).toHaveAccessibleName(/^Search or jump to/);
    expect(screen.getByText('Search patients, leads…')).toHaveClass(
      'hidden',
      'md:inline',
    );
    expect(screen.getByText(/^Search or jump to/)).toHaveClass('sr-only', 'md:hidden');
    // The key cap is decoration: the shortcut is announced as one.
    expect(trigger).toHaveAttribute('aria-keyshortcuts', 'Control+K');
    expect(container.querySelector('kbd')).toHaveAttribute('aria-hidden', 'true');
    expect(trigger).not.toHaveAccessibleName(/Ctrl/);

    const results = await axeLabelInName(container);
    expect(results.violations).toEqual([]);
    expect(results.incomplete).toEqual([]);
  });

  it('the check has teeth: the aria-label axe-core 4.14 failed in e2e fails here too', async () => {
    const { container } = render(
      <button type="button" aria-label="Search or jump to (Command K)">
        <span>Search patients, leads…</span>
        <kbd>Ctrl+K</kbd>
      </button>,
    );
    const results = await axeLabelInName(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([
      'label-content-name-mismatch',
    ]);
  });
});
