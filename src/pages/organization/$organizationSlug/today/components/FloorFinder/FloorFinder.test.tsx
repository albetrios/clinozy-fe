import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
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
import { groupTodayLanes } from '../../today.lanes.ts';
import { FloorFinder, type FloorFinderProps } from './FloorFinder.tsx';

const id = (n: number) => publicId('appt', n);

const LANES = groupTodayLanes(
  [
    floorRow({ id: id(1), name: 'Riya Shah', startTime: '10:00', roomName: 'Room 2' }),
    floorRow({
      id: id(2),
      name: 'Riya Kapoor',
      phone: '+919811122233',
      status: 'checked_in',
      startTime: '09:30',
    }),
  ],
  [enquiry({ id: publicId('lead', 3), name: 'Kabir Bose' })],
);

function renderFinder(props: Partial<FloorFinderProps> = {}) {
  return renderWithProviders(
    <FloorFinder
      lanes={LANES}
      visible={TODAY_LANES}
      today="2026-10-03"
      onPick={vi.fn()}
      onSearchEveryone={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('FloorFinder (change-today-command-center — find someone on the floor)', () => {
  it('is a combobox that lists who on the floor a name matches — their lane, time and service', async () => {
    const user = userEvent.setup();
    const { container } = renderFinder();
    const input = await screen.findByRole('combobox', {
      name: 'Find someone on today’s floor',
    });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('today-finder')).toHaveTextContent('/');

    await user.type(input, 'riya');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const list = screen.getByRole('listbox', { name: 'Find someone on today’s floor' });
    const options = within(list).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Riya ShahHydrafacial · Room 2Arriving10:00',
      'Riya KapoorHydrafacial · Dr. NishaWaiting09:30',
    ]);
    // The match in bold, the first option highlighted.
    expect(options[0]?.querySelector('mark')).toHaveTextContent('Riya');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]?.id);
    expect(screen.getByRole('status')).toHaveTextContent('Found on the floor: 2');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves with the arrows, picks with Enter, then clears', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderFinder({ onPick });
    const input = await screen.findByRole('combobox');
    await user.type(input, 'riya');
    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: id(2) }));
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks with a click, keeping focus in the field until then', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderFinder({ onPick });
    await user.type(await screen.findByRole('combobox'), '98111');
    const [option] = screen.getAllByRole('option');
    if (!option) throw new Error('no option');
    await user.hover(option);
    await user.click(option);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: id(2) }));
  });

  it('closes on Escape, then clears on a second one', async () => {
    const user = userEvent.setup();
    renderFinder();
    const input = await screen.findByRole('combobox');
    await user.type(input, 'kab');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('kab');
    expect(input).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    // Typing opens it again.
    await user.type(input, 'k');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('says no one matches and offers every contact — a click or Enter', async () => {
    const user = userEvent.setup();
    const onSearchEveryone = vi.fn();
    renderFinder({ onSearchEveryone });
    const input = await screen.findByRole('combobox');
    await user.type(input, 'zed');
    expect(screen.getByTestId('today-finder-none')).toHaveTextContent(
      'No one by that name on today’s floor.',
    );
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('status')).toHaveTextContent(
      'No one by that name on today’s floor.',
    );
    await user.click(screen.getByRole('button', { name: 'Search all contacts' }));
    expect(onSearchEveryone).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');
    await user.type(input, 'zed{Enter}');
    expect(onSearchEveryone).toHaveBeenCalledTimes(2);
  });

  it('closes when the field loses focus, and hands the page its input', async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLInputElement>();
    renderFinder({ inputRef: ref, onSearchEveryone: undefined });
    const input = await screen.findByRole('combobox');
    expect(ref.current).toBe(input);
    await user.type(input, 'zed');
    // Without a way to every contact: the words alone.
    expect(screen.queryByTestId('today-finder-everyone')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    await user.tab();
    expect(screen.queryByTestId('today-finder-none')).not.toBeInTheDocument();
  });
});
