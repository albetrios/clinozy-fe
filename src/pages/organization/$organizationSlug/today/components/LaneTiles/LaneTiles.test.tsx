import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { floorRow, publicId } from '../../__tests__/integration/today-fixtures.ts';
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
      id: publicId('appt', index + 1),
      status: 'checked_in',
      startTime: `10:4${index}`,
      name,
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

  it('dims the lanes outside the member’s focus — their fill at 60%, their text a step lighter', async () => {
    const { container } = renderWithProviders(
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

    // The design's 60% opacity took the tile's 11–12px lines to 2.5–3.0:1 (under
    // WCAG AA). The surface keeps the 60%; the text recedes on AA-safe steps.
    const arriving = screen.getByTestId('today-lane-arriving');
    expect(arriving.className).not.toMatch(/\bopacity-/);
    expect(arriving).toHaveClass('bg-tone-sky/60', 'border-tone-sky-border/60');
    expect(within(arriving).getByText('Arriving')).toHaveClass(
      'text-muted-foreground-strong',
    );
    expect(within(arriving).getByText('0')).toHaveClass('text-foreground-soft');

    // A lane in focus keeps its full fill and the lane's ink.
    const waiting = screen.getByTestId('today-lane-waiting');
    expect(waiting).toHaveClass('bg-tone-butter');
    expect(waiting).not.toHaveAttribute('data-dimmed');
    expect(within(waiting).getByText('Waiting')).toHaveClass(
      'text-tone-butter-foreground',
    );
    expect(within(waiting).getByText('6')).not.toHaveClass('text-foreground-soft');

    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps a dimmed lane’s faces in the faded fill, their initials a step lighter', async () => {
    renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="enquiries"
        focus={todayFocus(['pharmacist'])}
        today="2026-10-03"
        onSelect={vi.fn()}
      />,
    );
    const waiting = await screen.findByTestId('today-lane-waiting');
    expect(waiting).toHaveAttribute('data-dimmed', 'true');
    const face = within(waiting).getByText('RS');
    expect(face).toHaveClass('border-tone-butter/60', 'text-muted-foreground-strong');
    expect(face).not.toHaveClass('text-tone-butter-foreground');
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
    // 106px tracks: a 12-hour "since 10:40 AM" fits in one line at 1024; from
    // `lg` 114px, so "oldest 12:40 PM" does too at 1280 (seven 125px tiles).
    expect(strip).toHaveClass(
      'md:grid',
      'md:grid-cols-[repeat(auto-fill,minmax(106px,1fr))]',
      'lg:grid-cols-[repeat(auto-fill,minmax(114px,1fr))]',
    );
    expect(screen.getByTestId('today-lane-checkout')).toHaveClass(
      'w-32',
      'snap-start',
      'md:w-auto',
    );
  });
});
