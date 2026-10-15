import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  enquiry,
  floorRow,
  publicId,
} from '../../__tests__/integration/today-fixtures.ts';

/** A row's id for the tests. */
const rowId = (n: number) => publicId('appt', n);
import { rememberVisitCard, takeVisitCard } from '../../today.focus.ts';
import { groupTodayLanes, type TodayCard } from '../../today.lanes.ts';
import { LanePanel, type LanePanelProps, SPOTLIGHT_MS } from './LanePanel.tsx';

/** 10:42 in the clinic (IST) on the seed day. */
const NOW = new Date('2026-10-03T05:12:00.000Z');

const LANES = groupTodayLanes(
  [
    floorRow({
      id: rowId(1),
      status: 'checked_in',
      startTime: '10:40',
      checkedInAt: '2026-10-03T05:06:00.000Z',
      roomName: 'Room 2',
    }),
    floorRow({
      id: rowId(2),
      status: 'checked_in',
      visitStage: 'pharmacy',
      startTime: '09:40',
      prescription: {
        id: publicId('rx', 9),
        patientId: publicId('pat', 2),
        approvedAt: '2026-10-03T04:35:00.000Z',
        items: 3,
      },
    }),
    floorRow({
      id: rowId(4),
      status: 'checked_in',
      visitStage: 'with_doctor',
      startTime: '09:50',
    }),
    floorRow({
      id: rowId(5),
      status: 'checked_in',
      visitStage: 'checkout',
      startTime: '09:20',
    }),
  ],
  [enquiry({ id: rowId(3) })],
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
beforeEach(() => {
  useLocaleStore.setState({ hourCycle: 'h23' });
});
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
    expect(card).toHaveTextContent('Waiting 6 min');
    expect(within(card).getByTestId('today-card-action')).toHaveTextContent('Send in');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the pharmacy’s Rx, the doctor without a room and an enquiry’s interest', async () => {
    const { unmount } = renderPanel({ lane: 'pharmacy', cards: LANES.pharmacy });
    const pharmacy = await screen.findByTestId('today-card');
    expect(pharmacy).toHaveTextContent('3 medicines prescribed');
    expect(pharmacy).toHaveTextContent('Rx approved 10:05');
    expect(within(pharmacy).getByTestId('today-card-action')).toHaveTextContent(
      'Dispense',
    );
    unmount();
    const consult = renderPanel({ lane: 'with_doctor', cards: LANES.with_doctor });
    expect(
      within(await screen.findByTestId('today-card')).getByTestId('today-card-open'),
    ).toHaveTextContent('Meera Joshi09:50Hydrafacial · Dr. Nisha');
    consult.unmount();
    renderPanel({ lane: 'enquiries', cards: LANES.enquiries });
    const asked = await screen.findByTestId('today-card');
    expect(within(asked).getByTestId('today-card-open')).toHaveTextContent(
      'Anaya Desai10:31Clinical',
    );
    expect(asked).toHaveTextContent('WhatsApp');
    expect(asked).toHaveTextContent('New lead');
  });

  it('says what a Checkout card owes on today’s bills — the page’s read, by person', async () => {
    // The flag's words, as the locale spec adds them.
    i18n.addResource('en', 'today', 'flags.toPay', '{{amount}} to pay');
    const [checkout] = LANES.checkout;
    if (checkout?.kind !== 'booking') throw new Error('no checkout card');
    const { unmount } = renderPanel({
      lane: 'checkout',
      cards: LANES.checkout,
      dues: new Map([[checkout.row.contactId, 1500.5]]),
    });
    expect(await screen.findByTestId('today-card')).toHaveTextContent('₹1,500.50 to pay');
    unmount();
    // No bills read: no amount.
    renderPanel({ lane: 'checkout', cards: LANES.checkout });
    expect(await screen.findByTestId('today-card')).not.toHaveTextContent('to pay');
  });

  it('draws a wait meter on Waiting and With-doctor cards, and times an arrival', async () => {
    const { unmount } = renderPanel();
    // Waiting 6 of the 30-minute mark: calm.
    const meter = within(await screen.findByTestId('today-card')).getByTestId(
      'today-card-wait',
    );
    expect(meter).toHaveAttribute('data-level', 'calm');
    expect(meter).toHaveAttribute('aria-hidden', 'true');
    unmount();
    const arriving = groupTodayLanes(
      [floorRow({ id: rowId(6), startTime: '10:30' })],
      [],
    ).arriving;
    renderPanel({ lane: 'arriving', cards: arriving });
    const card = await screen.findByTestId('today-card');
    expect(card).toHaveTextContent('Late 12 min');
    expect(within(card).queryByTestId('today-card-wait')).not.toBeInTheDocument();
  });

  it('spotlights a picked card: into view, its name focused, ringed for 2s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      renderPanel({ spotlight: { cardId: rowId(1), nonce: 1 } });
      const card = await screen.findByTestId('today-card');
      await vi.waitFor(() => expect(card).toHaveAttribute('data-spotlight', 'true'));
      expect(within(card).getByTestId('today-card-open')).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'nearest' }),
      );
      // The lane's picked ring (the tone's `selected`), only while lit.
      expect(card.className).toContain('inset-ring-tone-butter-edge');
      // The ring's timer starts once the lit card has rendered.
      await act(async () => {});
      await act(async () => {
        vi.advanceTimersByTime(SPOTLIGHT_MS);
      });
      expect(card).not.toHaveAttribute('data-spotlight');
      expect(card.className).not.toContain('inset-ring-tone-butter-edge');
    } finally {
      vi.useRealTimers();
    }
  });

  it('lights nothing for a card not in the lane', async () => {
    renderPanel({ spotlight: { cardId: rowId(9), nonce: 1 } });
    const card = await screen.findByTestId('today-card');
    expect(card).not.toHaveAttribute('data-spotlight');
  });

  it('opens the person from the name area and runs the lane action', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const act = vi.fn();
    renderPanel({ onOpen, actionOf: () => act });
    await user.click(await screen.findByTestId('today-card-open'));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining<Partial<TodayCard>>({ id: rowId(1) }),
    );
    await user.click(screen.getByTestId('today-card-action'));
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('gives focus back to the card whose action opened the visit flow (§7.2)', async () => {
    rememberVisitCard(rowId(1));
    const { unmount } = renderPanel();
    await vi.waitFor(() => expect(screen.getByTestId('today-card-action')).toHaveFocus());
    unmount();

    rememberVisitCard(rowId(1));
    renderPanel({ actionOf: () => null });
    await vi.waitFor(() => expect(screen.getByTestId('today-card-open')).toHaveFocus());
  });

  it('focuses nothing when the card has left the lane, and forgets it', async () => {
    rememberVisitCard(rowId(7));
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
    const empty = await screen.findByTestId('today-empty');
    expect(empty).toHaveTextContent('No one here right now.');
    // The lane's own tone and glyph, the disc in the card colour on the tint.
    expect(empty).toHaveAttribute('data-tone', 'sage');
    expect(within(empty).getByTestId('empty-state-illustration').children[1]).toHaveClass(
      'bg-card',
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
