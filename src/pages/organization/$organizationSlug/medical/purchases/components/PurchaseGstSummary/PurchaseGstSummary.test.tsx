import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import {
  exportPurchaseGstSummary,
  fetchPurchaseGstSummary,
} from '../../../shared/medical-api.ts';
import type { PurchaseGstSummary as Summary } from '../../../shared/medical-contracts.ts';
import { PurchaseGstSummary } from './PurchaseGstSummary.tsx';

const { notifyMock, downloadCsvMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  downloadCsvMock: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: downloadCsvMock,
}));
vi.mock('../../../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPurchaseGstSummary: vi.fn(),
  exportPurchaseGstSummary: vi.fn(),
}));

const TRIGGER = 'medical-purchases-view-action-gst-summary';
const PANEL = 'purchase-gst-summary';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** October: a 12 % line with an HSN code and a 0 % one without — clinozy-be's A-6. */
const OCTOBER: Summary = {
  month: '2026-10',
  byRate: [
    { gstPercent: 0, lines: 1, taxable: 500, gst: 0, total: 500 },
    { gstPercent: 12, lines: 1, taxable: 1000, gst: 120, total: 1120 },
  ],
  byHsn: [
    { hsn: '300490', gstPercent: 12, lines: 1, taxable: 1000, gst: 120, total: 1120 },
    { hsn: null, gstPercent: 0, lines: 1, taxable: 500, gst: 0, total: 500 },
  ],
  totals: { orders: 1, lines: 2, taxable: 1500, gst: 120, total: 1620 },
};

/** The panel, opened from its view action. */
async function openPanel(canExport = true) {
  const user = setup();
  renderMedicalDrawer(<PurchaseGstSummary canExport={canExport} />);
  const trigger = await screen.findByTestId(TRIGGER);
  await user.click(trigger);
  return { user, trigger, panel: await screen.findByTestId(PANEL) };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  downloadCsvMock.mockReset();
  signInTestMember();
  vi.mocked(fetchPurchaseGstSummary).mockResolvedValue(OCTOBER);
  vi.mocked(exportPurchaseGstSummary).mockResolvedValue({
    fileName: 'purchase-gst-summary-2026-10.csv',
    content: 'section,gst_percent\n',
  });
});
afterEach(() => {
  resetMedicalRoutes();
  vi.mocked(fetchPurchaseGstSummary).mockReset();
  vi.mocked(exportPurchaseGstSummary).mockReset();
});

describe('PurchaseGstSummary (clinozy-be feat-purchase-line-gst A-8)', () => {
  it('shows the month by GST rate, by HSN code and in total', async () => {
    const { trigger, panel } = await openPanel();
    expect(trigger).toHaveAccessibleName('GST summary');
    await waitFor(() =>
      expect(within(panel).getByTestId(`${PANEL}-totals`)).toHaveTextContent(
        'Taxable ₹1,500 · GST ₹120 · Total ₹1,620',
      ),
    );
    expect(within(panel).getByTestId(`${PANEL}-summary`)).toHaveTextContent(
      'Received orders: 1 · lines: 2',
    );
    const rates = within(panel).getAllByTestId(`${PANEL}-by-rate-row`);
    expect(rates.map((row) => row.textContent)).toEqual([
      '0%1₹500₹0₹500',
      '12%1₹1,000₹120₹1,120',
    ]);
    const codes = within(panel).getAllByTestId(`${PANEL}-by-hsn-row`);
    expect(codes[0]).toHaveTextContent('300490 · 12%');
    expect(codes[1]).toHaveTextContent('No HSN · 0%');
    expect(fetchPurchaseGstSummary).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('reads another month and downloads its CSV under the server’s name', async () => {
    const { user, panel } = await openPanel();
    const month = within(panel).getByTestId(`${PANEL}-month`);
    fireEvent.change(month, { target: { value: '2026-09' } });
    await waitFor(() => expect(fetchPurchaseGstSummary).toHaveBeenCalledWith('2026-09'));
    await user.click(await within(panel).findByTestId(`${PANEL}-download`));
    await waitFor(() =>
      expect(downloadCsvMock).toHaveBeenCalledWith(
        'purchase-gst-summary-2026-10.csv',
        'section,gst_percent\n',
      ),
    );
    expect(exportPurchaseGstSummary).toHaveBeenCalledWith('2026-09');
    expect(notifyMock.success).toHaveBeenCalledWith('GST summary downloaded');
  });

  it('offers no download without medicine:export, and says when nothing came in', async () => {
    vi.mocked(fetchPurchaseGstSummary).mockResolvedValue({
      month: '2026-10',
      byRate: [],
      byHsn: [],
      totals: { orders: 0, lines: 0, taxable: 0, gst: 0, total: 0 },
    });
    const { panel } = await openPanel(false);
    expect(await within(panel).findByTestId(`${PANEL}-empty`)).toHaveTextContent(
      'Nothing was received this month',
    );
    expect(within(panel).queryByTestId(`${PANEL}-download`)).toBeNull();
  });
});
