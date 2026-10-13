import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { TaskRow as TaskRowRecord } from '@/shared/api/app/tasks-contracts.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { taskPerson, taskRow, TEST_TASK_MEMBER_ID } from '@/tests/utils/task-doubles.ts';

import { TaskRow, type TaskRowProps, type TaskRowTeam } from './TaskRow.tsx';

vi.mock('@/shared/hooks/useCanHover/index.ts', () => ({ useCanHover: () => true }));

/** 01:30 in the clinic on Sat 10 Oct 2026; the reply task was due at 02:01. */
const NOW = new Date('2026-10-09T20:00:00.000Z');

const member = (id: string, name: string, initials: string): DirectoryMember => ({
  id,
  userId: `usr_${id}`,
  name,
  initials,
  tone: 'sky',
  roleIds: [],
  branchIds: [],
});

/** The front desk member signed in, and a counsellor. */
const RIYA = member(TEST_TASK_MEMBER_ID, 'Riya Shah', 'RS');
const ASHA = member('mem_asha', 'Asha Mehta', 'AM');

const TEAM: TaskRowTeam = {
  byId: new Map([
    [RIYA.id, RIYA],
    [ASHA.id, ASHA],
  ]),
  myMembershipId: RIYA.id,
  updatedAt: null,
};

/** The row inside the table and row group the list gives it. */
function Table({ children }: { children: ReactNode }) {
  return (
    <div role="table" aria-label="Tasks">
      <div role="rowgroup">{children}</div>
    </div>
  );
}

function rowProps(row: TaskRowRecord, props: Partial<TaskRowProps> = {}): TaskRowProps {
  return {
    row,
    due: 'in 31 min',
    now: NOW,
    handled: false,
    team: TEAM,
    onOpen: vi.fn(),
    ...props,
  };
}

function renderRow(row: TaskRowRecord, props: Partial<TaskRowProps> = {}) {
  const all = rowProps(row, props);
  const view = render(
    <Table>
      <TaskRow {...all} />
    </Table>,
  );
  const rerenderRow = (next: TaskRowRecord, patch: Partial<TaskRowProps> = {}) =>
    view.rerender(
      <Table>
        <TaskRow {...rowProps(next, patch)} />
      </Table>,
    );
  return {
    ...view,
    rerenderRow,
    onOpen: all.onOpen,
    row: screen.getByTestId('tasks-row'),
  };
}

const cells = () => within(screen.getByTestId('tasks-row')).getAllByRole('cell');

describe('TaskRow (tasks.md:24–38)', () => {
  it('lays out the five cells: tile · title and why · person and source · owner · due', () => {
    const { row } = renderRow(taskRow());
    expect(cells()).toHaveLength(5);
    expect(cells()[1]).toHaveTextContent('Reply to Anaya');
    expect(cells()[1]).toHaveTextContent('Their message is waiting for a reply');
    expect(cells()[2]).toHaveTextContent('Anaya Desai');
    expect(cells()[4]).toHaveTextContent('in 31 min');
    expect(row).toHaveAttribute('data-type', 'reply');
    expect(row).toHaveAttribute('data-task-id', 'task_h7etxlhnxwzy1e2dxrins');
    // The edge takes the type's tone; the tile its surface (Unreplied messages: lav).
    expect(row).toHaveClass('border-s-tone-lav-dot');
    expect(cells()[0]).toHaveClass('bg-tone-lav');
    // A lead's person: the lav avatar, no "P" badge; the chip names the linked lead.
    expect(within(cells()[2] as HTMLElement).queryByTestId('patient-badge')).toBeNull();
    const chip = within(cells()[2] as HTMLElement).getByText(/Lead/);
    expect(chip).toHaveAttribute('data-source', 'lead');
    expect(chip).toHaveClass('text-tone-lav-foreground');
  });

  it('turns the edge and the due label red when overdue', () => {
    const { row } = renderRow(taskRow({ dueAt: '2026-10-09T19:20:00.000Z' }), {
      due: '40 min overdue',
    });
    expect(row).toHaveClass('border-s-now-indicator');
    expect(row).toHaveAttribute('data-overdue', 'true');
    expect(within(row).getByText('40 min overdue')).toHaveClass(
      'text-destructive',
      'font-semibold',
    );
  });

  it('marks a rule handed to the product, and shows a member’s Done result instead', () => {
    const { rerenderRow } = renderRow(taskRow(), { handled: true });
    expect(screen.getByText(`${PRODUCT_NAME} can do this`)).toBeInTheDocument();
    rerenderRow(
      taskRow({
        status: 'done',
        outcome: 'done',
        resultText: 'Booked a visit',
        resolvedAt: '2026-10-09T19:59:40.000Z',
        resolvedById: RIYA.id,
      }),
      { due: 'Done · Now', handled: true },
    );
    expect(screen.queryByText(`${PRODUCT_NAME} can do this`)).toBeNull();
    expect(screen.getByText('✓ Booked a visit')).toHaveClass('text-success-strong');
    expect(screen.getByTestId('tasks-row')).toHaveClass('border-s-border');
    expect(screen.getByText('Done · Now')).toHaveClass('text-muted-foreground');
  });

  it('reads a task the server closed by its due cell alone — no "✓ Done by <product>" twice', () => {
    renderRow(
      taskRow({
        status: 'done',
        outcome: 'done',
        resultText: `Done by ${PRODUCT_NAME}`,
        isResolvedAutomatically: true,
      }),
      { due: `Done by ${PRODUCT_NAME}` },
    );
    expect(screen.queryByText(`✓ Done by ${PRODUCT_NAME}`)).toBeNull();
    expect(cells()[4]).toHaveTextContent(`Done by ${PRODUCT_NAME}`);
  });

  it('names a member owner from the team, "(you)" for the signed-in member', () => {
    const { rerenderRow } = renderRow(taskRow({ ownerId: ASHA.id, ownerRole: null }));
    expect(cells()[3]).toHaveTextContent('Asha M.');
    // A lone name reads in its own direction.
    expect(screen.getByText('Asha M.')).toHaveAttribute('dir', 'auto');
    rerenderRow(taskRow({ ownerId: RIYA.id, ownerRole: null }));
    expect(cells()[3]).toHaveTextContent('Riya S. (you)');
  });

  it('reads the role queue an unowned task waits in, and "Anyone" without one', () => {
    const { rerenderRow } = renderRow(
      taskRow({ ownerId: null, ownerRole: 'front_desk' }),
    );
    const queue = within(cells()[3] as HTMLElement).getByText('Front desk');
    expect(queue.closest('[data-owner="queue"]')).toHaveClass('bg-tone-butter');
    rerenderRow(taskRow({ ownerId: null, ownerRole: null }));
    expect(screen.getByText('Anyone').closest('[data-owner="queue"]')).toHaveClass(
      'bg-tone-butter',
    );
  });

  it('adds "· was <first>" after a move — from a member or from a queue', () => {
    const move = {
      toId: ASHA.id,
      toRole: null,
      changedById: RIYA.id,
      at: '2026-10-09T19:00:00.000Z',
    };
    const { rerenderRow } = renderRow(
      taskRow({
        ownerId: ASHA.id,
        ownerRole: null,
        ownerChanges: [{ ...move, fromId: RIYA.id, fromRole: null }],
      }),
    );
    // Both names isolated: "Asha M." keeps its full stop at its end on a right-to-left page.
    expect(
      screen.getByText(`${fsi('Asha M.')} · was ${fsi('Riya')}`),
    ).toBeInTheDocument();
    rerenderRow(
      taskRow({
        ownerId: ASHA.id,
        ownerRole: null,
        ownerChanges: [{ ...move, fromId: null, fromRole: 'front_desk' }],
      }),
    );
    expect(
      screen.getByText(`${fsi('Asha M.')} · was ${fsi('Front desk')}`),
    ).toBeInTheDocument();
  });

  it('leaves the owner cell empty for a member no longer on the team', () => {
    renderRow(taskRow({ ownerId: 'mem_gone', ownerRole: null }));
    expect(cells()[3]).toBeEmptyDOMElement();
  });

  it('shows a patient with the "P" badge, and names the record kind or the person', () => {
    const { rerenderRow } = renderRow(
      taskRow({
        type: 'aftercare',
        ruleKey: 'aftercare',
        link: { kind: 'treatment', id: 'ptr_one' },
        person: taskPerson(),
      }),
    );
    expect(
      within(cells()[2] as HTMLElement).getByTestId('patient-badge'),
    ).toBeInTheDocument();
    expect(screen.getByText('Treatment')).toHaveClass('text-tone-mint-foreground');
    // A task with no record link names what its person is — here a chat-only contact.
    rerenderRow(
      taskRow({
        type: 'by_hand',
        ruleKey: null,
        kind: 'manual',
        link: null,
        person: taskPerson({ patientId: null, patientNumber: null }),
      }),
    );
    expect(screen.getByText('Contact')).toHaveClass('text-tone-sage-foreground');
    expect(screen.getByTestId('tasks-row')).toHaveClass('border-s-tone-plum-dot');
  });

  it('shows the chip alone for a task about nobody', () => {
    renderRow(
      taskRow({
        type: 'medical_rep_visit',
        ruleKey: 'medical_rep_visit',
        contact: null,
        person: null,
        link: { kind: 'medicalRep', id: 'mrep_one' },
      }),
    );
    expect(within(cells()[2] as HTMLElement).queryByRole('button')).toBeNull();
    expect(cells()[2]?.querySelector('[data-source="medicalRep"]')).not.toBeNull();
  });

  it('opens on a click, Enter or Space — and is focusable', async () => {
    const user = userEvent.setup();
    const { row, onOpen } = renderRow(taskRow());
    await user.click(within(row).getByText('Reply to Anaya'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    row.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(3);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderRow(taskRow({ ownerId: RIYA.id, ownerRole: null }), {
      handled: true,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
