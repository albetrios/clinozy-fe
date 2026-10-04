import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as dayCloseApi from '@/shared/api/clinic/day-close-api.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderPaymentsRoutes,
  resetPaymentsRoutes,
} from '../../__tests__/integration/payments-test-router.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const LEDGER = '/organization/acme/payments';
const DAY_CLOSE = `${LEDGER}/day-close`;
const D = 'day-close-drawer';

const part = (id: string) => screen.getByTestId(`${D}-${id}`);
const reviewRows = () => screen.getAllByTestId(`${D}-review-row`);
const reviewRowOf = (ref: string) => {
  const row = reviewRows().find((candidate) => candidate.textContent?.includes(ref));
  if (!row) throw new Error(`no review row for ${ref}`);
  return row;
};

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Opens Day close and waits for its day to load. */
async function openDayClose(
  url = DAY_CLOSE,
  role?: Parameters<typeof renderPaymentsRoutes>[1],
) {
  const view = renderPaymentsRoutes(url, role);
  await screen.findByTestId(`${D}-status`);
  return view;
}

/** Accepts the opening cash from the gate and waits for the working strip. */
async function acceptOpening(user: ReturnType<typeof setUser>) {
  await user.click(await screen.findByTestId(`${D}-gate-accept`));
  await screen.findByTestId(`${D}-strip`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  useAuthStore.setState({
    user: { id: 'u', email: 'riya@cresence.skin', role: 'user', name: 'Riya Shah' },
  });
});
afterEach(() => {
  vi.useRealTimers();
  resetPaymentsRoutes();
  resetClinicFixtures();
  useAuthStore.setState({ user: null });
});

describe('Day close — the gate (payments.md:331; H:5114–5116)', () => {
  it('opens today on the opening cash it carries, with Recount and Accept', async () => {
    await openDayClose();
    const drawer = screen.getByTestId(D);
    expect(
      within(drawer).getByRole('heading', { name: 'Day close' }),
    ).toBeInTheDocument();
    expect(part('status')).toHaveTextContent('Open');
    expect(part('entries')).toHaveTextContent('6 entries on Oct 3');
    expect(part('gate')).toHaveTextContent('Opening cash · Today');
    expect(part('gate-amount')).toHaveTextContent('₹7,310');
    expect(part('gate-source')).toHaveTextContent('Carried from Oct 1 close');
    expect(part('gate-accept')).toHaveTextContent('Accept ₹7,310');
    expect(part('gate')).toHaveTextContent(
      'You’re starting the day as Riya S. · this is stamped on the day',
    );
    expect(part('review-progress')).toHaveTextContent('0 of 6 checked');
    expect(screen.queryByTestId(`${D}-close-day`)).not.toBeInTheDocument();
    // The drawer alone: the ledger behind sits outside any landmark in this harness.
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('accepts a recount: "Accept recount", then the strip stamps who and when', async () => {
    const user = setUser();
    await openDayClose();
    await user.type(part('gate-recount'), '7000');
    expect(part('gate-accept')).toHaveTextContent('Accept recount');
    await user.click(part('gate-accept'));
    await screen.findByTestId(`${D}-strip`);
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Opening cash ₹7,000 accepted · stamped 10:00 AM',
    );
    expect(part('strip-opening')).toHaveTextContent('₹7,000');
    expect(part('strip-opening')).toHaveTextContent('Accepted by Riya S. · 10:00 AM');
  });

  it('jumps to yesterday from its open-day chip — "auto-closes in 14 h"', async () => {
    const user = setUser();
    const { router } = await openDayClose();
    const chip = part('open-day-2026-10-02');
    expect(chip).toHaveTextContent('Oct 2 not closed · 14 h left · Review');
    expect(chip).toHaveAttribute(
      'title',
      'Review the entries and close it · it closes by itself when the time runs out',
    );
    await user.click(chip);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ date: '2026-10-02' }),
    );
    await waitFor(() =>
      expect(part('status')).toHaveTextContent('Open · auto-closes in 14 h'),
    );
    expect(part('gate')).toHaveTextContent('Opening cash · Yesterday');
    // The chips show only while today is reviewed.
    expect(screen.queryByTestId(`${D}-open-day-2026-10-02`)).not.toBeInTheDocument();
  });

  it('shows the opening without Accept to a role without the dayclose ability', async () => {
    await openDayClose(DAY_CLOSE, { role: 'counsellor' });
    expect(part('gate-amount')).toHaveTextContent('₹7,310');
    expect(screen.queryByTestId(`${D}-gate-accept`)).not.toBeInTheDocument();
    expect(part('gate')).toHaveTextContent('View only · your role can’t change this');
  });
});

describe('Day close — the working day (payments.md:73–80; Q-G5)', () => {
  it('nets each mode and the staff behind the receipts, and the expected cash', async () => {
    const user = setUser();
    await openDayClose();
    await acceptOpening(user);
    expect(part('strip-cash')).toHaveTextContent('+₹0−₹260');
    expect(part('strip-cash')).toHaveTextContent('Expected in drawer ₹7,050');
    expect(part('strip-mode-cash')).toHaveTextContent('Cash−₹260');
    expect(part('strip-mode-upi')).toHaveTextContent('UPI−₹1,400');
    expect(part('strip-mode-card')).toHaveTextContent('Card−₹1,350');
    expect(part('strip-mode-upi')).toHaveAttribute('title', 'In ₹1,800 · out ₹3,200');
    expect(screen.queryByTestId(`${D}-strip-mode-credit`)).not.toBeInTheDocument();
    const staff = within(part('strip-modes')).getAllByTestId(/-strip-staff-/);
    expect(staff.map((chip) => chip.getAttribute('title'))).toEqual([
      'Riya S. · 1 receipt · ₹3,650',
      'Farah A. · 2 receipts · ₹1,800',
    ]);
    expect(part('close-day')).toHaveTextContent('Close day');
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
  });

  it('asks for the count, shows the difference, and closes: the report', async () => {
    const user = setUser();
    await openDayClose();
    await acceptOpening(user);
    await user.click(part('close-day'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Count the cash first');
    expect(part('strip-difference')).toHaveTextContent('—');
    await user.type(part('strip-count-input'), '7050');
    expect(part('strip-difference')).toHaveTextContent('₹0');
    await user.clear(part('strip-count-input'));
    await user.type(part('strip-count-input'), '7000');
    expect(part('strip-difference')).toHaveTextContent('−₹50');
    await user.click(part('close-day'));
    await screen.findByTestId(`${D}-report`);
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Day closed · summary sent to admin on WhatsApp',
    );
    expect(part('status')).toHaveTextContent('Closed by Riya S.');
    const report = part('report');
    expect(report).toHaveTextContent('Today is closed');
    expect(report).toHaveTextContent('Closed by Riya S. · 10:00 AM');
    expect(part('report-opening')).toHaveTextContent('₹7,310Accepted by Riya S.');
    expect(part('report-collected')).toHaveTextContent('₹5,4503 received');
    expect(part('report-paid')).toHaveTextContent('₹8,4603 paid');
    expect(part('report-counted')).toHaveTextContent('₹7,000Expected ₹7,050');
    expect(part('report-difference')).toHaveTextContent('−₹50Short in drawer');
    expect(part('report-log-accepted')).toHaveTextContent(
      'Riya S. accepted the opening cash ₹7,310',
    );
    expect(part('report-log-counted')).toHaveTextContent(
      'Drawer counted at ₹7,000 · ₹50 short',
    );
    expect(part('report-log-closed')).toHaveTextContent(
      'Riya S. closed the day · summary sent to admin on WhatsApp',
    );
    expect(screen.queryByTestId(`${D}-close-day`)).not.toBeInTheDocument();
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
  });

  it('reopens today: "Day reopened", back to the working day on its count', async () => {
    const user = setUser();
    await openDayClose();
    await acceptOpening(user);
    await user.type(part('strip-count-input'), '7050');
    await user.click(part('close-day'));
    await screen.findByTestId(`${D}-report`);
    expect(part('report-difference')).toHaveTextContent('₹0Drawer matched');
    expect(part('report-log-counted')).toHaveTextContent(
      'Drawer counted at ₹7,050 · matched',
    );
    await user.click(part('report-reopen'));
    await screen.findByTestId(`${D}-strip`);
    expect(notifyMock.success).toHaveBeenLastCalledWith('Day reopened');
    expect(part('strip-count-input')).toHaveValue('7050');
  });
});

describe('Day close — a closed day and the previous closes', () => {
  it('reads a past closed day as its report, without Reopen', async () => {
    await openDayClose(`${DAY_CLOSE}?date=2026-10-01`);
    expect(part('report')).toHaveTextContent('Oct 1 is closed');
    expect(part('report-difference')).toHaveTextContent('+₹2,330Extra in drawer');
    expect(part('report-log-counted')).toHaveTextContent(
      'Drawer counted at ₹7,310 · ₹2,330 extra',
    );
    expect(screen.queryByTestId(`${D}-report-reopen`)).not.toBeInTheDocument();
  });

  it('reads a day the job closed as force-closed, taken as expected', async () => {
    await openDayClose(`${DAY_CLOSE}?date=2026-09-20`);
    expect(part('status')).toHaveTextContent('Force-closed');
    expect(part('report')).toHaveTextContent('auto-closed after the grace period');
    expect(part('report-opening')).toHaveTextContent('Taken as expected');
    expect(part('report-log-closed')).toHaveTextContent(
      'Auto-closed after the grace period · cash taken as expected',
    );
    expect(part('entries')).toHaveTextContent('0 entries on Sep 20');
    expect(part('review-progress')).toHaveTextContent('No entries');
  });

  it('lists the previous closes; a chip jumps to its day', async () => {
    const user = setUser();
    const { router } = await openDayClose();
    await user.click(part('previous'));
    expect(part('previous')).toHaveAttribute('aria-expanded', 'true');
    const chip = part('previous-2026-10-01');
    expect(chip).toHaveTextContent('Oct 1Cash ₹7,310+₹2,330');
    expect(part('previous-2026-09-07')).toHaveTextContent('Auto-closed');
    await user.click(chip);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ date: '2026-10-01' }),
    );
    await screen.findByTestId(`${D}-report`);
    expect(screen.queryByTestId(`${D}-previous-list`)).not.toBeInTheDocument();
  });
});

describe('Day close — review every entry (Q-G11)', () => {
  it('lists the day newest first; a tick tints the row and moves the progress', async () => {
    const user = setUser();
    await openDayClose();
    await user.click(part('review-toggle'));
    expect(part('review-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(reviewRows().map((row) => row.textContent?.match(/PAY-\d+/)?.[0])).toEqual([
      'PAY-5509',
      'PAY-309',
      'PAY-310',
      'PAY-5513',
      'PAY-5512',
      'PAY-311',
    ]);
    expect(within(reviewRowOf('PAY-310')).getByText('Can edit')).toBeInTheDocument();
    await user.click(screen.getByTestId(`${D}-review-check-${reviewRowId('PAY-310')}`));
    await waitFor(() =>
      expect(part('review-progress')).toHaveTextContent('1 of 6 checked'),
    );
    expect(reviewRowOf('PAY-310')).toHaveAttribute('data-checked', 'true');
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
    await user.click(screen.getByTestId(`${D}-review-check-${reviewRowId('PAY-310')}`));
    await waitFor(() =>
      expect(part('review-progress')).toHaveTextContent('0 of 6 checked'),
    );
    expect(reviewRowOf('PAY-310')).not.toHaveAttribute('data-checked');
    // The list folds away again.
    await user.click(part('review-toggle'));
    expect(screen.queryAllByTestId(`${D}-review-row`)).toHaveLength(0);
  });

  it('opens an entry’s drawer over Day close, and a closed day’s entry answers its lock', async () => {
    const user = setUser();
    await openDayClose();
    await user.click(part('review-toggle'));
    await user.click(within(reviewRowOf('PAY-310')).getByText('Tea & snacks'));
    const send = await screen.findByTestId('pay-drawer');
    expect(within(send).getByText('Edit payment out')).toBeInTheDocument();
    await user.click(screen.getByTestId('pay-drawer-dismiss'));
    await waitFor(() =>
      expect(screen.queryByTestId('pay-drawer')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId(D)).toBeInTheDocument();
  });

  it('answers a closed day’s entry with "PAY-305 · Day closed" and shows its lock', async () => {
    const user = setUser();
    await openDayClose(`${DAY_CLOSE}?date=2026-10-01`);
    await user.click(part('review-toggle'));
    const row = reviewRowOf('PAY-305');
    expect(within(row).getByText('Day closed')).toBeInTheDocument();
    await user.click(row);
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-305 · Day closed');
  });

  it('asks before deleting an entry from its row', async () => {
    const user = setUser();
    await openDayClose();
    await user.click(part('review-toggle'));
    await user.click(screen.getByTestId(`${D}-review-310-row-action-delete`));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Delete this payment?',
    );
  });

  it('keeps the ticks to the dayclose ability', async () => {
    const user = setUser();
    await openDayClose(DAY_CLOSE, { role: 'counsellor' });
    await user.click(part('review-toggle'));
    expect(
      screen.getByTestId(`${D}-review-check-${reviewRowId('PAY-310')}`),
    ).toBeDisabled();
  });
});

describe('Day close — the day and its loading', () => {
  it('picks another day from the dropdown; the URL keeps it', async () => {
    const user = setUser();
    const { router } = await openDayClose();
    await user.click(part('day'));
    await user.click(await screen.findByTestId(`${D}-day-option-2026-10-01`));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ date: '2026-10-01' }),
    );
    expect(await screen.findByTestId(`${D}-report`)).toHaveTextContent('Oct 1 is closed');
  });

  it('reads a day after today as today', async () => {
    await openDayClose(`${DAY_CLOSE}?date=2026-12-01`);
    expect(part('gate')).toHaveTextContent('Opening cash · Today');
  });

  it('offers Retry when the day can’t load', async () => {
    const user = setUser();
    const fetchDay = vi
      .spyOn(dayCloseApi, 'fetchDayClose')
      .mockRejectedValueOnce(new Error('offline'));
    renderPaymentsRoutes(DAY_CLOSE);
    await user.click(await screen.findByTestId('retry-button'));
    expect(await screen.findByTestId(`${D}-gate`)).toBeInTheDocument();
    fetchDay.mockRestore();
  });

  it('shows the empty review of a day with no entries', async () => {
    const user = setUser();
    await openDayClose(`${DAY_CLOSE}?date=2026-09-20`);
    await user.click(part('review-toggle'));
    expect(part('review-empty')).toHaveTextContent('No entries on this day');
  });
});

describe('Day close — closing it', () => {
  it('closes on ×, and on Esc, back onto the ledger', async () => {
    const user = setUser();
    const { router } = await openDayClose();
    await user.click(part('close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
    await router.navigate({ to: DAY_CLOSE });
    await screen.findByTestId(`${D}-status`);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(router.state.location.pathname).toBe(LEDGER));
  });
});

/** A row's entry id, from its check box's test id. */
function reviewRowId(ref: string): string {
  const box = within(reviewRowOf(ref)).getByRole('checkbox');
  return (box.getAttribute('data-testid') ?? '').replace(`${D}-review-check-`, '');
}
