import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import {
  deleteOffer,
  fetchAllOffers,
  restoreOffer,
  setOfferActive,
} from '@/shared/api/app/offerings-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { offerRecord } from '@/tests/utils/offering-doubles.ts';

import {
  GLOW_OFFER_ID,
  type OffersWorld,
  PAST_OFFER_ID,
  PROBE_OFFER_ID,
  seededOffersWorld,
} from './__tests__/integration/offers-test-data.ts';
import {
  COUNSELLOR_CODES,
  OFFERS_URL,
  renderOffersRoutes,
  resetOffersRoutes,
} from './__tests__/integration/offers-test-router.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));

const world = vi.hoisted(() => ({}) as OffersWorld);
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => {
  const { offersApiDouble } = await import('./__tests__/integration/offers-test-data.ts');
  return {
    ...(await importOriginal<typeof OfferingsApiModule>()),
    ...offersApiDouble(world),
  };
});

/** 10 Oct 2026, clinic time. */
const NOW = new Date('2026-10-10T06:30:00Z');

const rows = () => screen.getAllByTestId('offers-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};
const names = () =>
  rows().map((row) => within(row).getAllByRole('cell')[1]?.textContent ?? '');

/** The Offers tab with its four offers and the clinic's branches loaded. */
async function openList(options?: Parameters<typeof renderOffersRoutes>[1]) {
  const view = renderOffersRoutes(OFFERS_URL, options);
  await waitFor(() => expect(rows()).toHaveLength(4));
  await waitFor(() => expect(rowOf('P0 Probe offer')).toHaveTextContent('All branches'));
  return view;
}

/** A row's action once the member's access has resolved. */
const actionOf = (text: string, action: string) =>
  within(rowOf(text)).findByTestId(`offers-row-action-${action}`);

/** Open a row's drawer and wait for it to settle as view only — the access has resolved. */
async function openViewOnly(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(within(rowOf(text)).getByText(text));
  expect(await screen.findByTestId('offer-drawer-footer')).toHaveTextContent(
    'View only · your role can’t change this',
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  useLocaleStore.setState({ formatLocale: 'en-IN' });
  Object.assign(world, seededOffersWorld());
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  vi.mocked(fetchAllOffers).mockClear();
  vi.mocked(setOfferActive).mockClear();
  vi.mocked(deleteOffer).mockClear();
  vi.mocked(restoreOffer).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  useLocaleStore.setState({ formatLocale: 'en-US' });
  resetOffersRoutes();
});

describe('the Offers tab on clinozy-be (KICKOFF §6.11)', () => {
  it('lists every offer in the server’s order, under the room’s tabs', async () => {
    const { container } = await openList();
    expect(screen.getByTestId('offers-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Offerings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(names()).toEqual([
      expect.stringContaining('P0 Probe offer'),
      expect.stringContaining('Research Future'),
      expect.stringContaining('Research Diwali glow'),
      expect.stringContaining('Research Past'),
    ]);
    expect(screen.getByTestId('offers-table-end')).toHaveTextContent('All offers loaded');
    // Updated is hidden by default: 5 of 6 shown.
    expect(screen.getByTestId('offers-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 5 of 6 shown',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('words each offer: code, value in rupees, offerings, dates and the server’s status', async () => {
    await openList();
    const probe = rowOf('P0 Probe offer');
    expect(probe).toHaveTextContent('P0PROBE');
    expect(probe).toHaveTextContent('₹100.50 off');
    expect(probe).toHaveTextContent('₹ off');
    expect(probe).toHaveTextContent('Offerings P0 Probe');
    expect(probe).toHaveTextContent('Probe note');
    expect(probe).toHaveTextContent('Now – no end');
    expect(probe).toHaveTextContent('Running');
    expect(within(probe).getByText('All branches')).toBeInTheDocument();

    const future = rowOf('Research Future');
    expect(future).toHaveTextContent('+50 sessions');
    expect(future).toHaveTextContent('Extra sessions');
    expect(future).toHaveTextContent('Starts 1 Dec 2026');
    expect(future).toHaveTextContent('Scheduled');
    expect(within(future).getByText('Vesu')).toBeInTheDocument();

    const glow = rowOf('Research Diwali glow');
    expect(glow).toHaveTextContent('15% off');
    expect(glow).toHaveTextContent('Research Default GST, Research Peel');
    expect(glow).toHaveTextContent('Paused');

    const past = rowOf('Research Past');
    expect(past).toHaveTextContent('₹250.50 off');
    expect(past).toHaveTextContent('Over');
    expect(past).toHaveTextContent('Ended');
  });

  it('reads the status the server sent, never the dates', async () => {
    // Past its end, yet the server says live: the screen says so too.
    world.offers = world.offers.map((offer) =>
      offer.id === PAST_OFFER_ID ? { ...offer, status: 'live' } : offer,
    );
    await openList();
    expect(rowOf('Research Past')).toHaveTextContent('Running');
    expect(rowOf('Research Past')).not.toHaveTextContent('Over');
  });

  it('says "No offerings" once every offering it named was deleted (OFFERINGS-M4)', async () => {
    world.offers = world.offers.map((offer) =>
      offer.id === PAST_OFFER_ID ? { ...offer, offeringIds: [] } : offer,
    );
    await openList();
    expect(rowOf('Research Past')).toHaveTextContent('No offerings');
  });

  it('searches names, codes and the offerings’ names in place', async () => {
    const { unmount } = renderOffersRoutes(`${OFFERS_URL}?q=p0probe`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('P0 Probe offer');
    unmount();
    renderOffersRoutes(`${OFFERS_URL}?q=default%20gst`);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(names()).toEqual([
      expect.stringContaining('Research Diwali glow'),
      expect.stringContaining('Research Past'),
    ]);
  });

  it('offers Branches · Status · Created and applies the picks', async () => {
    const user = userEvent.setup();
    // A second running offer: four statuses over five rows make a Status section (H:4164).
    world.offers = [
      offerRecord({ id: 'ofr_p3secondliveoffer0000', name: 'Second live', code: null }),
      ...world.offers,
    ];
    const { router } = renderOffersRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(5));
    await user.click(screen.getByTestId('offers-filters-trigger'));
    const panel = await screen.findByTestId('offers-filters');
    for (const section of ['Branches', 'Status', 'Created']) {
      expect(within(panel).getByText(section)).toBeInTheDocument();
    }
    await user.click(within(panel).getByRole('button', { name: 'Paused' }));
    await user.click(within(panel).getByTestId('offers-filters-apply'));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Research Diwali glow');
    expect(router.state.location.search).toMatchObject({ status: ['paused'] });
  });
});

describe('Pause and Resume (H:5483) — `is_active` alone', () => {
  it('pauses a running offer at once and says so', async () => {
    const user = userEvent.setup();
    await openList();
    await user.click(await actionOf('P0 Probe offer', 'pause'));
    expect(setOfferActive).toHaveBeenCalledWith({
      offerId: PROBE_OFFER_ID,
      isActive: false,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(rowOf('P0 Probe offer')).toHaveTextContent('Paused'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'P0 Probe offer paused',
        expect.objectContaining({ id: 'app-offer-paused' }),
      ),
    );
    expect(
      within(rowOf('P0 Probe offer')).getByTestId('offers-row-action-resume'),
    ).toBeInTheDocument();
  });

  it('resumes a paused offer with the status the server answers', async () => {
    const user = userEvent.setup();
    await openList();
    await user.click(await actionOf('Research Diwali glow', 'resume'));
    expect(setOfferActive).toHaveBeenCalledWith({
      offerId: GLOW_OFFER_ID,
      isActive: true,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(rowOf('Research Diwali glow')).toHaveTextContent('Running'),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Research Diwali glow running again',
      expect.objectContaining({ id: 'app-offer-paused' }),
    );
  });

  it('never pauses or resumes an ended offer', async () => {
    await openList();
    await actionOf('Research Past', 'delete');
    const past = rowOf('Research Past');
    expect(within(past).queryByTestId('offers-row-action-pause')).toBeNull();
    expect(within(past).queryByTestId('offers-row-action-resume')).toBeNull();
  });
});

describe('Delete and Undo', () => {
  it('removes an offer with the reason picked, and Undo restores it', async () => {
    const user = userEvent.setup();
    await openList();
    await user.click(await actionOf('Research Past', 'delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offer?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Research Past',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(deleteOffer).toHaveBeenCalledWith({
      offerId: PAST_OFFER_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Research Past removed', {
      onUndo: expect.any(Function),
    });

    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() =>
      expect(restoreOffer).toHaveBeenCalledWith(PAST_OFFER_ID, expect.any(String)),
    );
    await waitFor(() => expect(rows()).toHaveLength(4));
  });
});

describe('Export (`offering:export`)', () => {
  it('exports the selected offers as CSV, the code beside the name', async () => {
    await openList();
    await actionOf('P0 Probe offer', 'delete');
    fireEvent.click(within(rowOf('P0 Probe offer')).getByRole('checkbox'));
    fireEvent.click(await screen.findByTestId('offers-table-bulk-export'));
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('offers.csv');
    const [header, line] = content.split('\n');
    expect(header).toBe('Offer,Type,Applies to,Branches,Valid,Status');
    expect(line).toMatch(/^P0 Probe offer · P0PROBE,₹100.50 off,Offerings P0 Probe,/);
    expect(notifyMock.success).toHaveBeenCalledWith('1 row exported as CSV');
  });
});

describe('access by the member’s codes (research §7)', () => {
  it('gives a Counsellor New, Edit and Pause — no Delete, no Export', async () => {
    await openList({ codes: COUNSELLOR_CODES });
    expect(await actionOf('P0 Probe offer', 'edit')).toBeInTheDocument();
    expect(screen.getByTestId('offers-new-button')).toBeInTheDocument();
    const probe = rowOf('P0 Probe offer');
    expect(within(probe).getByTestId('offers-row-action-pause')).toBeInTheDocument();
    expect(within(probe).queryByTestId('offers-row-action-delete')).toBeNull();
    fireEvent.click(within(probe).getByRole('checkbox'));
    expect(screen.queryByTestId('offers-table-bulk-export')).not.toBeInTheDocument();
  });

  it('gives a member with `organization:read` alone nothing to change', async () => {
    const user = userEvent.setup();
    await openList({ codes: [] });
    await openViewOnly(user, 'P0 Probe offer');
    expect(screen.queryByTestId('offers-new-button')).not.toBeInTheDocument();
    const probe = rowOf('P0 Probe offer');
    for (const action of ['edit', 'pause', 'delete']) {
      expect(within(probe).queryByTestId(`offers-row-action-${action}`)).toBeNull();
    }
  });
});

describe('the read’s states (KICKOFF §6.11 States)', () => {
  it('shows bars while the offers load', async () => {
    vi.mocked(fetchAllOffers).mockImplementationOnce(() => new Promise(() => {}));
    renderOffersRoutes(OFFERS_URL);
    expect(await screen.findByTestId('skeleton-rows')).toBeInTheDocument();
  });

  it('shows the empty line, with no button, when there is none', async () => {
    world.offers = [];
    renderOffersRoutes(OFFERS_URL);
    const empty = await screen.findByTestId('empty-state');
    expect(empty).toHaveTextContent('No offers yet');
    expect(within(empty).queryByRole('button')).toBeNull();
  });

  it('offers Retry in place when the read fails, and loads on Retry', async () => {
    const user = userEvent.setup();
    world.readsFail = true;
    renderOffersRoutes(OFFERS_URL);
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    // Nothing on screen: no "showing the last copy" toast.
    expect(notifyMock.error).not.toHaveBeenCalled();
    world.readsFail = false;
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(4));
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Type as the key column and the meta line Applies to · Branches · Valid · Status', async () => {
    renderOffersRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    const meta = () =>
      rowOf('Research Future').querySelector('[data-slot="data-table-meta"]');
    await waitFor(() =>
      expect(meta()).toHaveTextContent(
        /^Applies to Research Peel Branches Vesu Valid .+ Status Scheduled$/,
      ),
    );
    const cells = within(rowOf('Research Future')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Research Future');
    expect(cells[1]).toHaveTextContent('+50 sessions');
  });
});
