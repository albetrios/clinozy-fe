import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { floorRow, uuid } from '../../__tests__/integration/today-fixtures.ts';
import { groupTodayLanes, todayFocus } from '../../today.lanes.ts';
import { LaneTiles } from './LaneTiles.tsx';

const NAMES = [
  'Rhea Shah',
  'Nikhil Rao',
  'Meera Joshi',
  'Faizan Shaikh',
  'Priti Soni',
  'Sana K',
];
const LANES = groupTodayLanes(
  NAMES.map((name, index) =>
    floorRow({
      id: uuid(index + 1),
      status: 'checked_in',
      startTime: `10:4${index}`,
      person: { ...floorRow().person, name },
    }),
  ),
  [],
);

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('LaneTiles (KICKOFF §6.2 Lane tiles)', () => {
  it('shows the seven lanes in order, the selected one pressed', async () => {
    const { container } = renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus(['owner'])}
        today="2026-10-03"
        onSelect={vi.fn()}
      />,
    );
    const group = await screen.findByRole('group', { name: 'Lanes' });
    const tiles = within(group).getAllByRole('button');
    expect(tiles.map((tile) => tile.firstChild?.textContent)).toEqual([
      'Enquiries',
      'Arriving',
      'Waiting',
      'With doctor',
      'Treatment',
      'Checkout',
      'Pharmacy',
    ]);
    expect(tiles.map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('counts, shows four faces then "+N", and hints the earliest time', async () => {
    renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus(['owner'])}
        today="2026-10-03"
        onSelect={vi.fn()}
      />,
    );
    const waiting = await screen.findByTestId('today-lane-waiting');
    expect(waiting).toHaveTextContent(/^Waiting6RSNRMJFS\+2since 10:40$/);
    expect(screen.getByTestId('today-lane-pharmacy')).toHaveTextContent(/^Pharmacy0—$/);
  });

  it('dims the lanes outside the member’s focus to 60%', async () => {
    renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus(['doctor'])}
        today="2026-10-03"
        onSelect={vi.fn()}
      />,
    );
    const dimmed = (await screen.findAllByRole('button'))
      .filter((tile) => tile.dataset.dimmed === 'true')
      .map((tile) => tile.dataset.testid);
    expect(dimmed).toEqual([
      'today-lane-enquiries',
      'today-lane-arriving',
      'today-lane-treatment',
      'today-lane-checkout',
      'today-lane-pharmacy',
    ]);
    expect(screen.getByTestId('today-lane-arriving')).toHaveClass('opacity-60');
    expect(screen.getByTestId('today-lane-waiting')).not.toHaveClass('opacity-60');
  });

  it('selects a lane on click, and is a snap strip below md, a grid from md', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus([])}
        today="2026-10-03"
        onSelect={onSelect}
      />,
    );
    await user.click(await screen.findByTestId('today-lane-checkout'));
    expect(onSelect).toHaveBeenCalledWith('checkout');
    const strip = screen.getByTestId('today-lanes');
    expect(strip).toHaveClass(
      'snap-x',
      'snap-mandatory',
      'overflow-x-auto',
      '-mx-3',
      'px-3',
    );
    // 106px tracks: a 12-hour "since 10:40 AM" fits in one line at 1024.
    expect(strip).toHaveClass(
      'md:grid',
      'md:grid-cols-[repeat(auto-fill,minmax(106px,1fr))]',
    );
    expect(screen.getByTestId('today-lane-checkout')).toHaveClass(
      'w-32',
      'snap-start',
      'md:w-auto',
    );
  });
});
