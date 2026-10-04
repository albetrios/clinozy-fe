import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  OFFERINGS_URL,
  OFFERS_URL,
  renderOfferingsRoutes,
  resetOfferingsRoutes,
} from '../__tests__/integration/offerings-test-router.tsx';

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

const rows = () => screen.getAllByTestId('offers-table-row');
const rowOf = (text: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(text));
  if (!row) throw new Error(`no row for ${text}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetOfferingsRoutes();
  resetClinicFixtures();
});

describe('the Offers tab (KICKOFF §6.11)', () => {
  it('lists every offer Running → Scheduled → Paused → Ended, newest first in each', async () => {
    const { container } = renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.getByTestId('offers-page')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Offerings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Offers' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Offerings' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(rows().map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual(
      [
        expect.stringContaining('Navratri glow'),
        expect.stringContaining('LHR launch · Vesu'),
        expect.stringContaining('Peel pack + 1 free'),
        expect.stringContaining('Monsoon ₹500 off'),
      ],
    );
    expect(screen.getByTestId('offers-table-end')).toHaveTextContent('All offers loaded');
    // Updated is hidden by default: 5 of 6 shown.
    expect(screen.getByTestId('offers-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 5 of 6 shown',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('words each offer: its code, value and kind, what it applies to, when and its state', async () => {
    renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    const navratri = rowOf('Navratri glow');
    expect(navratri).toHaveTextContent('GLOW20');
    expect(navratri).toHaveTextContent('20% off');
    expect(navratri).toHaveTextContent('% off');
    expect(navratri).toHaveTextContent('B1G1 D-Tan Facial, Back Peeling +1');
    expect(navratri).toHaveTextContent('Festival offer on peels and facials');
    expect(navratri).toHaveTextContent(/Ends in 5 days/);
    expect(navratri).toHaveTextContent('Running');
    expect(within(navratri).getByText('Adajan')).toBeInTheDocument();

    const lhr = rowOf('LHR launch');
    expect(lhr).toHaveTextContent('at ₹3,999');
    expect(lhr).toHaveTextContent('Fixed price');

    const peel = rowOf('Peel pack');
    expect(peel).toHaveTextContent('+1 session');
    expect(peel).toHaveTextContent('Extra sessions');
    expect(peel).toHaveTextContent(/Starts .+\d{4}/);
    expect(peel).toHaveTextContent('Scheduled');
    expect(within(peel).getByText('All branches')).toBeInTheDocument();

    const monsoon = rowOf('Monsoon');
    expect(monsoon).toHaveTextContent('₹500 off');
    expect(monsoon).toHaveTextContent('Over');
    expect(monsoon).toHaveTextContent('Ended');
  });

  it('searches names, codes and the offerings’ names', async () => {
    const { unmount } = renderOfferingsRoutes(`${OFFERS_URL}?q=glow20`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    unmount();
    renderOfferingsRoutes(`${OFFERS_URL}?q=scaling`);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Monsoon ₹500 off');
  });

  it('offers Branches · Status · Created and applies the picks', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(screen.getByTestId('offers-filters-trigger'));
    const panel = await screen.findByTestId('offers-filters');
    for (const section of ['Branches', 'Status', 'Created']) {
      expect(within(panel).getByText(section)).toBeInTheDocument();
    }
    expect(within(panel).queryByText('Offer')).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Running' }));
    await user.click(within(panel).getByTestId('offers-filters-apply'));
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(router.state.location.search).toMatchObject({ status: ['live'] });
  });

  it('switches to the Offerings tab through its link', async () => {
    const user = userEvent.setup();
    const { router } = renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(screen.getByRole('link', { name: 'Offerings' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS_URL));
    expect(await screen.findByTestId('offerings-page')).toBeInTheDocument();
  });

  it('removes an offer through the reason confirm, its name in the pill (§7.3)', async () => {
    const user = userEvent.setup();
    renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('LHR launch')).getByTestId('offers-row-action-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this offer?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'LHR launch · Vesu',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-mistake'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(notifyMock.undo).toHaveBeenCalledWith('LHR launch · Vesu removed', {
      onUndo: expect.any(Function),
    });
  });

  it('exports the selected offers as CSV, the code beside the name', async () => {
    renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    fireEvent.click(within(rowOf('Navratri glow')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('offers-table-bulk-export'));
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('offers.csv');
    const [header, line] = content.split('\n');
    expect(header).toBe('Offer,Type,Applies to,Branches,Valid,Status');
    expect(line).toMatch(
      /^Navratri glow · GLOW20,20% off,"B1G1 D-Tan Facial, Back Peeling \+1"/,
    );
    expect(notifyMock.success).toHaveBeenCalledWith('1 row exported as CSV');
  });
});

describe('access (§6.11 Access, Q-O1)', () => {
  it('a Counsellor views only: no Delete', async () => {
    renderOfferingsRoutes(OFFERS_URL, { role: 'counsellor' });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.queryByTestId('offers-row-action-delete')).not.toBeInTheDocument();
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Type as the key column and the meta line Applies to · Branches · Valid · Status', async () => {
    renderOfferingsRoutes(OFFERS_URL);
    await waitFor(() => expect(rows()).toHaveLength(4));
    const peel = rowOf('Peel pack');
    const cells = within(peel).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Peel pack + 1 free');
    expect(cells[1]).toHaveTextContent('+1 session');
    expect(peel.querySelector('[data-slot="data-table-meta"]')).toHaveTextContent(
      /^Applies to Underarm Peel · 6 sessions Valid .+ Status Scheduled$/,
    );
  });
});
