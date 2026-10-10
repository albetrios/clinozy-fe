import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import i18n from '@/lib/i18n/i18n.ts';
import { fetchCredit, listPendingCredits } from '@/shared/api/clinic/credits-api.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { creditRow, TEST_CREDIT_ID } from '@/tests/utils/payments-doubles.ts';

import {
  renderPendingRoutes,
  resetPendingRoutes,
} from './__tests__/integration/pending-test-router.tsx';

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
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));
vi.mock('@/shared/api/clinic/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPendingCredits: vi.fn(),
  fetchCredit: vi.fn(),
}));

/** 10:00 on 10 Oct, clinic time. */
const NOW = new Date('2026-10-10T04:30:00Z');
const PENDING = '/organization/acme/payments/pending';
const T = 'payments-pending';

/** CR-2: give Kavya ₹300 — open, nothing settled. */
const OPEN_GIVE = creditRow({
  id: 'pcr_open00000000000000002',
  seq: 2,
  amount: 300,
  settled: 0,
  left: 300,
  paymentIds: [],
  invoiceId: null,
});

/** CR-3: take ₹800 from a supplier named by hand — open, nothing settled. */
const OPEN_TAKE = creditRow({
  id: 'pcr_take00000000000000003',
  seq: 3,
  direction: 'take',
  contactId: null,
  contact: null,
  patientId: null,
  partyName: 'Medline Surgicals',
  amount: 800,
  settled: 0,
  left: 800,
  reason: 'damaged_goods',
  reasonKey: 'damaged_goods',
  invoiceId: null,
  paymentIds: [],
});

/** CR-1: give Kavya ₹80, ₹50 of it settled. */
const PART_SETTLED = creditRow();

/** CR-4: given back in full today. */
const SETTLED = creditRow({
  id: 'pcr_settled0000000000004',
  seq: 4,
  status: 'given_back',
  settled: 80,
  left: 0,
  settledAt: '2026-10-10T05:00:00.000Z',
});

const ROWS: CreditRow[] = [OPEN_TAKE, OPEN_GIVE, PART_SETTLED, SETTLED];

const rows = () => screen.queryAllByTestId(`${T}-table-row`);
/** The table row of a credit, by its `CR-` number. */
function rowOf(ref: string): HTMLElement {
  const row = rows().find((candidate) => within(candidate).queryByText(ref));
  if (!row) throw new Error(`no row ${ref}`);
  return row;
}
/** The ids of the row actions a credit offers. */
const actionsOf = (ref: string) =>
  within(rowOf(ref))
    .queryAllByTestId(new RegExp(`^${T}-row-action-`))
    .map((button) => button.dataset.testid?.replace(`${T}-row-action-`, ''));

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listPendingCredits)
    .mockReset()
    .mockResolvedValue({ rows: ROWS, next: null, total: ROWS.length });
  vi.mocked(fetchCredit)
    .mockReset()
    .mockImplementation(async (id) => ROWS.find((row) => row.id === id) ?? OPEN_GIVE);
});
afterEach(() => {
  vi.useRealTimers();
  resetPendingRoutes();
});

describe('PendingPage — the list (payments.md:41–55)', () => {
  it('lists the credits newest first under the room’s toolbar, with who added each', async () => {
    const { container } = renderPendingRoutes(PENDING);
    expect(await screen.findByTestId('payments-pending-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Payments' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId(`${T}-toolbar`)).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.getByRole('columnheader', { name: 'By' })).toBeInTheDocument();
    expect(rowOf('CR-1')).toHaveTextContent('₹50 adjusted');
    expect(rowOf('CR-4')).toHaveTextContent('Returned · Today');
    expect(listPendingCredits).toHaveBeenCalledWith(
      { direction: undefined, status: undefined, created: undefined, q: undefined },
      undefined,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads the URL’s search and filters: the person, Which way, State', async () => {
    renderPendingRoutes(`${PENDING}?q=Kavya&direction=give&status=open`);
    await waitFor(() =>
      expect(listPendingCredits).toHaveBeenCalledWith(
        { direction: ['give'], status: ['open'], created: undefined, q: 'Kavya' },
        undefined,
      ),
    );
  });

  it('offers Which way, State and Created — each value in its tone', async () => {
    const user = setUser();
    renderPendingRoutes(PENDING);
    await user.click(await screen.findByTestId(`${T}-filters-trigger`));
    const panel = await screen.findByTestId(`${T}-filters`);
    expect(
      within(panel)
        .getAllByRole('group')
        .map(
          (group) =>
            document.getElementById(group.getAttribute('aria-labelledby') ?? '')
              ?.textContent,
        ),
    ).toEqual(['Which way', 'State', 'Created']);
    const tone = (label: string) =>
      within(panel).getByText(label).closest('[data-tone]')?.getAttribute('data-tone');
    expect(tone('Give')).toBe('blush');
    expect(tone('Take')).toBe('sky');
    expect(tone('Adjusted')).toBe('lav');
  });

  it('says "Nothing pending" when nothing is, with Add pending', async () => {
    vi.mocked(listPendingCredits).mockResolvedValue({ rows: [], next: null, total: 0 });
    renderPendingRoutes(PENDING);
    const empty = await screen.findByTestId('empty-state');
    expect(within(empty).getByText('Nothing pending')).toBeInTheDocument();
    expect(await within(empty).findByTestId('empty-state-action')).toHaveTextContent(
      'Add pending',
    );
  });

  it('shows a failed first read in place, with Retry', async () => {
    vi.mocked(listPendingCredits).mockRejectedValueOnce(
      new HttpError('Server error', 500, '/app/pending-credits', 'GET', {}),
    );
    const user = setUser();
    renderPendingRoutes(PENDING);
    const error = await screen.findByTestId('retry-error');
    expect(error).toHaveTextContent('Could not load data.');
    await user.click(within(error).getByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(4));
  });
});

describe('PendingPage — what a credit offers, by the member’s codes', () => {
  it('offers money and changes on an open credit, money alone once part is settled, nothing once settled', async () => {
    renderPendingRoutes(PENDING);
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(actionsOf('CR-2')).toEqual(['settle', 'use-on-bill', 'edit', 'delete']);
    expect(
      within(rowOf('CR-2')).getByTestId(`${T}-row-action-settle`),
    ).toHaveAccessibleName('Give back');
    expect(actionsOf('CR-3')).toEqual(['settle', 'edit', 'delete']);
    expect(
      within(rowOf('CR-3')).getByTestId(`${T}-row-action-settle`),
    ).toHaveAccessibleName('Got it back');
    expect(actionsOf('CR-1')).toEqual(['settle', 'use-on-bill']);
    expect(actionsOf('CR-4')).toEqual([]);
    expect(screen.getByTestId(`${T}-add`)).toBeInTheDocument();
  });

  it('takes money back with payment:create alone — giving back and using on a bill need payment:delete too (D83)', async () => {
    renderPendingRoutes(PENDING, {
      codes: ['organization:read', 'payment:read', 'payment:create'],
    });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(actionsOf('CR-3')).toEqual(['settle']);
    expect(actionsOf('CR-2')).toEqual([]);
    expect(actionsOf('CR-1')).toEqual([]);
  });

  it('gives money back and uses it on a bill with payment:create and payment:delete — the Accountant', async () => {
    renderPendingRoutes(PENDING, {
      codes: ['organization:read', 'payment:read', 'payment:create', 'payment:delete'],
    });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(actionsOf('CR-2')).toEqual(['settle', 'use-on-bill', 'delete']);
    expect(actionsOf('CR-1')).toEqual(['settle', 'use-on-bill']);
  });

  it('only reads with payment:read: no row action, no Add pending', async () => {
    renderPendingRoutes(PENDING, { codes: ['organization:read', 'payment:read'] });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(actionsOf('CR-2')).toEqual([]);
    expect(screen.queryByTestId(`${T}-add`)).toBeNull();
  });
});

describe('PendingPage — opening a credit', () => {
  it('opens Edit pending for an open credit nothing has settled', async () => {
    const user = setUser();
    const { router } = renderPendingRoutes(PENDING);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('CR-2')).getByText('Give'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PENDING}/${OPEN_GIVE.id}/edit`),
    );
    expect(await screen.findByText('Edit pending')).toBeInTheDocument();
    expect(screen.getByTestId('credit-drawer-tag')).toHaveTextContent('CR-2');
  });

  it('answers a part-settled credit’s click with why it can’t change, and stays', async () => {
    const user = setUser();
    const { router } = renderPendingRoutes(PENDING);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('CR-1')).getByText('Give'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      i18n.t('pending.settledLocked', { ns: 'payments', ref: 'CR-1', amount: '₹50' }),
    );
    expect(router.state.location.pathname).toBe(PENDING);
  });

  it('opens nothing for a settled credit', async () => {
    const user = setUser();
    const { router } = renderPendingRoutes(PENDING);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('CR-4')).getByText('Give'));
    expect(notifyMock.info).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe(PENDING);
  });

  it('opens Give back from the row, with no URL', async () => {
    const user = setUser();
    const { router } = renderPendingRoutes(PENDING);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('CR-1')).getByTestId(`${T}-row-action-settle`));
    const drawer = await screen.findByTestId('settle-credit-drawer');
    expect(within(drawer).getByText('Give back')).toBeInTheDocument();
    expect(screen.getByTestId('settle-credit-drawer-save')).toHaveTextContent(
      'Return ₹30',
    );
    expect(router.state.location.pathname).toBe(PENDING);
  });

  it('opens Add pending from the toolbar', async () => {
    const user = setUser();
    const { router } = renderPendingRoutes(PENDING);
    await user.click(await screen.findByTestId(`${T}-add`));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${PENDING}/create`));
    expect(await screen.findByTestId('credit-drawer')).toHaveTextContent('Add pending');
    expect(fetchCredit).not.toHaveBeenCalledWith(TEST_CREDIT_ID);
  });
});
