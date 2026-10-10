import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStockVendor: vi.fn(),
}));
vi.mock('../../stock-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createStockVendor: vi.fn(),
  updateStockVendor: vi.fn(),
  deleteStockVendor: vi.fn(),
  restoreStockVendor: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { stockVendorRow } from '@/tests/utils/stock-doubles.ts';

import {
  renderStockDrawer,
  resetStockRoutes,
} from '../../../__tests__/integration/stock-test-router.tsx';
import { useStockAccess } from '../../hooks/useStockAccess/index.ts';
import { fetchStockVendor } from '../../stock-api.ts';
import type { StockVendorRecord } from '../../stock-contracts.ts';
import {
  createStockVendor,
  deleteStockVendor,
  updateStockVendor,
} from '../../stock-records-api.ts';
import { useStockDeleteBlockText } from '../StockDeleteConfirm/index.ts';
import { StockVendorDrawer } from './StockVendorDrawer.tsx';

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

const D = 'stock-vendor-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

const IBREIA_ID = 'svnd_ibreia000000000000000';

/** Ibreia, owed nothing — one paid purchase. */
const IBREIA = stockVendorRow({
  id: IBREIA_ID,
  name: 'Ibreia',
  phone: '+918238450007',
  payable: 0,
  purchaseCount: 1,
});

/** What the API answers a write with. */
const saved = (patch: Partial<StockVendorRecord> = {}): StockVendorRecord => ({
  id: 'svnd_ankittraders000000000',
  name: 'Ankit Traders',
  phone: '+919876543210',
  isQuick: false,
  payable: 0,
  createdAt: '2026-10-10T07:00:00.000Z',
  updatedAt: '2026-10-10T07:00:00.000Z',
  ...patch,
});

/** A mark once the member's access is known — the drawer's gates are final then. */
function AccessResolved() {
  const { resolved } = useStockAccess();
  return resolved ? <span data-testid="access-resolved" hidden /> : null;
}

/** A refusal as clinozy-be sends it. */
const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError('refused', status, '/app/stock-vendors', 'POST', { error });

/** A toast's options with an action — the failed save's "Reload". */
type ToastWithAction = { action: { label: string; onClick: () => void } };

/** The failed save's toast that offers "Reload". */
function reloadAction() {
  const call = notifyMock.error.mock.calls.find(
    ([, options]) => (options as Partial<ToastWithAction> | undefined)?.action,
  );
  if (!call) throw new Error('no toast with an action');
  return (call[1] as ToastWithAction).action;
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
});
afterEach(() => resetStockRoutes());

describe('StockVendorDrawer (clinic-stock.md:174–185)', () => {
  it('asks for a name, refuses a short mobile, then adds the vendor', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(createStockVendor).mockResolvedValue(saved());
    renderStockDrawer(<StockVendorDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'New clinic vendor',
    );
    expect(drawer).toHaveTextContent(
      'Supplies consumables for procedures · not medicines',
    );

    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ankit Traders');
    await user.type(within(drawer).getByTestId(`${D}-phone`), '98765');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Enter a 10-digit mobile');
    expect(createStockVendor).not.toHaveBeenCalled();

    await user.type(within(drawer).getByTestId(`${D}-phone`), '43210');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createStockVendor).toHaveBeenCalledWith({
      input: { name: 'Ankit Traders', phone: '+919876543210', isQuick: false },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor Ankit Traders added');
  });

  it('stacked: named from the picker, "Back" · "Add vendor", a quick vendor handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    vi.mocked(createStockVendor).mockResolvedValue(
      saved({ name: 'Ankit', phone: null, isQuick: true }),
    );
    renderStockDrawer(
      <StockVendorDrawer
        mode="create"
        open
        onClose={vi.fn()}
        stacked
        prefill={{ name: ' Ankit ' }}
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-name`)).toHaveValue('Ankit');
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    expect(within(drawer).getByTestId(`${D}-stacked-save`)).toHaveTextContent(
      'Add vendor',
    );
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Ankit', isQuick: true }),
      ),
    );
    expect(createStockVendor).toHaveBeenCalledWith(
      expect.objectContaining({ input: { name: 'Ankit', phone: null, isQuick: true } }),
    );
  });

  it('edits the phone with the read’s record; Delete shows while nothing is owed', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(updateStockVendor).mockResolvedValue(saved({ ...IBREIA }));
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={IBREIA} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent(
      'Edit clinic vendor',
    );
    expect(within(drawer).getByTestId(`${D}-phone`)).toHaveValue('82384 50007');
    // Delete waits for the member's access.
    expect(await within(drawer).findByTestId(`${D}-delete`)).toBeInTheDocument();

    await user.clear(within(drawer).getByTestId(`${D}-phone`));
    await user.type(within(drawer).getByTestId(`${D}-phone`), '9825044120');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateStockVendor).toHaveBeenCalledWith({
      record: IBREIA,
      input: { name: 'Ibreia', phone: '+919825044120' },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Vendor saved');
  });

  it('offers no Delete on a vendor still owed', async () => {
    renderStockDrawer(
      <>
        <AccessResolved />
        <StockVendorDrawer mode="edit" vendor={stockVendorRow()} open onClose={vi.fn()} />
      </>,
    );
    const drawer = await screen.findByTestId(D);
    await screen.findByTestId('access-resolved');
    expect(within(drawer).getByTestId(`${D}-save`)).toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('a stale save says so; "Reload" reads the vendor and the inputs show what was saved', async () => {
    const user = setup();
    const fresh = stockVendorRow({
      ...IBREIA,
      name: 'Ibreia Labs',
      phone: '+919825044120',
      updatedAt: '2026-10-10T07:30:00.000Z',
    });
    vi.mocked(updateStockVendor).mockRejectedValueOnce(
      refusal(409, {
        type: 'request_error',
        code: 'conflict',
        reason: 'record_changed',
        detail: 'This record was changed by usr_x at 2026-10-10T07:30:00.000Z',
      }),
    );
    vi.mocked(fetchStockVendor).mockResolvedValue(fresh);
    const onClose = vi.fn();
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={IBREIA} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);
    await user.clear(within(drawer).getByTestId(`${D}-name`));
    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ibreia Pharma');
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    const reload = reloadAction();
    expect(reload.label).toBe('Reload');
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => reload.onClick());
    expect(fetchStockVendor).toHaveBeenCalledWith(IBREIA_ID);
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-name`)).toHaveValue('Ibreia Labs'),
    );
    expect(within(drawer).getByTestId(`${D}-phone`)).toHaveValue('98250 44120');

    // The next save is guarded by the fresh read.
    vi.mocked(updateStockVendor).mockResolvedValue(saved({ ...fresh }));
    await user.clear(within(drawer).getByTestId(`${D}-name`));
    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ibreia Pharma');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateStockVendor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        record: fresh,
        input: { name: 'Ibreia Pharma', phone: '+919825044120' },
      }),
    );
  });

  it('puts a name another vendor has on Name, and the server’s phone error on Phone', async () => {
    const user = setup();
    vi.mocked(createStockVendor)
      .mockRejectedValueOnce(
        refusal(409, {
          type: 'request_error',
          code: 'conflict',
          reason: 'record_already_exists',
          detail: 'A record with these details already exists',
        }),
      )
      .mockRejectedValueOnce(
        refusal(400, {
          type: 'validation_error',
          code: 'invalid_field',
          detail: 'Invalid values for fields in request',
          errors: [{ field: 'body.phone', message: 'Use +91 and ten digits' }],
        }),
      );
    const onClose = vi.fn();
    renderStockDrawer(<StockVendorDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ankur Pharma');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(within(drawer).getByTestId(`${D}-name`)).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    );
    expect(notifyMock.error).toHaveBeenCalledWith(
      'A vendor with this name already exists',
      { id: 'stock-vendor-save-failed' },
    );

    await user.clear(within(drawer).getByTestId(`${D}-name`));
    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ankur Traders');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(await within(drawer).findByText('Use +91 and ten digits')).toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-phone`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(notifyMock.error).toHaveBeenLastCalledWith('Use +91 and ten digits');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('deletes with a reason and closes; a refusal for dues says why and keeps it open', async () => {
    const user = setup();
    const blockText = renderHook(() => useStockDeleteBlockText()).result.current;
    vi.mocked(deleteStockVendor)
      .mockRejectedValueOnce(
        refusal(409, {
          type: 'request_error',
          code: 'conflict',
          reason: 'vendor_has_dues',
          detail:
            'A purchase from this vendor is not fully paid — pay or settle it first',
        }),
      )
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={IBREIA} open onClose={onClose} />,
    );
    const drawer = await screen.findByTestId(D);

    const confirmDelete = async () => {
      await user.click(await within(drawer).findByTestId(`${D}-delete`));
      const confirm = await screen.findByRole('alertdialog');
      expect(confirm).toHaveTextContent('Delete this clinic vendor?');
      await user.click(within(confirm).getByRole('radio', { name: 'Duplicate' }));
      await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    };

    await confirmDelete();
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(blockText('vendor_has_dues')),
    );
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();

    await confirmDelete();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteStockVendor).toHaveBeenLastCalledWith({
      id: IBREIA_ID,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Ibreia deleted', expect.anything());
  });

  it('opens view only for a member who may not edit stock', async () => {
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={IBREIA} open onClose={vi.fn()} />,
      { role: 'accountant' },
    );
    const drawer = await screen.findByTestId(D);
    await waitFor(() =>
      expect(within(drawer).queryByTestId(`${D}-save`)).not.toBeInTheDocument(),
    );
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('a Pharmacist edits but deletes nothing', async () => {
    renderStockDrawer(
      <>
        <AccessResolved />
        <StockVendorDrawer mode="edit" vendor={IBREIA} open onClose={vi.fn()} />
      </>,
      { role: 'pharmacist' },
    );
    const drawer = await screen.findByTestId(D);
    await screen.findByTestId('access-resolved');
    expect(within(drawer).getByTestId(`${D}-save`)).toBeInTheDocument();
    expect(within(drawer).queryByTestId(`${D}-delete`)).not.toBeInTheDocument();
  });

  it('waits for the vendor while its record loads', async () => {
    renderStockDrawer(
      <StockVendorDrawer mode="edit" vendor={undefined} open onClose={vi.fn()} />,
    );
    expect(await screen.findByTestId(D)).toHaveTextContent('Edit clinic vendor');
  });
});
