import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { TODAY_LANES } from '@/shared/api/app/today-contracts.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  enquiry,
  floorRow,
  publicId,
} from '../../__tests__/integration/today-fixtures.ts';
import { todayAttention } from '../../today.attention.ts';
import { groupTodayLanes, type TodayCard } from '../../today.lanes.ts';
import {
  NEEDS_YOU_NOW_VISIBLE,
  NeedsYouNow,
  type NeedsYouNowProps,
} from './NeedsYouNow.tsx';

/** 10:42 in the clinic (IST) on the seed day. */
const NOW = new Date('2026-10-03T05:12:00.000Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const id = (n: number) => publicId('appt', n);

const LANES = groupTodayLanes(
  [
    floorRow({ id: id(1), name: 'Rahul Mehta', startTime: '10:24', roomName: 'Room 2' }),
    floorRow({
      id: id(2),
      name: 'Ananya Rao',
      status: 'checked_in',
      checkedInAt: ago(32),
    }),
    floorRow({
      id: id(3),
      name: 'Om Prakash',
      status: 'checked_in',
      visitStage: 'with_doctor',
      visitStageChangedAt: ago(50),
    }),
    floorRow({
      id: id(4),
      name: 'Priya Shah',
      contactId: publicId('con', 4),
      status: 'checked_in',
      visitStage: 'checkout',
      visitStageChangedAt: ago(8),
    }),
    floorRow({
      id: id(5),
      name: 'Sara Khan',
      status: 'checked_in',
      visitStage: 'pharmacy',
      prescription: {
        id: publicId('rx', 5),
        patientId: publicId('pat', 5),
        approvedAt: ago(12),
        items: 2,
      },
    }),
    floorRow({ id: id(6), name: 'Ishaan Sen', startTime: '10:42' }),
    floorRow({ id: id(7), name: 'Kavya Rao', startTime: '10:48' }),
  ],
  [enquiry({ id: publicId('lead', 8), name: 'Anaya Desai', lastActivityAt: ago(150) })],
);

const ITEMS = todayAttention({
  lanes: LANES,
  now: NOW,
  dues: new Map([[publicId('con', 4), 1500]]),
  focus: new Set(),
  visible: TODAY_LANES,
});

function renderList(props: Partial<NeedsYouNowProps> = {}) {
  return renderWithProviders(
    <NeedsYouNow
      items={ITEMS}
      now={NOW}
      today="2026-10-03"
      actionOf={() => vi.fn()}
      onOpen={vi.fn()}
      onJump={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('NeedsYouNow (change-today-command-center — the triage list)', () => {
  it('names the section, counts its items and shows the first three, ranked', async () => {
    const { container } = renderList();
    const section = await screen.findByRole('region', { name: 'Needs you now' });
    expect(section).toHaveTextContent(`Needs you now${ITEMS.length}`);
    const list = within(section).getByRole('list');
    const rows = within(list).getAllByTestId('today-attention-row');
    expect(rows).toHaveLength(NEEDS_YOU_NOW_VISIBLE);
    expect(list.tagName).toBe('OL');
    expect(rows.map((row) => row.dataset.tier)).toEqual(['hot', 'hot', 'hot']);
    expect(rows[0]).toHaveTextContent('No reply 2 h');
    expect(rows[0]).toHaveTextContent('Anaya Desai');
    expect(rows[0]).toHaveTextContent('last heard 08:12 · Clinical');
    // Each against its own hot mark: late 18/15 before in room 50/45 before waiting 32/30.
    expect(rows[1]).toHaveTextContent('Late 18 min');
    expect(rows[2]).toHaveTextContent('In room 50 min');
    expect(rows[2]).toHaveTextContent('since 09:52');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('words every kind of item: late, due, to pay, Rx ready', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByTestId('today-attention-more'));
    const text = (kind: string) =>
      screen
        .getAllByTestId('today-attention-row')
        .filter((row) => row.dataset.kind === kind)
        .map((row) => row.textContent);
    expect(text('late')).toEqual([expect.stringContaining('Late 18 min')]);
    expect(text('late')[0]).toContain('booked 10:24 · Hydrafacial · Room 2');
    expect(text('checkout')[0]).toContain('₹1,500 to pay');
    expect(text('rx')[0]).toContain('Rx ready');
    expect(text('rx')[0]).toContain('approved 10:30');
    expect(text('due')).toEqual([
      expect.stringContaining('Due now'),
      expect.stringContaining('In 6 min'),
    ]);
  });

  it('opens the rest and folds them again', async () => {
    const user = userEvent.setup();
    renderList();
    const more = await screen.findByRole('button', {
      name: `Show ${ITEMS.length - NEEDS_YOU_NOW_VISIBLE} more`,
    });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await user.click(more);
    expect(screen.getAllByTestId('today-attention-row')).toHaveLength(ITEMS.length);
    const less = screen.getByRole('button', { name: 'Show less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    await user.click(less);
    expect(screen.getAllByTestId('today-attention-row')).toHaveLength(
      NEEDS_YOU_NOW_VISIBLE,
    );
  });

  it('opens the person, jumps to their card and runs the lane’s action', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onJump = vi.fn();
    const send = vi.fn();
    renderList({
      onOpen,
      onJump,
      actionOf: (card: TodayCard) => (card.lane === 'waiting' ? send : null),
    });
    // The wait ranks fourth: open the rest.
    await user.click(await screen.findByTestId('today-attention-more'));
    const waiting = screen
      .getAllByTestId('today-attention-row')
      .find((row) => row.dataset.kind === 'waiting');
    if (!waiting) throw new Error('no waiting row');
    await user.click(within(waiting).getByTestId('today-attention-open'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: id(2) }));
    await user.click(
      within(waiting).getByRole('button', { name: 'Show Ananya Rao in Waiting' }),
    );
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ id: id(2) }));
    await user.click(
      within(waiting).getByRole('button', { name: 'Send in, Ananya Rao' }),
    );
    expect(send).toHaveBeenCalledTimes(1);
    // No action the member can take (or none in the lane): no button.
    const [reply] = screen.getAllByTestId('today-attention-row');
    expect(
      within(reply as HTMLElement).queryByTestId('today-attention-action'),
    ).toBeNull();
  });

  it('says all is calm with nothing to do, and shows bars while the floor loads', async () => {
    const { unmount } = renderList({ items: [] });
    expect(await screen.findByTestId('today-attention-calm')).toHaveTextContent(
      'All calm — no one is waiting on you.',
    );
    expect(screen.queryByTestId('today-attention-more')).not.toBeInTheDocument();
    unmount();
    renderList({ loading: true });
    const section = await screen.findByTestId('today-attention');
    expect(within(section).queryByTestId('today-attention-row')).toBeNull();
    expect(within(section).queryByTestId('today-attention-calm')).toBeNull();
  });
});
