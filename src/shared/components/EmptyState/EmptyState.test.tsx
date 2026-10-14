import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Users } from '@/shared/icons/index.ts';

import { EmptyState, EmptyStateAction } from './EmptyState.tsx';

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(
      <EmptyState
        title="No members yet"
        description="Invite your first teammate."
        action={<button type="button">Invite</button>}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    expect(screen.getByText('Invite your first teammate.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  });

  it('renders an icon when provided', () => {
    render(<EmptyState icon={<svg data-testid="empty-icon" />} title="Empty" />);
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState title="Nothing here" description="Try again later." />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('falls back to "Nothing here yet" without a title', () => {
    render(<EmptyState />);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
  });

  describe('with a room tone (the clinic illustration)', () => {
    it('draws the ring and the dots in colour, and the icon knocked out of a bright tile', () => {
      render(
        <EmptyState
          tone="sage"
          icon={<Users data-testid="room-icon" />}
          title="No patients match"
          description="Patients appear here after their first check-in."
        />,
      );
      const root = screen.getByTestId('empty-state');
      expect(root).toHaveAttribute('data-tone', 'sage');
      // Centred in a growing column (the table body, a tab's view).
      expect(root).toHaveClass('my-auto', 'py-12');

      const art = screen.getByTestId('empty-state-illustration');
      expect(art).toHaveAttribute('aria-hidden', 'true');
      expect(art).toHaveAttribute('data-size', 'room');
      expect(art).toHaveClass('size-24');
      const [ring, disc, tile, dot, firstAccent, secondAccent] = Array.from(art.children);
      expect(ring).toHaveClass(
        'border-dashed',
        'rounded-full',
        'inset-0',
        'border-tone-sage-border',
      );
      expect(disc).toHaveClass('bg-tone-sage', 'inset-3.5');
      expect(tile).toHaveClass(
        'size-11',
        'rounded-2xl',
        'bg-tone-sage-dot',
        'text-background',
      );
      expect(tile).toContainElement(screen.getByTestId('room-icon'));
      expect(dot).toHaveClass('bg-tone-sage-dot', 'size-2.5');
      // Sage's accents: lime and sky — three colours in every illustration.
      expect(firstAccent).toHaveClass('bg-tone-lime-dot', 'size-1.75');
      expect(secondAccent).toHaveClass('bg-tone-sky-dot', 'size-1.25');

      expect(screen.getByRole('heading', { name: 'No patients match' })).toHaveClass(
        'text-title',
        'font-semibold',
      );
      expect(screen.getByText(/after their first check-in/)).toHaveClass(
        'text-detail',
        'max-w-80',
      );
    });

    it('offers the 36px primary create action', async () => {
      const onCreate = vi.fn();
      const user = userEvent.setup();
      render(
        <EmptyState
          tone="sky"
          title="No offerings yet"
          action={<EmptyStateAction onClick={onCreate}>New offering</EmptyStateAction>}
        />,
      );
      const button = screen.getByRole('button', { name: 'New offering' });
      expect(button).toHaveClass('h-9', 'rounded-lg', 'text-body');
      expect(button.querySelector('svg')).not.toBeNull();
      await user.click(button);
      expect(onCreate).toHaveBeenCalledOnce();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <EmptyState
          tone="peach"
          icon={<Users />}
          title="Nothing to collect here"
          description="Receipts, invoices and dues show up as soon as a visit is billed."
          action={<EmptyStateAction>New receipt</EmptyStateAction>}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('as a dashed card (a thread with no conversation yet)', () => {
    it('draws the dashed card with its title, line and a row of chips', () => {
      render(
        <EmptyState
          variant="card"
          title="No conversation yet"
          description="Start with a WhatsApp · replies land here"
          action={
            <>
              <button type="button">Say hello</button>
              <button type="button">Send directions</button>
            </>
          }
        />,
      );
      const card = screen.getByTestId('empty-state');
      expect(card).toHaveAttribute('data-variant', 'card');
      expect(card).toHaveClass('border-dashed', 'border-border-strong', 'rounded-xl');
      expect(screen.getByRole('heading', { name: 'No conversation yet' })).toBeVisible();
      expect(screen.getByText('Start with a WhatsApp · replies land here')).toBeVisible();
      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(screen.queryByTestId('empty-state-illustration')).not.toBeInTheDocument();
    });

    it('carries the small art above its title when given a tone and an icon', () => {
      render(
        <EmptyState
          variant="card"
          tone="sky"
          icon={<Users data-testid="card-icon" />}
          title="No conversation yet"
        />,
      );
      const art = screen.getByTestId('empty-state-illustration');
      expect(art).toHaveAttribute('data-size', 'card');
      // No dashed ring: the card itself is dashed.
      expect(art.querySelector('.border-dashed')).toBeNull();
      expect(art).toContainElement(screen.getByTestId('card-icon'));
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <EmptyState
          variant="card"
          title="No conversation yet"
          action={<button type="button">Say hello</button>}
        />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('compact (an empty list inside a populated screen)', () => {
    it('draws the 48px art in the tone over a one-line title, centred', () => {
      render(
        <EmptyState
          variant="compact"
          tone="plum"
          icon={<Users data-testid="compact-icon" />}
          title="Nothing needs you right now."
          testId="queue-empty"
        />,
      );
      const root = screen.getByTestId('queue-empty');
      expect(root).toHaveAttribute('data-variant', 'compact');
      expect(root).toHaveAttribute('data-tone', 'plum');
      expect(root).toHaveClass('my-auto', 'items-center', 'text-center');
      const art = screen.getByTestId('empty-state-illustration');
      expect(art).toHaveAttribute('data-size', 'compact');
      expect(art).toHaveClass('size-12');
      const [disc, tile, accent] = Array.from(art.children);
      expect(disc).toHaveClass(
        'bg-tone-plum',
        'border-dashed',
        'border-tone-plum-border',
      );
      expect(tile).toHaveClass('size-8', 'bg-tone-plum-dot', 'text-background');
      expect(tile).toContainElement(screen.getByTestId('compact-icon'));
      expect(accent).toHaveClass('bg-tone-lav-dot');
      // A paragraph, not a heading: it sits inside a card that has its own.
      expect(screen.queryByRole('heading')).toBeNull();
      expect(screen.getByText('Nothing needs you right now.').tagName).toBe('P');
    });

    it('keeps its line and action', async () => {
      const onAdd = vi.fn();
      const user = userEvent.setup();
      render(
        <EmptyState
          variant="compact"
          tone="peach"
          icon={<Users />}
          title="No entries"
          description="Payments taken today show up here."
          action={<EmptyStateAction onClick={onAdd}>Receive</EmptyStateAction>}
        />,
      );
      expect(screen.getByText('Payments taken today show up here.')).toHaveClass(
        'text-xs',
        'text-muted-foreground',
      );
      await user.click(screen.getByRole('button', { name: 'Receive' }));
      expect(onAdd).toHaveBeenCalledOnce();
    });

    it('draws no art without a tone and an icon', () => {
      render(<EmptyState variant="compact" title="No entries" />);
      expect(screen.queryByTestId('empty-state-illustration')).toBeNull();
      expect(screen.getByText('No entries')).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <EmptyState variant="compact" tone="lav" icon={<Users />} title="No passkeys" />,
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  });

  describe('with filters applied', () => {
    it('says "No matches", swaps in the Search icon and clears the filters', async () => {
      const onClearFilters = vi.fn();
      const user = userEvent.setup();
      render(
        <EmptyState
          tone="lav"
          icon={<Users data-testid="room-icon" />}
          title="No leads yet"
          description="Leads land here."
          onClearFilters={onClearFilters}
        />,
      );
      expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Nothing matches these filters. Clear them to see everything again.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText('No leads yet')).toBeNull();
      expect(screen.queryByTestId('room-icon')).toBeNull();
      expect(
        screen.getByTestId('empty-state-illustration').querySelector('svg'),
      ).not.toBeNull();

      const clear = screen.getByTestId('empty-state-clear-filters');
      expect(clear).toHaveAccessibleName('Clear filters');
      expect(clear.querySelector('svg')).toBeNull();
      await user.click(clear);
      expect(onClearFilters).toHaveBeenCalledOnce();
    });

    it('works on the plain look too', () => {
      render(<EmptyState title="No roles" onClearFilters={() => {}} />);
      expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    });
  });

  describe('as the page itself (headingLevel)', () => {
    it('keeps an h3 inside a room by default', () => {
      render(<EmptyState tone="stone" title="Nothing here" />);
      expect(
        screen.getByRole('heading', { level: 3, name: 'Nothing here' }),
      ).toBeInTheDocument();
    });

    it('names the page with an h1 — the tone look and the plain one', () => {
      const { unmount } = render(
        <EmptyState tone="butter" headingLevel={1} title="Organization suspended" />,
      );
      expect(
        screen.getByRole('heading', { level: 1, name: 'Organization suspended' }),
      ).toBeInTheDocument();
      unmount();

      render(<EmptyState headingLevel={2} title="No roles" />);
      expect(
        screen.getByRole('heading', { level: 2, name: 'No roles' }),
      ).toBeInTheDocument();
    });
  });

  describe('EmptyStateAction', () => {
    it('is a 36px button with a Plus before its label by default', () => {
      render(<EmptyStateAction>New patient</EmptyStateAction>);
      const action = screen.getByRole('button', { name: 'New patient' });
      expect(action).toHaveAttribute('type', 'button');
      expect(action).toHaveClass('h-9', 'rounded-lg', 'text-body');
      expect(action.querySelector('svg')).not.toBeNull();
    });

    it('lends its look to a link with asChild, and draws no icon', () => {
      render(
        <EmptyStateAction asChild data-testid="go-home">
          <a href="/">Go home</a>
        </EmptyStateAction>,
      );
      const link = screen.getByRole('link', { name: 'Go home' });
      expect(link).toHaveAttribute('href', '/');
      expect(link).toHaveAttribute('data-testid', 'go-home');
      expect(link).not.toHaveAttribute('type');
      expect(link).toHaveClass('h-9', 'rounded-lg', 'text-body');
      expect(link.querySelector('svg')).toBeNull();
    });
  });
});

describe('EmptyState — inline (a list’s or a card’s one-liner)', () => {
  it('is one muted 12.5px line with its own test id, sized by the caller', () => {
    render(
      <EmptyState
        variant="inline"
        title="No notes yet"
        testId="notes-empty"
        className="text-body"
      />,
    );
    const line = screen.getByTestId('notes-empty');
    expect(line.tagName).toBe('P');
    expect(line).toHaveAttribute('data-variant', 'inline');
    expect(line).toHaveTextContent(/^No notes yet$/);
    expect(line).toHaveClass('text-muted-foreground', 'text-body');
    expect(line).not.toHaveClass('text-detail');
  });

  it('keeps its action in the same line — "No results · clear the search"', async () => {
    const onBook = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        variant="inline"
        title="No results · "
        action={
          <button type="button" onClick={onBook}>
            clear the search
          </button>
        }
      />,
    );
    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      'No results · clear the search',
    );
    await user.click(screen.getByRole('button', { name: 'clear the search' }));
    expect(onBook).toHaveBeenCalledOnce();
  });

  it('takes a test id on every look', () => {
    render(<EmptyState title="No API keys" testId="api-keys-empty" />);
    expect(screen.getByTestId('api-keys-empty')).toHaveTextContent('No API keys');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <EmptyState variant="inline" title="No snoozed tasks" description="Snooze one" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
