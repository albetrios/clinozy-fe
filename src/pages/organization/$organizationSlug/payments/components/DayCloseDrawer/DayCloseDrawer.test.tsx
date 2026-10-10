import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { BranchOption } from '@/shared/api/clinic/branches-api.ts';
import {
  acceptOpeningCash,
  closeDay,
  fetchDayClose,
  reopenDay,
} from '@/shared/api/clinic/day-close-api.ts';
import {
  type DayCloseRecord,
  type DayCloseView,
  dayCloseWire,
  toDayCloseRecord,
} from '@/shared/api/clinic/day-close-contracts.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import type { LedgerPerson } from '@/shared/api/clinic/payments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import {
  fixtureActiveBranches,
  signInTestMember,
} from '@/tests/utils/clinic-shell-doubles.ts';
import {
  dayCloseWire as dayCloseWireDouble,
  ledgerRow,
  TEST_DAY_CLOSE_ID,
  TEST_MONEY_AUTHOR_ID,
} from '@/tests/utils/payments-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { DayCloseSearch } from '../../payments.dialog-search.ts';
import { DayCloseDrawer } from './DayCloseDrawer.tsx';

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
vi.mock('@/shared/api/clinic/day-close-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchDayClose: vi.fn(),
  acceptOpeningCash: vi.fn(),
  closeDay: vi.fn(),
  reopenDay: vi.fn(),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
vi.mock('@/shared/hooks/useMyMembership/index.ts', () => ({
  useMyMembershipId: () => 'mem_yls33gz5jj66ful8q4ads',
}));
// The entry drawers are the ledger's (WP1): here only which one opens, and whether view only.
vi.mock('../ReceivePaymentDrawer/index.ts', () => ({
  ReceivePaymentDrawer: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="receive-drawer-stub" data-read-only={String(readOnly)} />
  ),
}));
vi.mock('../SendPaymentDrawer/index.ts', () => ({
  SendPaymentDrawer: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="send-drawer-stub" data-read-only={String(readOnly)} />
  ),
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const TODAY = '2026-10-10';
const YESTERDAY = '2026-10-09';
const D = 'day-close-drawer';

/** Every Day close code: see, accept and close, reopen. */
const OWNER: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
];
/** The Accountant preset (research §7): closes the day, never reopens it. */
const ACCOUNTANT: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:export',
];
/** The Counsellor preset: sees Day close, changes nothing. */
const COUNSELLOR: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
];

const NISHA: LedgerPerson = {
  id: TEST_MONEY_AUTHOR_ID,
  name: 'Nisha Shah',
  initials: 'NS',
  tone: 'sage',
};

const part = (id: string) => screen.getByTestId(`${D}-${id}`);

/** A day's record as clinozy-be answers it (`payments-doubles`' Vesu close of 9 Oct). */
const record = (patch: Record<string, unknown> = {}): DayCloseRecord =>
  toDayCloseRecord(dayCloseWire.parse(dayCloseWireDouble(patch)));

let branch: BranchOption;

/** One branch-day as `fetchDayClose` answers it — the gate of today unless overridden. */
function viewOf(patch: Partial<DayCloseView> = {}): DayCloseView {
  return {
    branchId: branch.id,
    date: TODAY,
    today: TODAY,
    state: 'gate',
    close: null,
    opening: { cash: 7310, source: 'carried', from: '2026-10-08' },
    openingAcceptedAt: null,
    acceptedBy: null,
    cashIn: 0,
    cashOut: 0,
    expectedCash: null,
    countedCash: null,
    difference: null,
    differenceReason: null,
    closedAt: null,
    closedBy: null,
    autoClosed: false,
    autoClosesInHours: null,
    canReopen: false,
    netByMode: { cash: 0, upi: 0, card: 0, credit: 0 },
    staff: [],
    events: [],
    entries: [],
    collectedCount: 0,
    paidOutCount: 0,
    openDays: [],
    history: [],
    ...patch,
  };
}

/** Today accepted and open: ₹300 cash and ₹150 UPI in, ₹300 expected in the drawer. */
const openView = (patch: Partial<DayCloseView> = {}) => {
  const close = record({ status: 'open', close_date: TODAY, counted_cash: null });
  return viewOf({
    state: 'open',
    close,
    opening: { cash: 0, source: 'carried', from: null },
    openingAcceptedAt: '2026-10-10T03:42:00.000Z',
    acceptedBy: NISHA,
    cashIn: 300,
    expectedCash: 300,
    netByMode: { cash: 300, upi: 150, card: 0, credit: 0 },
    staff: [{ membershipId: NISHA.id, count: 2, amount: 450, person: NISHA }],
    entries: [ledgerRow({ seq: 6, id: 'pay_6' }), ledgerRow()],
    collectedCount: 2,
    ...patch,
  });
};

/** Yesterday counted at ₹280 against ₹300 and closed by Nisha. */
const closedView = (patch: Partial<DayCloseView> = {}) => {
  const close = record();
  return viewOf({
    date: YESTERDAY,
    state: 'closed',
    close,
    opening: { cash: 0, source: 'carried', from: null },
    openingAcceptedAt: close.openingAcceptedAt,
    acceptedBy: NISHA,
    cashIn: 300,
    expectedCash: 300,
    countedCash: 280,
    difference: -20,
    differenceReason: 'Short by twenty',
    closedAt: close.closedAt,
    closedBy: NISHA,
    canReopen: true,
    netByMode: close.netByMode,
    staff: [{ membershipId: NISHA.id, count: 1, amount: 300, person: NISHA }],
    events: close.events.map((event) => ({ ...event, by: NISHA })),
    entries: [ledgerRow({ isSettled: true, editCount: 0 })],
    collectedCount: 1,
    ...patch,
  });
};

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** Opens Day close for a member holding `codes`, and waits for its day to load. */
async function openDayClose(
  search: DayCloseSearch = {},
  codes: readonly OrganizationPermission[] = OWNER,
) {
  useOrganizationStore.getState().setPermissions([...codes]);
  const onDayChange = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <DayCloseDrawer open search={search} onDayChange={onDayChange} onClose={onClose} />,
  );
  await screen.findByTestId(`${D}-status`);
  return { ...view, onDayChange, onClose };
}

/** A refusal as clinozy-be answers it. */
const conflict = (reason: string) =>
  new HttpError('Refused', 409, '/app/day-closes', 'POST', {
    error: { type: 'request_error', code: 'conflict', reason, detail: 'Refused' },
  });

/** A validation answer naming one field. */
const invalid = (field: string, message: string) =>
  new HttpError('Invalid', 400, '/app/day-closes/x/close', 'POST', {
    error: {
      type: 'validation_error',
      code: 'invalid_field',
      detail: message,
      errors: [{ field, message }],
    },
  });

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchDayClose).mockReset();
  vi.mocked(acceptOpeningCash).mockReset();
  vi.mocked(closeDay).mockReset();
  vi.mocked(reopenDay).mockReset();
  [branch] = (await fixtureActiveBranches()) as [BranchOption];
  vi.mocked(fetchTeamDirectory).mockResolvedValue([
    { ...NISHA, userId: 'usr_test', roleIds: [], branchIds: [] },
  ]);
  vi.mocked(fetchDayClose).mockResolvedValue(viewOf());
  signInTestMember();
  useUIStore.setState({ previewRole: null });
});
afterEach(() => {
  vi.useRealTimers();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('Day close — the gate (payments.md:331; H:5114–5116)', () => {
  it('opens today on the opening clinozy-be would carry, with Recount and Accept', async () => {
    await openDayClose();
    expect(fetchDayClose).toHaveBeenCalledWith(branch.id, TODAY);
    const drawer = screen.getByTestId(D);
    expect(
      within(drawer).getByRole('heading', { name: 'Day close' }),
    ).toBeInTheDocument();
    expect(part('status')).toHaveTextContent('Open');
    expect(part('entries')).toHaveTextContent('0 entries on Oct 10');
    expect(part('gate')).toHaveTextContent('Opening cash · Today');
    expect(part('gate-amount')).toHaveTextContent('₹7,310');
    expect(part('gate-source')).toHaveTextContent('Carried from Oct 8 close');
    expect(part('gate-accept')).toHaveTextContent('Accept ₹7,310');
    await waitFor(() =>
      expect(part('gate')).toHaveTextContent(
        'You’re starting the day as Nisha S. · this is stamped on the day',
      ),
    );
    expect(screen.queryByTestId(`${D}-close-day`)).not.toBeInTheDocument();
    expect(await axeForDialog(drawer)).toHaveNoViolations();
  });

  it('names a branch’s first day — no close before it, ₹0 — never a default float', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(
      viewOf({ opening: { cash: 0, source: 'carried', from: null } }),
    );
    await openDayClose();
    expect(part('gate-amount')).toHaveTextContent('₹0');
    expect(part('gate-source')).toHaveTextContent('No earlier close · nothing to carry');
  });

  it('accepts the carried opening with the action’s key, and says when it was stamped', async () => {
    const user = setUser();
    vi.mocked(acceptOpeningCash).mockResolvedValue(
      record({
        status: 'open',
        close_date: TODAY,
        opening_cash: 7310,
        opening_accepted_at: NOW.toISOString(),
      }),
    );
    await openDayClose();
    await user.click(part('gate-accept'));
    await waitFor(() =>
      expect(acceptOpeningCash).toHaveBeenCalledWith({
        input: { branchId: branch.id, date: TODAY, recount: null },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Opening cash ₹7,310 accepted · stamped 10:00 AM',
      ),
    );
  });

  it('accepts a recount: "Accept recount" sends the rupees typed', async () => {
    const user = setUser();
    vi.mocked(acceptOpeningCash).mockResolvedValue(record({ status: 'open' }));
    await openDayClose();
    await user.type(part('gate-recount'), '7000.5');
    expect(part('gate-accept')).toHaveTextContent('Accept recount');
    await user.click(part('gate-accept'));
    await waitFor(() =>
      expect(acceptOpeningCash).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { branchId: branch.id, date: TODAY, recount: 7000.5 },
        }),
      ),
    );
  });

  it('reads a day someone opened meanwhile again, in the room’s words', async () => {
    const user = setUser();
    vi.mocked(acceptOpeningCash).mockRejectedValue(conflict('record_already_exists'));
    await openDayClose();
    await user.click(part('gate-accept'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone opened this day meanwhile · showing it now',
      ),
    );
    await waitFor(() => expect(fetchDayClose).toHaveBeenCalledTimes(2));
  });

  it('shows the opening without Accept to a member without payment:update', async () => {
    await openDayClose({}, COUNSELLOR);
    expect(part('gate-amount')).toHaveTextContent('₹7,310');
    expect(screen.queryByTestId(`${D}-gate-accept`)).not.toBeInTheDocument();
    expect(part('gate')).toHaveTextContent('View only · your role can’t change this');
  });
});

describe('Day close — the working day (payments.md:73–80; Q-G5)', () => {
  it('shows the server’s cash in and out, expected cash, net by mode and each member’s net', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose();
    expect(part('strip-opening')).toHaveTextContent('₹0');
    expect(part('strip-opening')).toHaveTextContent('Accepted by Nisha S. · 9:12 AM');
    expect(part('strip-cash')).toHaveTextContent('+₹300−₹0');
    expect(part('strip-cash')).toHaveTextContent('Expected in drawer ₹300');
    expect(part('strip-mode-cash')).toHaveTextContent('Cash₹300');
    expect(part('strip-mode-upi')).toHaveTextContent('UPI₹150');
    expect(part('strip-mode-card')).toHaveTextContent('Card₹0');
    expect(screen.queryByTestId(`${D}-strip-mode-credit`)).not.toBeInTheDocument();
    const chip = part(`strip-staff-${NISHA.id}`);
    expect(chip).toHaveTextContent('₹450');
    expect(chip.getAttribute('title')).toMatch(/^Nisha S\. · 2 .+ · ₹450$/);
    expect(part('close-day')).toHaveTextContent('Close day');
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
  });

  it('nets a negative mode with a minus, and shows Credit only when it moved', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(
      openView({ netByMode: { cash: -120, upi: 0, card: 0, credit: 50 } }),
    );
    await openDayClose();
    expect(part('strip-mode-cash')).toHaveTextContent('Cash−₹120');
    expect(part('strip-mode-credit')).toHaveTextContent('₹50');
  });

  it('asks for the count, then why it is off, and closes on the count and the reason', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    vi.mocked(closeDay).mockResolvedValue(record());
    await openDayClose();
    await user.click(part('close-day'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Count the cash first');
    expect(part('strip-difference')).toHaveTextContent('—');
    await user.type(part('strip-count-input'), '280');
    expect(part('strip-difference')).toHaveTextContent('−₹20');
    expect(part('strip-reason')).toBeInTheDocument();
    await user.click(part('close-day'));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Say why the count is off first');
    expect(closeDay).not.toHaveBeenCalled();
    await user.type(part('strip-reason-input'), 'Short by twenty');
    await user.click(part('close-day'));
    await waitFor(() =>
      expect(closeDay).toHaveBeenCalledWith({
        input: {
          closeId: TEST_DAY_CLOSE_ID,
          countedCash: 280,
          differenceReason: 'Short by twenty',
        },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenLastCalledWith(
        'Day closed · summary sent to admin on WhatsApp',
      ),
    );
    // The count is spent: a day reopened later starts a new one.
    expect(part('strip-count-input')).toHaveValue('');
  });

  it('closes a matched drawer without a reason', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    vi.mocked(closeDay).mockResolvedValue(record());
    await openDayClose();
    await user.type(part('strip-count-input'), '300');
    expect(part('strip-difference')).toHaveTextContent('₹0');
    expect(screen.queryByTestId(`${D}-strip-reason`)).not.toBeInTheDocument();
    await user.click(part('close-day'));
    await waitFor(() =>
      expect(closeDay).toHaveBeenCalledWith(
        expect.objectContaining({
          input: { closeId: TEST_DAY_CLOSE_ID, countedCash: 300, differenceReason: null },
        }),
      ),
    );
  });

  it('shows the server’s refusal of the reason on its field, and reads the day again', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    vi.mocked(closeDay).mockRejectedValue(
      invalid('body.difference_reason', 'Say why the count differs'),
    );
    await openDayClose();
    await user.type(part('strip-count-input'), '300');
    await user.click(part('close-day'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Say why the count differs',
    );
    expect(part('strip-reason')).toBeInTheDocument();
    expect(notifyMock.error).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchDayClose).toHaveBeenCalledTimes(2));
  });

  it('reads a day someone closed meanwhile again, in the room’s words', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    vi.mocked(closeDay).mockRejectedValue(conflict('transition_not_allowed'));
    await openDayClose();
    await user.type(part('strip-count-input'), '300');
    await user.click(part('close-day'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Someone closed this day meanwhile · showing it now',
      ),
    );
    await waitFor(() => expect(fetchDayClose).toHaveBeenCalledTimes(2));
  });

  it('keeps the count read-only and Close day hidden without payment:update', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose({}, COUNSELLOR);
    expect(part('strip-count-input')).toHaveAttribute('readonly');
    expect(screen.queryByTestId(`${D}-close-day`)).not.toBeInTheDocument();
  });

  it('reads a past open day as "Open · auto-closes in N h"', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(
      openView({ date: YESTERDAY, autoClosesInHours: 14 }),
    );
    await openDayClose({ date: YESTERDAY });
    expect(fetchDayClose).toHaveBeenCalledWith(branch.id, YESTERDAY);
    expect(part('status')).toHaveTextContent('Open · auto-closes in 14 h');
  });
});

describe('Day close — the closed day (H:5117–5121)', () => {
  it('reports the server’s figures and its steps by kind, never its English text', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    await openDayClose({ date: YESTERDAY });
    expect(part('status')).toHaveTextContent('Closed by Nisha S.');
    const report = part('report');
    expect(report).toHaveTextContent('Yesterday is closed');
    expect(part('report-sub')).toHaveTextContent('Closed by Nisha S. · 10:22 AM');
    expect(part('report-opening')).toHaveTextContent('₹0Accepted by Nisha S.');
    expect(part('report-cash')).toHaveTextContent('+₹300−₹0');
    expect(part('report-cash')).toHaveTextContent('1 received · 0 paid');
    expect(part('report-counted')).toHaveTextContent('₹280Expected ₹300');
    expect(part('report-difference')).toHaveTextContent('−₹20Short in drawer');
    expect(part('report-strip-mode-cash')).toHaveTextContent('Cash₹300');
    expect(part('report-log-accepted')).toHaveTextContent(
      'Nisha S. accepted the opening cash ₹0',
    );
    expect(part('report-log-counted')).toHaveTextContent(
      'Drawer counted at ₹280 · ₹20 short',
    );
    expect(part('report-log-reason')).toBeInTheDocument();
    expect(report).not.toHaveTextContent('Counted ₹280.00');
    expect(report).not.toHaveTextContent('Opening cash ₹0.00');
    expect(screen.queryByTestId(`${D}-close-day`)).not.toBeInTheDocument();
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
  });

  it('reads a day the worker closed as force-closed: opened automatically, not counted', async () => {
    const auto = record({
      close_kind: 'auto',
      counted_cash: 300,
      difference: 0,
      difference_reason: null,
      closed_by_membership_id: null,
      opening_accepted_by_membership_id: null,
    });
    vi.mocked(fetchDayClose).mockResolvedValue(
      closedView({
        close: auto,
        acceptedBy: null,
        closedBy: null,
        autoClosed: true,
        countedCash: 300,
        difference: 0,
        differenceReason: null,
        events: [
          {
            id: 'dce_auto',
            kind: 'auto_closed',
            text: 'Auto-closed: counted as expected ₹300.00',
            membershipId: null,
            at: '2026-10-10T18:30:00.000Z',
            by: null,
          },
        ],
      }),
    );
    await openDayClose({ date: YESTERDAY });
    expect(part('status')).toHaveTextContent('Force-closed');
    expect(part('report-sub')).toHaveTextContent('auto-closed after the grace period');
    expect(part('report-opening')).toHaveTextContent('Opened automatically');
    expect(part('report-counted')).toHaveTextContent('₹300Taken as expected');
    expect(part('report-difference')).toHaveTextContent('—Not counted');
    expect(part('report-log-auto')).toHaveTextContent(
      'Auto-closed after the grace period · cash taken as expected',
    );
    expect(part('report')).not.toHaveTextContent('counted as expected ₹300.00');
  });

  it('words a reopen between two closes; only the standing close carries the count', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(
      closedView({
        events: [
          ...record().events.map((event) => ({ ...event, by: NISHA })),
          {
            id: 'dce_reopen',
            kind: 'reopened',
            text: 'Two notes stuck together',
            membershipId: NISHA.id,
            at: '2026-10-10T05:00:00.000Z',
            by: NISHA,
          },
          {
            id: 'dce_close_again',
            kind: 'closed',
            text: 'Counted ₹280.00, expected ₹300.00',
            membershipId: NISHA.id,
            at: '2026-10-10T05:10:00.000Z',
            by: NISHA,
          },
        ],
      }),
    );
    await openDayClose({ date: YESTERDAY });
    // The reopen line reads its reason (dayLog's suite); its words are a new key until applied.
    expect(part('report-log-reopened')).toBeInTheDocument();
    expect(part('report-log-closed')).toBeInTheDocument();
    expect(part('report-log-counted')).toHaveTextContent('Drawer counted at ₹280');
  });

  it('reopens with a reason: the confirm names the day, the API keeps why', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    vi.mocked(reopenDay).mockResolvedValue(record({ status: 'open' }));
    const { baseElement } = await openDayClose({ date: YESTERDAY });
    await user.click(part('report-reopen'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByTestId('confirm-record')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(4);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.type(within(dialog).getByRole('textbox'), 'Two notes stuck together');
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(reopenDay).toHaveBeenCalledWith({
        input: { closeId: TEST_DAY_CLOSE_ID, reason: 'Two notes stuck together' },
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('Day reopened'));
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument(),
    );
  });

  it('closes the confirm on a day someone reopened meanwhile, in the room’s words', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    vi.mocked(reopenDay).mockRejectedValue(conflict('transition_not_allowed'));
    await openDayClose({ date: YESTERDAY });
    await user.click(part('report-reopen'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Other' }));
    await user.type(within(dialog).getByRole('textbox'), 'Recount');
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'This day is already open again · showing it now',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument(),
    );
    expect(fetchDayClose).toHaveBeenCalledTimes(2);
  });

  it('offers Reopen only with payment:delete — the Accountant closes, never reopens', async () => {
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    await openDayClose({ date: YESTERDAY }, ACCOUNTANT);
    expect(part('report')).toBeInTheDocument();
    expect(screen.queryByTestId(`${D}-report-reopen`)).not.toBeInTheDocument();
  });
});

describe('Day close — the bar: other days', () => {
  it('jumps to an open past day from its chip — only while today is shown', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(
      viewOf({
        openDays: [{ closeId: 'dcl_open', date: '2026-10-08', hoursLeft: 14 }],
      }),
    );
    const { onDayChange } = await openDayClose();
    const chip = part('open-day-2026-10-08');
    expect(chip).toHaveTextContent('Oct 8 not closed · 14 h left · Review');
    await user.click(chip);
    expect(onDayChange).toHaveBeenCalledWith('2026-10-08');
  });

  it('lists the previous closes; a chip jumps to its day', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(
      viewOf({
        history: [
          {
            closeId: TEST_DAY_CLOSE_ID,
            date: YESTERDAY,
            countedCash: 280,
            difference: -20,
            autoClosed: false,
            closedBy: NISHA,
          },
          {
            closeId: 'dcl_auto',
            date: '2026-10-02',
            countedCash: 0,
            difference: 0,
            autoClosed: true,
            closedBy: null,
          },
        ],
      }),
    );
    const { onDayChange } = await openDayClose();
    await user.click(part('previous'));
    expect(part('previous')).toHaveAttribute('aria-expanded', 'true');
    expect(part(`previous-${YESTERDAY}`)).toHaveTextContent('Oct 9Cash ₹280−₹20');
    expect(part('previous-2026-10-02')).toHaveTextContent('Auto-closed');
    await user.click(part(`previous-${YESTERDAY}`));
    expect(onDayChange).toHaveBeenCalledWith(YESTERDAY);
    expect(screen.queryByTestId(`${D}-previous-list`)).not.toBeInTheDocument();
  });

  it('says so when the branch has no close yet', async () => {
    const user = setUser();
    await openDayClose();
    await user.click(part('previous'));
    expect(part('previous-none')).toBeInTheDocument();
  });

  it('picks another day from the dropdown', async () => {
    const user = setUser();
    const { onDayChange } = await openDayClose();
    await user.click(part('day'));
    await user.click(await screen.findByTestId(`${D}-day-option-2026-10-01`));
    expect(onDayChange).toHaveBeenCalledWith('2026-10-01');
  });

  it('reads a day after today as today', async () => {
    await openDayClose({ date: '2026-12-01' });
    expect(fetchDayClose).toHaveBeenCalledWith(branch.id, TODAY);
    expect(part('gate')).toHaveTextContent('Opening cash · Today');
  });
});

describe('Day close — review every entry (Q-G11)', () => {
  it('lists the day’s entries, newest first, with no ticks (§6 #16)', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose();
    expect(part('review-count')).toBeInTheDocument();
    await user.click(part('review-toggle'));
    expect(part('review-toggle')).toHaveAttribute('aria-expanded', 'true');
    const rows = screen.getAllByTestId(`${D}-review-row`);
    expect(rows.map((row) => row.textContent?.match(/PAY-\d+/)?.[0])).toEqual([
      'PAY-6',
      'PAY-5',
    ]);
    expect(within(rows[0] as HTMLElement).getByText('Can edit')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(await axeForDialog(screen.getByTestId(D))).toHaveNoViolations();
  });

  it('opens an open day’s entry in its drawer — view only without payment:update', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose();
    await user.click(part('review-toggle'));
    await user.click(screen.getAllByTestId(`${D}-review-row`)[0] as HTMLElement);
    expect(await screen.findByTestId('receive-drawer-stub')).toHaveAttribute(
      'data-read-only',
      'false',
    );
  });

  it('opens it view only for a member who can’t change it', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose({}, COUNSELLOR);
    await user.click(part('review-toggle'));
    await user.click(screen.getAllByTestId(`${D}-review-row`)[0] as HTMLElement);
    expect(await screen.findByTestId('receive-drawer-stub')).toHaveAttribute(
      'data-read-only',
      'true',
    );
  });

  it('asks before deleting an open day’s entry from its row', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(openView());
    await openDayClose();
    await user.click(part('review-toggle'));
    await user.click(screen.getByTestId(`${D}-review-6-row-action-delete`));
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('answers a closed day’s entry with its lock, and offers Reverse with payment:delete', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    await openDayClose({ date: YESTERDAY });
    await user.click(part('review-toggle'));
    const row = screen.getByTestId(`${D}-review-row`);
    expect(within(row).getByText('Day closed')).toBeInTheDocument();
    await user.click(row);
    expect(notifyMock.info).toHaveBeenCalledWith('PAY-5 · Day closed');
    expect(screen.queryByTestId('receive-drawer-stub')).not.toBeInTheDocument();
    await user.click(screen.getByTestId(`${D}-review-5-row-action-reverse`));
    expect(await screen.findByTestId('confirm-dialog')).toHaveTextContent('PAY-5');
  });

  it('offers no Reverse without payment:delete', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockResolvedValue(closedView());
    await openDayClose({ date: YESTERDAY }, ACCOUNTANT);
    await user.click(part('review-toggle'));
    expect(
      screen.queryByTestId(`${D}-review-5-row-action-reverse`),
    ).not.toBeInTheDocument();
  });

  it('shows the empty review of a day with no entries', async () => {
    const user = setUser();
    await openDayClose();
    expect(part('review-count')).toHaveTextContent('No entries');
    await user.click(part('review-toggle'));
    expect(part('review-empty')).toHaveTextContent('No entries on this day');
  });
});

describe('Day close — loading, failure and closing', () => {
  it('shows bars while the day loads', async () => {
    vi.mocked(fetchDayClose).mockReturnValue(new Promise(() => undefined));
    useOrganizationStore.getState().setPermissions([...OWNER]);
    renderWithProviders(
      <DayCloseDrawer open search={{}} onDayChange={vi.fn()} onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(`${D}-loading`)).toBeInTheDocument();
  });

  it('offers Retry in place when the day can’t load', async () => {
    const user = setUser();
    vi.mocked(fetchDayClose).mockRejectedValueOnce(new Error('offline'));
    useOrganizationStore.getState().setPermissions([...OWNER]);
    renderWithProviders(
      <DayCloseDrawer open search={{}} onDayChange={vi.fn()} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByTestId('retry-button'));
    expect(await screen.findByTestId(`${D}-gate`)).toBeInTheDocument();
  });

  it('closes on ×', async () => {
    const user = setUser();
    const { onClose } = await openDayClose();
    await user.click(part('close'));
    expect(onClose).toHaveBeenCalled();
  });
});
