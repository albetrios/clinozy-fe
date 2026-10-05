import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { type ReactElement, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';

import { useUnsavedChangesGuard } from './useUnsavedChangesGuard.tsx';

function GuardedPage({ dirty }: { dirty: boolean }) {
  const { guardDialog, isBlocked } = useUnsavedChangesGuard({ when: dirty });
  return (
    <div>
      <span data-testid="home">home</span>
      <span data-testid="blocked-state">{isBlocked ? 'blocked' : 'idle'}</span>
      <Link to="/other" data-testid="leave-link">
        leave
      </Link>
      {guardDialog}
    </div>
  );
}

/** A surface with its own exit (a drawer's ×): the exit leaves for `/other`. */
function GuardedSurface({ dirty, onExit }: { dirty: boolean; onExit: () => void }) {
  const navigate = useNavigate();
  const { guardDialog, confirmDiscard } = useUnsavedChangesGuard({ when: dirty });
  return (
    <div>
      <span data-testid="home">home</span>
      <button
        type="button"
        data-testid="surface-exit"
        onClick={() =>
          confirmDiscard(() => {
            onExit();
            void navigate({ to: '/other' });
          })
        }
      >
        close
      </button>
      {guardDialog}
    </div>
  );
}

/**
 * A dirty surface whose record a confirm deletes — plain or with a reason —
 * and whose write then closes it, by navigating or through its own guarded
 * exit, as a drawer's `onDeleted` does.
 */
function DeletingSurface({
  reason = false,
  exit = 'navigate',
}: {
  reason?: boolean;
  exit?: 'navigate' | 'guarded';
}) {
  const navigate = useNavigate();
  const { guardDialog, confirmDiscard } = useUnsavedChangesGuard({ when: true });
  const [deleting, setDeleting] = useState(false);
  const leave = () => void navigate({ to: '/other' });
  const write = async () => {
    await Promise.resolve();
    if (exit === 'guarded') confirmDiscard(leave);
    else leave();
  };
  const shared = {
    open: deleting,
    onOpenChange: setDeleting,
    title: 'Delete this record?',
  };
  return (
    <div>
      <span data-testid="home">home</span>
      <button
        type="button"
        data-testid="surface-delete"
        onClick={() => setDeleting(true)}
      >
        delete
      </button>
      {reason ? (
        <ConfirmDialog {...shared} reason={{}} onConfirm={write} />
      ) : (
        <ConfirmDialog {...shared} destructive onConfirm={write} />
      )}
      {guardDialog}
    </div>
  );
}

function renderWithRouter(page: ReactElement) {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => page,
  });
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: () => <div data-testid="other-page">elsewhere</div>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, otherRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe('useUnsavedChangesGuard', () => {
  it('lets navigation through when there are no unsaved changes', async () => {
    renderWithRouter(<GuardedPage dirty={false} />);
    await screen.findByTestId('home');

    fireEvent.click(screen.getByTestId('leave-link'));

    expect(await screen.findByTestId('other-page')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('blocks navigation while dirty and opens the confirm dialog', async () => {
    renderWithRouter(<GuardedPage dirty />);
    await screen.findByTestId('home');

    fireEvent.click(screen.getByTestId('leave-link'));

    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('blocked-state')).toHaveTextContent('blocked');
    // Still on the guarded page.
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('other-page')).not.toBeInTheDocument();
  });

  it('asks with the shared discard copy by default', async () => {
    renderWithRouter(<GuardedPage dirty />);
    await screen.findByTestId('home');

    fireEvent.click(screen.getByTestId('leave-link'));

    await screen.findByTestId('confirm-dialog');
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-accept')).toHaveTextContent('Discard');
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('Keep editing');
  });

  it('confirming discards the changes and completes the navigation', async () => {
    renderWithRouter(<GuardedPage dirty />);
    await screen.findByTestId('home');

    fireEvent.click(screen.getByTestId('leave-link'));
    await screen.findByTestId('confirm-dialog');

    fireEvent.click(screen.getByTestId('confirm-accept'));

    expect(await screen.findByTestId('other-page')).toBeInTheDocument();
  });

  it('cancelling keeps the user on the page and clears the blocked state', async () => {
    renderWithRouter(<GuardedPage dirty />);
    await screen.findByTestId('home');

    fireEvent.click(screen.getByTestId('leave-link'));
    await screen.findByTestId('confirm-dialog');

    fireEvent.click(screen.getByTestId('confirm-cancel'));

    await waitFor(() =>
      expect(screen.getByTestId('blocked-state')).toHaveTextContent('idle'),
    );
    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('other-page')).not.toBeInTheDocument();
  });

  describe('confirmDiscard (a surface’s own exits)', () => {
    it('runs the exit at once when there is nothing to lose', async () => {
      const onExit = vi.fn();
      renderWithRouter(<GuardedSurface dirty={false} onExit={onExit} />);
      await screen.findByTestId('home');

      fireEvent.click(screen.getByTestId('surface-exit'));

      expect(onExit).toHaveBeenCalledTimes(1);
      expect(await screen.findByTestId('other-page')).toBeInTheDocument();
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('asks first while dirty; Keep editing runs nothing', async () => {
      const onExit = vi.fn();
      renderWithRouter(<GuardedSurface dirty onExit={onExit} />);
      await screen.findByTestId('home');

      fireEvent.click(screen.getByTestId('surface-exit'));
      await screen.findByTestId('confirm-dialog');
      expect(onExit).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('confirm-cancel'));

      await waitFor(() =>
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument(),
      );
      expect(onExit).not.toHaveBeenCalled();
      expect(screen.getByTestId('home')).toBeInTheDocument();
    });

    it('Discard runs the exit, and the navigation it starts is not asked about again', async () => {
      const onExit = vi.fn();
      renderWithRouter(<GuardedSurface dirty onExit={onExit} />);
      await screen.findByTestId('home');

      fireEvent.click(screen.getByTestId('surface-exit'));
      await screen.findByTestId('confirm-dialog');
      fireEvent.click(screen.getByTestId('confirm-accept'));

      expect(await screen.findByTestId('other-page')).toBeInTheDocument();
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('an exit a confirm’s write starts (L-64: one confirm)', () => {
    it.each([
      ['a plain confirm', false, 'navigate'],
      ['a reason confirm', true, 'navigate'],
      ['a plain confirm, through the guarded exit', false, 'guarded'],
    ] as const)(
      'after %s, leaves without "Discard changes?"',
      async (_, reason, exit) => {
        renderWithRouter(<DeletingSurface reason={reason} exit={exit} />);
        await screen.findByTestId('home');

        fireEvent.click(screen.getByTestId('surface-delete'));
        const dialog = await screen.findByTestId('confirm-dialog');
        expect(within(dialog).getByText('Delete this record?')).toBeInTheDocument();
        if (reason) fireEvent.click(within(dialog).getByTestId('confirm-reason-mistake'));
        fireEvent.click(within(dialog).getByTestId('confirm-accept'));

        expect(await screen.findByTestId('other-page')).toBeInTheDocument();
        expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
      },
    );

    it('still asks for the same exit outside a confirm', async () => {
      renderWithRouter(<GuardedPage dirty />);
      await screen.findByTestId('home');
      fireEvent.click(screen.getByTestId('leave-link'));
      expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    });
  });
});

describe('useUnsavedChangesGuard — a save landing under the prompt', () => {
  it('runs the parked exit once the surface turns clean', async () => {
    // × during "Saving…": the prompt warned about changes that have since
    // landed, so the exit it parked goes ahead instead of waiting on a choice.
    const onExit = vi.fn();
    function Landing() {
      const [dirty, setDirty] = useState(true);
      return (
        <>
          <button type="button" data-testid="save-lands" onClick={() => setDirty(false)}>
            save
          </button>
          <GuardedSurface dirty={dirty} onExit={onExit} />
        </>
      );
    }
    renderWithRouter(<Landing />);
    fireEvent.click(await screen.findByTestId('surface-exit'));
    await screen.findByTestId('confirm-dialog');

    fireEvent.click(screen.getByTestId('save-lands'));

    expect(await screen.findByTestId('other-page')).toBeInTheDocument();
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
