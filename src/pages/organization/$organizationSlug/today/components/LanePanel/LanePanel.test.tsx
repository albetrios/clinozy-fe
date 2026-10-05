import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { enquiry, floorRow, uuid } from '../../__tests__/integration/today-fixtures.ts';
import { rememberVisitCard, takeVisitCard } from '../../today.focus.ts';
import { groupTodayLanes, type TodayCard } from '../../today.lanes.ts';
import { LanePanel, type LanePanelProps } from './LanePanel.tsx';

/** 10:42 in the clinic (IST) on the seed day. */
const NOW = new Date('2026-10-03T05:12:00.000Z');

const LANES = groupTodayLanes(
  [
    floorRow({
      id: uuid(1),
      status: 'checked_in',
      startTime: '10:40',
      checkedInAt: '2026-10-03T05:06:00.000Z',
      dueTotal: 70_000,
      pack: { used: 3, total: 6 },
      room: 'room_2',
    }),
    floorRow({
      id: uuid(2),
      status: 'completed',
      startTime: '09:40',
      prescription: { id: uuid(9), approvedAt: '2026-10-03T04:35:00.000Z', items: 3 },
    }),
  ],
  [enquiry({ id: uuid(3) })],
);

function renderPanel(props: Partial<LanePanelProps> = {}) {
  return renderWithProviders(
    <LanePanel
      lane="waiting"
      cards={LANES.waiting}
      now={NOW}
      today="2026-10-03"
      actionOf={() => vi.fn()}
      onOpen={vi.fn()}
      {...props}
    />,
  );
}

const initialHourCycle = useLocaleStore.getState().hourCycle;
beforeEach(() => useLocaleStore.setState({ hourCycle: 'h23' }));
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('LanePanel (KICKOFF §6.2 Selected lane panel, Visit cards)', () => {
  it('names the lane and its people, and draws each card', async () => {
    const { container } = renderPanel();
    const panel = await screen.findByRole('region', { name: 'Waiting' });
    expect(panel).toHaveTextContent('1 person');
    const card = within(panel).getByTestId('today-card');
    expect(within(card).getByTestId('today-card-open')).toHaveTextContent(
      'Meera Joshi10:40Hydrafacial · Room 2',
    );
    expect(card).toHaveTextContent('Pack 3 left');
    expect(card).toHaveTextContent(/Due ₹\s?700/);
    expect(card).toHaveTextContent('Waiting 6 min');
    expect(within(card).getByTestId('today-card-action')).toHaveTextContent('Send in');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the pharmacy’s Rx and an enquiry’s words', async () => {
    const { unmount } = renderPanel({ lane: 'pharmacy', cards: LANES.pharmacy });
    const pharmacy = await screen.findByTestId('today-card');
    expect(pharmacy).toHaveTextContent('3 medicines prescribed');
    expect(pharmacy).toHaveTextContent('Rx approved 10:05');
    expect(within(pharmacy).getByTestId('today-card-action')).toHaveTextContent(
      'Dispense',
    );
    unmount();
    renderPanel({ lane: 'enquiries', cards: LANES.enquiries });
    const asked = await screen.findByTestId('today-card');
    expect(asked).toHaveTextContent('Anaya Desai10:31Clinical — Is Saturday possible?');
    expect(asked).toHaveTextContent('WhatsApp');
    expect(asked).toHaveTextContent('New lead');
  });

  it('opens the person from the name area and runs the lane action', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const act = vi.fn();
    renderPanel({ onOpen, actionOf: () => act });
    await user.click(await screen.findByTestId('today-card-open'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining<Partial<TodayCard>>({ id: uuid(1) }),
    );
    await user.click(screen.getByTestId('today-card-action'));
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the card whose action opened the Visit sheet (§7.2)', async () => {
    rememberVisitCard(uuid(1));
    const { unmount } = renderPanel();
    await vi.waitFor(() => expect(screen.getByTestId('today-card-action')).toHaveFocus());
    unmount();

    rememberVisitCard(uuid(1));
    renderPanel({ actionOf: () => null });
    await vi.waitFor(() => expect(screen.getByTestId('today-card-open')).toHaveFocus());
  });

  it('focuses nothing when the card has left the lane, and forgets it', async () => {
    rememberVisitCard(uuid(7));
    renderPanel();
    await screen.findByTestId('today-card');
    expect(document.body).toHaveFocus();
    expect(takeVisitCard()).toBeNull();
  });

  it('hides an action the member can’t take', async () => {
    renderPanel({ actionOf: () => null });
    await screen.findByTestId('today-card');
    expect(screen.queryByTestId('today-card-action')).not.toBeInTheDocument();
  });

  it('says so when no one is in the lane, and shows bars while the floor loads', async () => {
    const { unmount } = renderPanel({ lane: 'treatment', cards: [] });
    expect(await screen.findByTestId('today-empty')).toHaveTextContent(
      'No one here right now.',
    );
    expect(screen.getByRole('region', { name: 'Treatment' })).toHaveTextContent(
      '0 people',
    );
    unmount();
    renderPanel({ loading: true });
    await screen.findByTestId('today-panel');
    expect(screen.queryByTestId('today-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('today-empty')).not.toBeInTheDocument();
  });
});
