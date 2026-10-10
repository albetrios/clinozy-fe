import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import {
  TASK_TYPES,
  type TaskOutcomePlan,
  type TaskRow,
} from '@/shared/api/clinic/tasks-contracts.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import { ASHA, RIYA, taskRowFixture } from '@/tests/utils/task-row-fixture.ts';

import type { WorkQueueEntry } from '../../hooks/useWorkQueue/index.ts';
import { WorkQueue, type WorkQueueProps } from './WorkQueue.tsx';

/** 10:42 in the clinic (IST) on 4 Oct. */
const NOW = new Date('2026-10-04T05:12:00.000Z');

const TEAM: WorkQueueProps['team'] = {
  byId: new Map([
    [RIYA.id, RIYA],
    [ASHA.id, ASHA],
  ]),
  myMembershipId: RIYA.id,
};

/** Every outcome of the task's type — a member who holds every code. */
const everyOutcome = (row: TaskRow): readonly TaskOutcomePlan[] =>
  TASK_TYPES[row.type].outcomes;

const open = (patch: Partial<TaskRow> = {}): WorkQueueEntry => ({
  row: taskRowFixture(patch),
  result: null,
  busy: false,
});

function renderQueue(props: Partial<WorkQueueProps> = {}) {
  return renderWithProviders(
    <WorkQueue
      entries={[open()]}
      openCount={8}
      scope="mine"
      onScopeChange={vi.fn()}
      now={NOW}
      team={TEAM}
      outcomesOf={everyOutcome}
      onOutcome={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('WorkQueue (KICKOFF §6.2 Work queue aside; one task model, Q-T3)', () => {
  it('heads the queue with every open task, and draws a task with its type’s outcomes', async () => {
    const { container } = renderQueue();
    const queue = await screen.findByRole('complementary', { name: 'Work queue' });
    expect(queue).toHaveTextContent('8 open · each has an owner and a due time');
    const card = within(queue).getByTestId('today-queue-card');
    expect(card).toHaveAttribute('data-task-id', taskRowFixture().id);
    expect(card).toHaveTextContent('Confirm visits');
    expect(card).toHaveTextContent('Confirm Priti’s visit');
    expect(card).toHaveTextContent('Laser session not confirmed.');
    expect(card).toHaveTextContent('Owner: Riya (you)');
    expect(
      within(card)
        .getAllByTestId('today-queue-outcome')
        .map((button) => button.textContent),
    ).toEqual([
      'Confirmed on call',
      'Move to another slot',
      'Cancelled by patient',
      'No answer',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reds an overdue due label and names other owners — a role’s queue, or Anyone', async () => {
    renderQueue({
      entries: [
        open({ id: 'task_late0000000000000000', dueAt: '2026-10-04T04:32:00.000Z' }),
        open({ id: 'task_asha0000000000000000', ownerId: ASHA.id }),
        open({ id: 'task_queue000000000000000', ownerId: null, ownerRole: 'front_desk' }),
        open({ id: 'task_nobody00000000000000', ownerId: null, ownerRole: null }),
        open({ id: 'task_gone0000000000000000', ownerId: 'mem_gone00000000000000000' }),
      ],
    });
    const [late, asha, queue, nobody, gone] =
      await screen.findAllByTestId('today-queue-card');
    expect(late).toHaveTextContent('40 min overdue');
    expect(within(late as HTMLElement).getByText('40 min overdue')).toHaveClass(
      'text-tone-blush-foreground',
    );
    expect(asha).toHaveTextContent('Owner: Asha M.');
    expect(queue).toHaveTextContent('Owner: Front desk');
    expect(nobody).toHaveTextContent('Owner: Anyone');
    // A member no longer on the team names no one.
    expect(gone).not.toHaveTextContent('Owner:');
  });

  it('closes a card in place with its result, receded a text step instead of 70% opacity', async () => {
    const { container } = renderQueue({
      entries: [{ row: taskRowFixture(), result: 'Confirmed on call', busy: false }],
    });
    const card = await screen.findByTestId('today-queue-card');
    expect(card).toHaveAttribute('data-closed', 'true');
    expect(card).toHaveTextContent('✓ Confirmed on call');
    expect(within(card).queryByTestId('today-queue-outcome')).not.toBeInTheDocument();
    // The design's 70% opacity took the card's 11–12px lines below WCAG AA (axe:
    // 3.7–4.4:1). It recedes on text tokens the preset holds at ≥ 4.5:1 instead.
    expect(card.className).not.toMatch(/\bopacity-/);
    expect(within(card).getByText('Confirm Priti’s visit')).toHaveClass(
      'text-muted-foreground-strong',
    );
    expect(within(card).getByText(/^Laser session not confirmed\./)).toHaveClass(
      'text-muted-foreground',
    );
    expect(within(card).getByText('Owner: Riya (you)')).toHaveClass(
      'text-muted-foreground',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads a close the server made by its due label alone — its "Done by …" once', async () => {
    const doneByServer = `Done by ${PRODUCT_NAME}`;
    renderQueue({
      entries: [
        {
          row: taskRowFixture({
            status: 'done',
            resultText: doneByServer,
            isResolvedAutomatically: true,
            resolvedAt: '2026-10-04T04:50:00.000Z',
          }),
          result: '',
          busy: false,
        },
      ],
    });
    const card = await screen.findByTestId('today-queue-card');
    expect(card).toHaveAttribute('data-closed', 'true');
    expect(card.textContent?.split(doneByServer)).toHaveLength(2);
    expect(card).not.toHaveTextContent('✓');
  });

  it('keeps an open card on the full-strength text steps', async () => {
    renderQueue();
    const card = await screen.findByTestId('today-queue-card');
    expect(within(card).getByText(/^Laser session not confirmed\./)).toHaveClass(
      'text-foreground-soft',
    );
    expect(within(card).getByText('Owner: Riya (you)')).toHaveClass(
      'text-muted-foreground-strong',
    );
  });

  it('records an outcome, and waits while one is on its way', async () => {
    const user = userEvent.setup();
    const onOutcome = vi.fn();
    const { unmount } = renderQueue({ onOutcome });
    await user.click(await screen.findByRole('button', { name: 'No answer' }));
    expect(onOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ id: taskRowFixture().id }),
      'noAnswer',
    );
    unmount();
    renderQueue({ entries: [{ ...open(), busy: true }] });
    for (const button of await screen.findAllByTestId('today-queue-outcome')) {
      expect(button).toBeDisabled();
    }
  });

  it('draws only the outcomes the member can run — none: the card reads only', async () => {
    const { unmount } = renderQueue({
      outcomesOf: (row) => everyOutcome(row).filter((plan) => plan.id === 'noAnswer'),
    });
    const card = await screen.findByTestId('today-queue-card');
    expect(
      within(card)
        .getAllByTestId('today-queue-outcome')
        .map((button) => button.textContent),
    ).toEqual(['No answer']);
    unmount();
    renderQueue({ outcomesOf: () => [] });
    const readOnly = await screen.findByTestId('today-queue-card');
    expect(within(readOnly).queryByRole('button')).not.toBeInTheDocument();
    expect(readOnly).toHaveTextContent('Owner: Riya (you)');
  });

  it('switches between Mine and Everyone', async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    renderQueue({ onScopeChange });
    const mine = await screen.findByTestId('today-queue-scope-mine');
    expect(mine).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('today-queue-scope-everyone')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(screen.getByTestId('today-queue-scope-everyone'));
    expect(onScopeChange).toHaveBeenCalledWith('everyone');
  });

  it('reads the To do line when nothing is left, and shows bars while loading', async () => {
    const { unmount } = renderQueue({ entries: [] });
    expect(await screen.findByTestId('today-queue-empty')).toHaveTextContent(
      'Nothing needs you right now.',
    );
    unmount();
    renderQueue({ entries: [], loading: true });
    await screen.findByTestId('today-queue');
    expect(screen.queryByTestId('today-queue-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('today-queue-card')).not.toBeInTheDocument();
  });
});
