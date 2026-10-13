import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  quickCreateMedicalRep: vi.fn(),
}));
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  mrRow,
  supplierRow,
  TEST_MAKER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../../medical-api.ts';
import { quickCreateMedicalRep } from '../../medical-records-api.ts';
import { useMedicalPickers } from './useMedicalPickers.ts';

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const ALVI_ID = 'mfr_alvi00000000000000000';
const RAVI_ID = 'mrep_ravi00000000000000000';

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  // SUN PHARMA (14 medicines) and ALVI (one); Ankur Pharma distributes SUN PHARMA, NH Pharma nothing.
  vi.mocked(fetchAllManufacturers).mockResolvedValue([
    manufacturerRow(),
    manufacturerRow({ id: ALVI_ID, name: 'ALVI', tone: 'lav', medicineCount: 1 }),
  ]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow({ name: 'Ankur Pharma' }),
    supplierRow({
      id: 'sup_nhpharma00000000000000',
      name: 'NH Pharma',
      phone: null,
      manufacturers: [],
      manufacturerIds: [],
    }),
  ]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([mrRow()]);
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('useMedicalPickers (medical.md:175, 182, 311–325)', () => {
  it('offers the makers as tone pills with their medicine counts', async () => {
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.manufacturers).toHaveLength(2));
    const alvi = result.current.manufacturers.find((option) => option.label === 'ALVI');
    expect(alvi).toMatchObject({
      tone: 'lav',
      leading: { kind: 'pill' },
      sub: '1 medicine',
    });
    expect(
      result.current.manufacturers.find((option) => option.key === TEST_MAKER_ID)?.sub,
    ).toBe('14 medicines');
  });

  it('groups the suppliers by the maker they distribute, phones as their sub line', async () => {
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.suppliers()).toHaveLength(2));
    const grouped = result.current.suppliers(TEST_MAKER_ID);
    expect(grouped.map((option) => [option.label, option.group])).toEqual([
      ['Ankur Pharma', 'Distributes SUN PHARMA'],
      ['NH Pharma', 'Other suppliers'],
    ]);
    expect(grouped[0]?.sub).toMatch(/^\+91 /);
    expect(grouped[1]?.sub).toBe('No phone yet');
    expect(result.current.suppliers().every((option) => option.group === undefined)).toBe(
      true,
    );
  });

  it('lists a quick record at once, and a stacked child’s until the catalogue has it', async () => {
    vi.mocked(quickCreateMedicalRep).mockResolvedValue(
      mrRow({ id: RAVI_ID, name: 'Ravi', phone: null, manufacturers: [] }),
    );
    const { result } = renderHook(useMedicalPickers, { wrapper });
    await waitFor(() => expect(result.current.mrs).toHaveLength(1));
    let id = '';
    await act(async () => {
      id = await result.current.addMr('Ravi');
    });
    expect(id).toBe(RAVI_ID);
    expect(notifyMock.success).toHaveBeenCalledWith('MR Ravi added');
    expect(result.current.mrs.find((option) => option.key === RAVI_ID)?.sub).toBe(
      'No phone yet',
    );

    act(() =>
      result.current.remember.supplier(
        supplierRow({ id: 'sup_stacked00000000000000', name: 'Om Pharma' }),
      ),
    );
    expect(
      result.current
        .suppliers()
        .some((option) => option.key === 'sup_stacked00000000000000'),
    ).toBe(true);
    act(() =>
      result.current.remember.manufacturer(
        manufacturerRow({ id: 'mfr_stacked00000000000000', name: 'ZEN' }),
      ),
    );
    expect(
      result.current.manufacturers.some(
        (option) => option.key === 'mfr_stacked00000000000000',
      ),
    ).toBe(true);
  });
});
