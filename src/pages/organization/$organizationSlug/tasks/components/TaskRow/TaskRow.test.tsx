import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type { TaskRow as TaskRowRecord } from '@/shared/api/clinic/tasks-contracts.ts';

import {
  ASHA,
  RIYA,
  taskRowFixture,
} from '../../__tests__/integration/task-row-fixture.ts';
import { TaskRow, type TaskRowProps } from './TaskRow.tsx';

vi.mock('@/shared/hooks/useCanHover/index.ts', () => ({ useCanHover: () => true }));

/** 10:30 in the clinic on Sun 4 Oct 2026; the fixture is due at 10:50. */
const NOW = new Date('2026-10-04T05:00:00.000Z');

/** The row inside the table and row group the list gives it. */
function Table({ children }: { children: ReactNode }) {
  return (
    <div role="table" aria-label="Tasks">
      <div role="rowgroup">{children}</div>
    </div>
  );
}

function renderRow(row: TaskRowRecord, props: Partial<TaskRowProps> = {}) {
  const onOpen = vi.fn();
  const view = render(
    <Table>
      <TaskRow
        row={row}
        due="in 20 min"
        now={NOW}
        handled={false}
        onOpen={onOpen}
        {...props}
      />
    </Table>,
  );
  return { ...view, onOpen, row: screen.getByTestId('tasks-row') };
}

describe('TaskRow (tasks.md:24–38)', () => {
  it('lays out the five cells: tile · title and why · person and source · owner · due', () => {
    const { row } = renderRow(taskRowFixture());
    const cells = within(row).getAllByRole('cell');
    expect(cells).toHaveLength(5);
    expect(cells[1]).toHaveTextContent('Confirm Priti’s visit');
    expect(cells[1]).toHaveTextContent('Laser session not confirmed');
    expect(cells[2]).toHaveTextContent('Priti Soni');
    expect(cells[2]).toHaveTextContent('Appt #2848');
    expect(cells[3]).toHaveTextContent('Riya S.');
    expect(cells[4]).toHaveTextContent('in 20 min');
    // The edge takes the rule's tone; the tile its surface (Confirm visits: sky).
    expect(row).toHaveClass('border-s-tone-sky-dot');
    expect(cells[0]).toHaveClass('bg-tone-sky');
    // A patient: the sage avatar with the "P" badge.
    expect(
      within(cells[2] as HTMLElement).getByTestId('patient-badge'),
    ).toBeInTheDocument();
  });

  it('turns the edge and the due label red when overdue', () => {
    const { row } = renderRow(taskRowFixture({ dueAt: '2026-10-04T04:20:00.000Z' }), {
      due: '40 min overdue',
    });
    expect(row).toHaveClass('border-s-now-indicator');
    expect(row).toHaveAttribute('data-overdue', 'true');
    expect(within(row).getByText('40 min overdue')).toHaveClass(
      'text-destructive',
      'font-semibold',
    );
  });

  it('marks a rule handed to the product, and shows a Done row’s result instead', () => {
    const { rerender } = renderRow(taskRowFixture(), { handled: true });
    expect(screen.getByText(`${PRODUCT_NAME} can do this`)).toBeInTheDocument();
    rerender(
      <Table>
        <TaskRow
          row={taskRowFixture({
            status: 'done',
            result: 'Confirmed on call',
            resolvedBy: 'member',
          })}
          due="Done · Now"
          now={NOW}
          handled
          onOpen={vi.fn()}
        />
      </Table>,
    );
    expect(screen.queryByText(`${PRODUCT_NAME} can do this`)).toBeNull();
    expect(screen.getByText('✓ Confirmed on call')).toHaveClass('text-success-strong');
    expect(screen.getByTestId('tasks-row')).toHaveClass('border-s-border');
    expect(screen.getByText('Done · Now')).toHaveClass('text-muted-foreground');
  });

  it('reads "Anyone" without an owner, and "· was <first>" after a reassign', () => {
    const { rerender } = renderRow(taskRowFixture({ owner: null, ownerId: null }));
    expect(screen.getByText('Anyone')).toHaveClass('bg-tone-butter');
    rerender(
      <Table>
        <TaskRow
          row={taskRowFixture({ owner: ASHA, previousOwners: [RIYA] })}
          due="in 20 min"
          now={NOW}
          handled={false}
          onOpen={vi.fn()}
        />
      </Table>,
    );
    expect(screen.getByText('Asha M. · was Riya')).toBeInTheDocument();
  });

  it('names a lead’s, a treatment’s and a chat-only person’s source in its ink', () => {
    const { rerender } = renderRow(
      taskRowFixture({ source: { kind: 'lead', id: null, seq: 2363 } }),
    );
    expect(screen.getByText('Lead #2363')).toHaveClass('text-tone-lav-foreground');
    rerender(
      <Table>
        <TaskRow
          row={taskRowFixture({ source: { kind: 'treatment', id: null, seq: null } })}
          due="in 20 min"
          now={NOW}
          handled={false}
          onOpen={vi.fn()}
        />
      </Table>,
    );
    expect(screen.getByText('Treatment')).toHaveClass('text-tone-mint-foreground');
    rerender(
      <Table>
        <TaskRow
          row={taskRowFixture({ source: { kind: 'contact', id: null, seq: null } })}
          due="in 20 min"
          now={NOW}
          handled={false}
          onOpen={vi.fn()}
        />
      </Table>,
    );
    expect(screen.getByText('Contact')).toHaveClass('text-tone-sage-foreground');
  });

  it('opens on a click, Enter or Space — and is focusable', async () => {
    const user = userEvent.setup();
    const { row, onOpen } = renderRow(taskRowFixture());
    await user.click(within(row).getByText('Confirm Priti’s visit'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    row.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderRow(taskRowFixture(), { handled: true });
    expect(await axe(container)).toHaveNoViolations();
  });
});
