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

  it('edges the pressed tile in its lane’s own hue with a halo, never its ink', async () => {
    renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus(['owner'])}
        today="2026-10-03"
        onSelect={vi.fn()}
      />,
    );
    const group = await screen.findByRole('group', { name: 'Lanes' });
    const waiting = within(group).getByRole('button', { pressed: true });
    expect(waiting).toHaveClass('border-[color:var(--tw-inset-ring-color)]', 'ring-3');
    expect(waiting).toHaveClass('inset-ring-tone-butter-edge');
    expect(waiting).not.toHaveClass('border-tone-butter-foreground');
    const arriving = within(group).getAllByRole('button', { pressed: false })[1];
    expect(arriving).toHaveClass(
      'inset-ring-tone-sky-edge',
      'hover:border-[color:var(--tw-inset-ring-color)]',
    );
    expect(arriving).not.toHaveClass('ring-3');
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

  it('selects a lane on click, and is one connected strip — snapping wherever it scrolls', async () => {
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
      'flex',
      'snap-x',
      'snap-mandatory',
      'overflow-x-auto',
      '-mx-3',
      'px-3',
    );
    // One row at every width: from `md` the tiles share it, each at least 116px (the widest
    // 12-hour hint, "oldest 12:40 PM", on one line); no grid that wraps.
    expect(strip.className).not.toContain('md:grid');
    expect(screen.getByTestId('today-lane-checkout')).toHaveClass(
      'w-32',
      'snap-start',
      'md:w-auto',
      'md:min-w-29',
      'md:flex-1',
    );
    // A chevron between each pair of tiles, hidden from assistive tech, flipped under RTL.
    const chevrons = strip.querySelectorAll(':scope > svg');
    expect(chevrons).toHaveLength(6);
    for (const chevron of chevrons) {
      expect(chevron).toHaveAttribute('aria-hidden', 'true');
      expect(chevron.getAttribute('class')).toContain('rtl:-scale-x-100');
    }
  });

  it('badges a lane’s late, long-waiting or unanswered people — the words in its name', async () => {
    const { container } = renderWithProviders(
      <LaneTiles
        lanes={LANES}
        selected="waiting"
        focus={todayFocus([])}
        today="2026-10-03"
        alerts={{
          arriving: { kind: 'late', count: 2, hot: true },
          waiting: { kind: 'waiting', count: 1, hot: false },
        }}
        onSelect={vi.fn()}
      />,
    );
    const arriving = await screen.findByTestId('today-lane-arriving');
    const late = within(arriving).getByTestId('today-lane-alert');
    expect(late).toHaveAttribute('data-hot', 'true');
    expect(late.className).toContain('bg-tone-blush');
    expect(arriving).toHaveAccessibleName(expect.stringContaining('Running late: 2'));
    const waiting = within(screen.getByTestId('today-lane-waiting')).getByTestId(
      'today-lane-alert',
    );
    expect(waiting).not.toHaveAttribute('data-hot');
    expect(waiting.className).toContain('bg-tone-butter');
    expect(waiting).toHaveTextContent('Waiting long: 1');
    expect(
      within(screen.getByTestId('today-lane-checkout')).queryByTestId('today-lane-alert'),
    ).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
