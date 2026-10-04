import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import { ASHA, taskRowFixture } from '@/tests/utils/task-row-fixture.ts';

import type { WorkQueueEntry } from '../../hooks/useWorkQueue/index.ts';
import { WorkQueue, type WorkQueueProps } from './WorkQueue.tsx';

/** 10:42 in the clinic (IST) on 4 Oct. */
const NOW = new Date('2026-10-04T05:12:00.000Z');

const open = (patch = {}): WorkQueueEntry => ({
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
      onOutcome={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('WorkQueue (KICKOFF §6.2 Work queue aside; one task model, Q-T3)', () => {
  it('heads the queue with every open task, and draws a task with its rule’s outcomes', async () => {
    const { container } = renderQueue();
    const queue = await screen.findByRole('complementary', { name: 'Work queue' });
    expect(queue).toHaveTextContent('8 open · each has an owner and a due time');
    const card = within(queue).getByTestId('today-queue-card');
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

  it('reds an overdue due label and names other owners — or Anyone', async () => {
    renderQueue({
      entries: [
        open({
          id: '33333333-3333-4333-8333-000000000001',
          dueAt: '2026-10-04T04:32:00.000Z',
        }),
        open({
          id: '33333333-3333-4333-8333-000000000002',
          owner: ASHA,
          ownerId: ASHA.id,
          ownedByViewer: false,
        }),
        open({
          id: '33333333-3333-4333-8333-000000000003',
          owner: null,
          ownerId: null,
          ownedByViewer: false,
        }),
      ],
    });
    const [late, asha, nobody] = await screen.findAllByTestId('today-queue-card');
    expect(late).toHaveTextContent('40 min overdue');
    expect(within(late as HTMLElement).getByText('40 min overdue')).toHaveClass(
      'text-tone-blush-foreground',
    );
    expect(asha).toHaveTextContent('Owner: Asha M.');
    expect(nobody).toHaveTextContent('Owner: Anyone');
  });

  it('closes a card in place with its result, at 70%', async () => {
    renderQueue({
      entries: [
        {
          row: taskRowFixture(),
          result: 'Confirmed on call · reminder stays',
          busy: false,
        },
      ],
    });
    const card = await screen.findByTestId('today-queue-card');
    expect(card).toHaveTextContent('✓ Confirmed on call · reminder stays');
    expect(card).toHaveClass('opacity-70');
    expect(within(card).queryByTestId('today-queue-outcome')).not.toBeInTheDocument();
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
