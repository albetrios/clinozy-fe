import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import { offeringQueryKeys } from '@/shared/api/clinic/offerings-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  OFFERINGS_URL,
  renderOfferingsRoutes,
  resetOfferingsRoutes,
} from './__tests__/integration/offerings-test-router.tsx';

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

/** Fails the catalogue read while `failing` is set — the room's list error. */
const listGate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof OfferingsApiModule>();
  return {
    ...actual,
    fetchAllOfferings: async (...args: Parameters<typeof actual.fetchAllOfferings>) => {
      if (listGate.failing) throw new Error('connection dropped');
      return actual.fetchAllOfferings(...args);
    },
  };
});

const rows = () => screen.getAllByTestId('offerings-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  listGate.failing = false;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetOfferingsRoutes();
  resetClinicFixtures();
});

describe('the Offerings tab (KICKOFF §6.11)', () => {
  it('lists the whole catalogue, newest first, under the room toolbar', async () => {
    const { container } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    expect(screen.getByTestId('offerings-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Offerings' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByTestId('offerings-tabs'));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Offerings',
      'Offers',
    ]);
    expect(tabs.getByRole('link', { name: 'Offerings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(rows()[0]).toHaveTextContent('#274');
    expect(rows()[10]).toHaveTextContent('#263');
    expect(screen.getByTestId('offerings-table-end')).toHaveTextContent(
      'All offerings loaded',
    );
    expect(screen.getByTestId('offerings-search')).toBeInTheDocument();
    // Updated is hidden by default: 8 of 9 shown.
    expect(screen.getByTestId('offerings-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 8 of 9 shown',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prices each row for no single branch: the billed price, the list price and the winning offer', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    // B1G1: offer price ₹1,200, Navratri glow 20% → ₹960, raised to the ₹1,150 floor.
    const facial = rowOf('B1G1 D-Tan Facial');
    expect(facial).toHaveTextContent('₹1,150');
    expect(facial).toHaveTextContent('was ₹1,500 · 23% off');
    const pill = (row: HTMLElement, name: string) =>
      within(row).getByText(name).closest('[data-slot="pill"]');
    expect(pill(facial, 'Navratri glow')).toHaveAttribute('title', '20% off');
    // LHR Full Face: the Vesu-only fixed price counts with no branch picked (D40).
    const lhr = rowOf('LHR Full Face');
    expect(lhr).toHaveTextContent('₹3,999');
    expect(pill(lhr, 'LHR launch · Vesu')).toHaveAttribute('title', 'at ₹3,999');
    expect(within(lhr).getByText('Vesu')).toBeInTheDocument();
    // Corn Removal bills its list price, at every branch.
    const corn = rowOf('Corn Removal');
    expect(corn).toHaveTextContent('list price');
    expect(within(corn).getByText('All branches')).toBeInTheDocument();
    expect(corn).toHaveTextContent('20 min');
    // A package with a validity: its sessions and how long they last.
    const peel = rowOf('Underarm Peel · 6 sessions');
    expect(peel).toHaveTextContent('6 sessions');
    expect(peel).toHaveTextContent('valid 180 days');
    expect(peel).toHaveTextContent('Valid 180 days');
    expect(rowOf('#272')).toHaveTextContent('Inactive');
  });

  it('sorts in place from the header: ascending, descending, off — Price by the billed price', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    const header = screen.getByRole('button', { name: /^Price/ });
    await user.click(header);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'price:asc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('Consultation · New'));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'price:desc' }),
    );
    await waitFor(() =>
      expect(rows()[0]).toHaveTextContent('Underarm Peel · 6 sessions'),
    );
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
    expect(rows()[0]).toHaveTextContent('#274');
    // Offer and Branches do not sort.
    expect(screen.queryByRole('button', { name: /^Offer\b/ })).not.toBeInTheDocument();
  });

  it('searches names, search terms and "#274"', async () => {
    const { unmount } = renderOfferingsRoutes(`${OFFERINGS_URL}?q=peel`);
    await waitFor(() => expect(rows()).toHaveLength(3));
    unmount();
    renderOfferingsRoutes(`${OFFERINGS_URL}?q=%23274`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('B1G1 D-Tan Facial');
  });

  it('offers Filters sections built from the rows, and applies the picks', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    await user.click(screen.getByTestId('offerings-filters-trigger'));
    const panel = await screen.findByTestId('offerings-filters');
    for (const section of ['Category', 'Offer', 'Branches', 'Status', 'Created']) {
      expect(within(panel).getByText(section)).toBeInTheDocument();
    }
    await user.click(within(panel).getByRole('button', { name: 'Package' }));
    await user.click(within(panel).getByTestId('offerings-filters-apply'));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(router.state.location.search).toMatchObject({ category: ['package'] });
  });

  it('answers a search with nothing and filters with nothing differently', async () => {
    const user = userEvent.setup();
    const { unmount } = renderOfferingsRoutes(`${OFFERINGS_URL}?q=nothing-like-this`);
    expect(await screen.findByText('No offering matches')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing here yet. Try another tab or search.'),
    ).toBeInTheDocument();
    unmount();

    const { router } = renderOfferingsRoutes(
      `${OFFERINGS_URL}?status=inactive&category=package`,
    );
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    await user.click(screen.getByTestId('empty-state-clear-filters'));
    await waitFor(() => expect(rows()).toHaveLength(11));
    expect(router.state.location.search).not.toHaveProperty('status');
  });

  it('removes an offering through the reason confirm, with Undo (D32)', async () => {
    const user = userEvent.setup();
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    await user.click(
      within(rowOf('Corn Removal')).getByTestId('offerings-row-action-delete'),
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offering?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Corn Removal',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(notifyMock.undo).toHaveBeenCalledWith('Offering #270 removed', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rows()).toHaveLength(11));
  });

  it('exports the selected rows as CSV (Q-P8)', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    fireEvent.click(within(rowOf('Corn Removal')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Back Peeling')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('offerings-table-bulk-export'));
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('offerings.csv');
    const [header, ...lines] = content.split('\n');
    expect(header).toBe(
      'ID,Offering,Category,Price,Offer,Branches,Duration,Sessions,Status',
    );
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).toContain('#270,Corn Removal,Treatment,"₹1,000"');
    expect(notifyMock.success).toHaveBeenCalledWith('2 rows exported as CSV');
  });

  it('keeps the last copy on a failed read and offers Retry for 9s', async () => {
    const { queryClient } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    listGate.failing = true;
    await queryClient.invalidateQueries({ queryKey: offeringQueryKeys.all });
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
    expect(rows()).toHaveLength(11);
  });
});

describe('access (§6.11 Access, Q-O1)', () => {
  it('a Counsellor views only: no Delete, no Export', async () => {
    renderOfferingsRoutes(OFFERINGS_URL, { role: 'counsellor' });
    await waitFor(() => expect(rows()).toHaveLength(11));
    expect(screen.queryByTestId('offerings-row-action-delete')).not.toBeInTheDocument();
    fireEvent.click(within(rowOf('Corn Removal')).getByRole('checkbox'));
    expect(screen.queryByTestId('offerings-table-bulk-export')).not.toBeInTheDocument();
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Price as the key column and a four-item meta line', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(11));
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    const facial = rowOf('B1G1 D-Tan Facial');
    const cells = within(facial).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('B1G1 D-Tan Facial');
    expect(cells[1]).toHaveTextContent('₹1,150');
    // Category · Offer · Branches · Duration (All branches and Active are skipped).
    expect(facial.querySelector('[data-slot="data-table-meta"]')).toHaveTextContent(
      /^Category Treatment Offer Navratri glow Duration 45 min Sessions 2 sessions/,
    );
    expect(within(facial).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
