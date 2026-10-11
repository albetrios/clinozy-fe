import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import * as branchesApi from '@/shared/api/app/branches-api.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import {
  deleteOffering,
  fetchAllOfferings,
  fetchAllOffers,
  fetchOffering,
  offeringQueryKeys,
  restoreOffering,
} from '@/shared/api/app/offerings-api.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { previewPreset } from '@/tests/utils/app-preset-codes.ts';

import {
  OFFERING_IDS,
  OFFERINGS_TAB_BRANCHES,
  type OfferingsTabWorld,
  seededOfferingsTabWorld,
} from './__tests__/integration/offerings-tab-test-data.ts';
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

const world = vi.hoisted(() => ({}) as OfferingsTabWorld);
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => {
  const { offeringsApiDouble } =
    await import('./__tests__/integration/offerings-tab-test-data.ts');
  return {
    ...(await importOriginal<typeof OfferingsApiModule>()),
    ...offeringsApiDouble(world),
  };
});

// The Offering drawer is its own package's (its suite covers it): here it says only which
// offering the URL opened, or that New offering is open.
vi.mock('./components/OfferingDrawer/index.ts', () => ({
  OfferingDrawer: (props: {
    open: boolean;
    mode: 'create' | 'edit';
    offering?: OfferingRecord;
    prefill?: { name?: string };
  }) =>
    props.open ? (
      <output data-testid="offering-drawer" data-mode={props.mode}>
        {props.mode === 'edit'
          ? (props.offering?.name ?? 'loading')
          : `new ${props.prefill?.name ?? ''}`.trim()}
      </output>
    ) : null,
}));

const rows = () => screen.getAllByTestId('offerings-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};
const pill = (row: HTMLElement, name: string) =>
  within(row).getByText(name).closest('[data-slot="pill"]');

beforeEach(() => {
  viewport.tier = 'desktop';
  Object.assign(world, seededOfferingsTabWorld());
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  for (const fn of [
    fetchAllOfferings,
    fetchAllOffers,
    fetchOffering,
    deleteOffering,
    restoreOffering,
  ]) {
    vi.mocked(fn).mockClear();
  }
  vi.spyOn(branchesApi, 'fetchActiveBranches').mockResolvedValue(OFFERINGS_TAB_BRANCHES);
});
afterEach(() => {
  resetOfferingsRoutes();
  vi.restoreAllMocks();
});

describe('the Offerings tab on clinozy-be (KICKOFF §6.11)', () => {
  it('lists the whole catalogue in the server’s order under the room toolbar', async () => {
    const { container } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(fetchAllOfferings).toHaveBeenCalled();
    expect(fetchAllOffers).toHaveBeenCalled();
    expect(screen.getByTestId('offerings-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Offerings' }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('offerings-tabs')).getByRole('link', {
        name: 'Offerings',
      }),
    ).toHaveAttribute('aria-current', 'page');
    expect(rows()[0]).toHaveTextContent('#7');
    expect(rows()[5]).toHaveTextContent('#1');
    expect(screen.getByTestId('offerings-table-end')).toHaveTextContent(
      'All offerings loaded',
    );
    // Updated is hidden by default: 8 of 9 shown.
    expect(screen.getByTestId('offerings-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 8 of 9 shown',
    );
    expect(await screen.findByTestId('offerings-new-button')).toHaveTextContent(
      'New offering',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('prices each row in rupees for no single branch: billed, list and the winning offer', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    // ₹3,000 offer price, Diwali glow 15% → ₹2,550, raised to the ₹2,800 floor.
    const hydra = rowOf('Hydra Glow Facial');
    expect(hydra).toHaveTextContent('₹2,800');
    expect(hydra).toHaveTextContent('was ₹3,500 · 20% off');
    expect(pill(hydra, 'Diwali glow')).toHaveAttribute('title', '15% off');
    expect(within(hydra).getByText('All branches')).toBeInTheDocument();
    // The Vesu-only fixed price counts with no branch picked.
    const peel = rowOf('Research Peel');
    expect(peel).toHaveTextContent('₹1,500');
    expect(pill(peel, 'Vesu launch')).toHaveAttribute('title', 'at ₹1,450');
    expect(within(peel).getByText('Vesu')).toBeInTheDocument();
    // A product: its paise kept, no duration.
    const sunscreen = rowOf('Sunscreen SPF 50');
    expect(sunscreen).toHaveTextContent('₹850.50');
    expect(sunscreen).toHaveTextContent('list price');
    expect(within(sunscreen).getByText('—')).toBeInTheDocument();
    // Extra sessions from a live offer; a paused one prices nothing.
    const underarm = rowOf('Underarm Peel');
    expect(underarm).toHaveTextContent('6 sessions + 1 free');
    expect(underarm).toHaveTextContent('valid 180 days');
    expect(rowOf('Consultation')).toHaveTextContent('list price');
    expect(within(rowOf('Consultation')).queryByText('Monsoon')).toBeNull();
    expect(rowOf('#2')).toHaveTextContent('Inactive');
  });

  it('sorts in place from the header: ascending, descending, off — Price by the billed price', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'price:asc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('Consultation'));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() => expect(rows()[0]).toHaveTextContent('Underarm Peel'));
    await user.click(screen.getByRole('button', { name: /^Price/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
    expect(rows()[0]).toHaveTextContent('#7');
    // Offer and Branches do not sort; the list is read once.
    expect(screen.queryByRole('button', { name: /^Offer\b/ })).not.toBeInTheDocument();
    expect(fetchAllOfferings).toHaveBeenCalledTimes(1);
  });

  it('searches names, search terms and "#5" in place', async () => {
    const { unmount } = renderOfferingsRoutes(`${OFFERINGS_URL}?q=peel`);
    await waitFor(() => expect(rows()).toHaveLength(2));
    unmount();
    renderOfferingsRoutes(`${OFFERINGS_URL}?q=%235`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Research Peel');
  });

  it('offers Filters sections built from the rows, and applies the picks', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(screen.getByTestId('offerings-filters-trigger'));
    const panel = await screen.findByTestId('offerings-filters');
    for (const section of ['Category', 'Offer', 'Branches', 'Status', 'Created']) {
      expect(within(panel).getByText(section)).toBeInTheDocument();
    }
    await user.click(within(panel).getByRole('button', { name: 'Vesu' }));
    await user.click(within(panel).getByTestId('offerings-filters-apply'));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(router.state.location.search).toMatchObject({
      branch: [OFFERINGS_TAB_BRANCHES[1]?.id],
    });
  });

  it('answers a search with nothing and filters with nothing differently', async () => {
    const user = userEvent.setup();
    const { unmount } = renderOfferingsRoutes(`${OFFERINGS_URL}?q=nothing-like-this`);
    expect(await screen.findByText('No offering matches')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
    unmount();

    const { router } = renderOfferingsRoutes(
      `${OFFERINGS_URL}?status=inactive&category=package`,
    );
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    await user.click(screen.getByTestId('empty-state-clear-filters'));
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(router.state.location.search).not.toHaveProperty('status');
  });

  it('greets an empty catalogue with "New offering", which opens the drawer', async () => {
    const user = userEvent.setup();
    world.offerings = [];
    const { router } = renderOfferingsRoutes(OFFERINGS_URL);
    expect(await screen.findByText('No offerings yet')).toBeInTheDocument();
    await user.click(await screen.findByTestId('empty-state-action'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${OFFERINGS_URL}/create`),
    );
    expect(await screen.findByTestId('offering-drawer')).toHaveAttribute(
      'data-mode',
      'create',
    );
  });

  it('opens an offering’s drawer by its public id from a row and from a link', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderOfferingsRoutes(`${OFFERINGS_URL}?q=sun`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    await user.click(within(rowOf('Sunscreen')).getByText('Sunscreen SPF 50'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${OFFERINGS_URL}/${OFFERING_IDS.sunscreen}/edit`,
      ),
    );
    // The list's search stays under the drawer.
    expect(router.state.location.search).toMatchObject({ q: 'sun' });
    await waitFor(() =>
      expect(screen.getByTestId('offering-drawer')).toHaveTextContent('Sunscreen SPF 50'),
    );
    unmount();

    renderOfferingsRoutes(`${OFFERINGS_URL}/${OFFERING_IDS.hydra}/edit`);
    await waitFor(() =>
      expect(screen.getByTestId('offering-drawer')).toHaveTextContent(
        'Hydra Glow Facial',
      ),
    );
    expect(fetchOffering).toHaveBeenCalledWith(OFFERING_IDS.hydra);
  });

  it('deletes through the reason confirm — the reason and note sent, 204 — and Undo restores', async () => {
    const user = userEvent.setup();
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    await user.click(
      within(rowOf('Sunscreen SPF 50')).getByTestId('offerings-row-action-delete'),
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offering?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Sunscreen SPF 50',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(deleteOffering).toHaveBeenCalledWith({
      offeringId: OFFERING_IDS.sunscreen,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Offering #4 removed', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(restoreOffering).toHaveBeenCalledWith(
      OFFERING_IDS.sunscreen,
      expect.any(String),
    );
  });

  it('exports the selected rows as CSV, rupees as shown', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    fireEvent.click(within(rowOf('Sunscreen SPF 50')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Hydra Glow Facial')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('offerings-table-bulk-export'));
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('offerings.csv');
    const [header, ...lines] = content.split('\n');
    expect(header).toBe(
      'ID,Offering,Category,Price,Offer,Branches,Duration,Sessions,Status',
    );
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).toContain('#4,Sunscreen SPF 50,Product,₹850.50');
    expect(notifyMock.success).toHaveBeenCalledWith('2 rows exported as CSV');
  });

  it('shows a first read that fails in place, with Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAllOfferings).mockRejectedValueOnce(new Error('connection dropped'));
    renderOfferingsRoutes(OFFERINGS_URL);
    expect(await screen.findByTestId('retry-error')).toHaveTextContent(
      'Could not load data.',
    );
    // Nothing read yet: no "Showing the last copy" toast.
    expect(notifyMock.error).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() => expect(rows()).toHaveLength(6));
  });

  it('keeps the last copy on a later failed read and toasts Retry for 9s', async () => {
    const { queryClient } = renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    vi.mocked(fetchAllOfferings).mockRejectedValueOnce(new Error('connection dropped'));
    await queryClient.invalidateQueries({ queryKey: offeringQueryKeys.all });
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({ action: expect.objectContaining({ label: 'Retry' }) }),
      ),
    );
    expect(rows()).toHaveLength(6);
    expect(screen.queryByTestId('retry-error')).not.toBeInTheDocument();
  });
});

describe('access by permission code (research §7)', () => {
  it('a Counsellor (`offering:create`, `offering:update`) adds and edits, but has no Delete or Export', async () => {
    renderOfferingsRoutes(OFFERINGS_URL, {
      permissions: ['organization:read', 'offering:create', 'offering:update'],
    });
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(await screen.findByTestId('offerings-new-button')).toBeInTheDocument();
    expect(
      within(rowOf('Sunscreen')).getByTestId('offerings-row-action-edit'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('offerings-row-action-delete')).not.toBeInTheDocument();
    fireEvent.click(within(rowOf('Sunscreen')).getByRole('checkbox'));
    expect(screen.queryByTestId('offerings-table-bulk-export')).not.toBeInTheDocument();
  });

  it('a Doctor (`offering:export`) exports, and changes nothing', async () => {
    renderOfferingsRoutes(OFFERINGS_URL, {
      permissions: ['organization:read', 'offering:export'],
    });
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(screen.queryByTestId('offerings-new-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offerings-row-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offerings-row-action-delete')).not.toBeInTheDocument();
    fireEvent.click(within(rowOf('Sunscreen')).getByRole('checkbox'));
    expect(screen.getByTestId('offerings-table-bulk-export')).toBeInTheDocument();
  });

  it('a reader sees the catalogue only — an empty one offers no "New offering"', async () => {
    world.offerings = [];
    renderOfferingsRoutes(OFFERINGS_URL, { permissions: ['organization:read'] });
    expect(await screen.findByText('No offerings yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New offering' })).toBeNull();
    expect(screen.queryByTestId('offerings-new-button')).not.toBeInTheDocument();
  });

  it('View-as shows the previewed role’s controls — Marketing changes nothing', async () => {
    const { queryClient } = renderOfferingsRoutes(OFFERINGS_URL, { role: 'admin' });
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(await screen.findByTestId('offerings-new-button')).toBeInTheDocument();
    act(() => previewPreset(queryClient, 'marketing'));
    await waitFor(() =>
      expect(screen.queryByTestId('offerings-new-button')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('offerings-row-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('offerings-row-action-delete')).not.toBeInTheDocument();
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Price as the key column and a meta line', async () => {
    renderOfferingsRoutes(OFFERINGS_URL);
    await waitFor(() => expect(rows()).toHaveLength(6));
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    const hydra = rowOf('Hydra Glow Facial');
    const cells = within(hydra).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Hydra Glow Facial');
    expect(cells[1]).toHaveTextContent('₹2,800');
    // All branches and Active are quiet and skipped.
    expect(hydra.querySelector('[data-slot="data-table-meta"]')).toHaveTextContent(
      /^Category Treatment Offer Diwali glow Duration 45 min Sessions 1 session/,
    );
    expect(within(hydra).queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
