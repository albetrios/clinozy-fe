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
    it('draws the dashed ring, the tinted disc, the tile and the dots in the tone', () => {
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

      const art = screen.getByTestId('empty-state-illustration');
      expect(art).toHaveAttribute('aria-hidden', 'true');
      expect(art).toHaveClass('size-24');
      const [ring, disc, tile, dot, smallDot] = Array.from(art.children);
      expect(ring).toHaveClass('border-dashed', 'rounded-full', 'inset-0');
      expect(disc).toHaveClass('bg-tone-sage', 'inset-3.5');
      expect(tile).toHaveClass(
        'bg-card',
        'size-10',
        'rounded-xl',
        'text-tone-sage-foreground',
      );
      expect(tile).toContainElement(screen.getByTestId('room-icon'));
      expect(dot).toHaveClass('bg-tone-sage-dot', 'size-2.5');
      expect(smallDot).toHaveClass('bg-border', 'size-1.5');

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

  it('keeps its action in the same line — "No appointments here · book one"', async () => {
    const onBook = vi.fn();
    const user = userEvent.setup();
    render(
      <EmptyState
        variant="inline"
        title="No appointments here · "
        action={
          <button type="button" onClick={onBook}>
            book one
          </button>
        }
      />,
    );
    expect(screen.getByTestId('empty-state')).toHaveTextContent(
      'No appointments here · book one',
    );
    await user.click(screen.getByRole('button', { name: 'book one' }));
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
