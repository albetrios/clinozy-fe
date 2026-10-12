import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { InvoiceRxPreset } from '@/shared/api/app/invoices-fixture-contracts.ts';
import type { MedicineRecord } from '@/shared/api/app/medicines-contracts.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_VESU_BRANCH_ID } from '@/tests/utils/invoice-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

const { notifyMock, saleApi, invoiceApi, offersApi, membership, staffApi } = vi.hoisted(
  () => ({
    notifyMock: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      undo: vi.fn(),
      dismiss: vi.fn(),
    },
    saleApi: { fetchPrescriptionPreset: vi.fn(), fetchSalePresets: vi.fn() },
    invoiceApi: { fetchInvoicePresets: vi.fn() },
    offersApi: { fetchAllOffers: vi.fn() },
    membership: { id: 'mem_me000000000000000000' as string | null },
    staffApi: { fetchFixtureMyStaff: vi.fn() },
  }),
);
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/invoices-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...saleApi,
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...invoiceApi,
}));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offersApi,
}));
vi.mock('@/shared/api/app/staff-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...staffApi,
}));
vi.mock('@/shared/hooks/useMyMembership/index.ts', () => ({
  useMyMembershipId: () => membership.id,
}));

import {
  blankLine,
  emptyInvoiceForm,
  type InvoiceFormValues,
  type InvoicePartyForm,
} from './invoice-form.ts';
import { type InvoiceCatalogItem, medicineCatalogItem } from './invoice-lines.ts';
import {
  useBranchPrefill,
  useInvoiceStacks,
  usePrescriptionPrefill,
  useSaveToast,
  useTeamPrefill,
} from './use-invoice-drawer.ts';

/** Glycolac Cream as the sale's catalogue lists it — 3 in stock at ₹162. */
const GLYCOLAC: InvoiceCatalogItem = medicineCatalogItem({
  id: 'med_glycolac',
  name: 'Glycolac Cream',
  composition: 'Glycolic acid 6%',
  mrp: 16_200,
  minStock: 2,
  nearExpiryDiscountPct: 20,
  batches: [{ batchNo: 'GL-1', qty: 3, expiry: '2027-06-30', rate: 9000 }],
} as unknown as MedicineRecord);

/** Rx #500 for Priya: Glycolac ×2, and a name the store does not list. */
const RX: InvoiceRxPreset = {
  id: 'rx_500',
  seq: 500,
  patientId: 'pat_priya',
  medicines: [
    { medicineId: 'med_glycolac', name: 'Glycolac Cream', qty: 2 },
    { medicineId: null, name: 'Flubolt 400', qty: 1 },
  ],
};

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const saleForm = (patch: Partial<InvoiceFormValues> = {}) => ({
  ...emptyInvoiceForm('2026-10-12', { type: 'medical' }),
  ...patch,
});

beforeEach(() => {
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  membership.id = 'mem_me000000000000000000';
  for (const fn of [
    ...Object.values(notifyMock),
    ...Object.values(saleApi),
    ...Object.values(invoiceApi),
    ...Object.values(offersApi),
    ...Object.values(staffApi),
  ]) {
    fn.mockReset();
  }
  offersApi.fetchAllOffers.mockResolvedValue([]);
  staffApi.fetchFixtureMyStaff.mockResolvedValue(null);
});
afterEach(() => client.clear());

describe('usePrescriptionPrefill — a sale from a prescription (fixture world)', () => {
  function render(
    values: InvoiceFormValues,
    catalog: InvoiceCatalogItem[] = [GLYCOLAC],
    prescriptionId: string | null = RX.id,
  ) {
    return renderHook(
      ({ items }) => {
        const form = useForm<InvoiceFormValues>({ defaultValues: values });
        usePrescriptionPrefill(form, prescriptionId, items);
        return form;
      },
      { wrapper, initialProps: { items: catalog } },
    );
  }

  it('bills its medicines in stock, names its patient and the Rx, and says which it could not find', async () => {
    saleApi.fetchPrescriptionPreset.mockResolvedValue(RX);
    const { result } = render(saleForm());

    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));
    expect(saleApi.fetchPrescriptionPreset).toHaveBeenCalledWith('rx_500');
    expect(result.current.getValues('items')).toEqual([
      expect.objectContaining({
        medicineId: 'med_glycolac',
        name: 'Glycolac Cream',
        qty: 2,
      }),
    ]);
    expect(result.current.getValues('party')).toEqual({
      kind: 'patient',
      id: 'pat_priya',
      contactId: null,
      name: '',
      phone: null,
    });
    expect(notifyMock.info).toHaveBeenCalledOnce();
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Flubolt 400 not in the medicine list · add from the quick line',
    );
  });

  it('keeps a customer already picked', async () => {
    saleApi.fetchPrescriptionPreset.mockResolvedValue(RX);
    const walkIn: InvoicePartyForm = {
      kind: 'contact',
      id: 'mcon_walkin',
      contactId: null,
      name: 'Walk-in',
      phone: null,
    };
    const { result } = render(saleForm({ party: walkIn }));

    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));
    expect(result.current.getValues('party')).toEqual(walkIn);
  });

  it('keeps the blank row when nothing it names is in the store', async () => {
    saleApi.fetchPrescriptionPreset.mockResolvedValue({
      ...RX,
      medicines: [{ medicineId: null, name: 'Flubolt 400', qty: 1 }],
    });
    const { result } = render(saleForm());

    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));
    expect(result.current.getValues('items')).toEqual([blankLine()]);
  });

  it('waits for the catalogue, then fills once — a later catalogue never refills', async () => {
    saleApi.fetchPrescriptionPreset.mockResolvedValue(RX);
    const { result, rerender } = render(saleForm(), []);

    await waitFor(() => expect(saleApi.fetchPrescriptionPreset).toHaveBeenCalled());
    expect(result.current.getValues('remark')).toBe('');

    rerender({ items: [GLYCOLAC] });
    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));

    act(() => result.current.setValue('items', [blankLine()]));
    rerender({ items: [GLYCOLAC, { ...GLYCOLAC, key: 'med_other' }] });
    expect(result.current.getValues('items')).toEqual([blankLine()]);
    expect(notifyMock.info).toHaveBeenCalledOnce();
  });

  it('reads nothing without a prescription', () => {
    render(saleForm(), [GLYCOLAC], null);
    expect(saleApi.fetchPrescriptionPreset).not.toHaveBeenCalled();
  });
});

describe('useTeamPrefill — the team a new invoice starts with', () => {
  function render({
    values,
    ownTeam = false,
    patientId = 'pat_priya',
    sale = false,
  }: {
    values: InvoiceFormValues;
    ownTeam?: boolean;
    patientId?: string | null;
    sale?: boolean;
  }) {
    return renderHook(
      () => {
        const form = useForm<InvoiceFormValues>({ defaultValues: values });
        return { form, team: useTeamPrefill({ form, ownTeam, patientId, sale }) };
      },
      { wrapper },
    );
  }

  it('takes the patient’s last invoice’s team on clinozy-be', async () => {
    invoiceApi.fetchInvoicePresets.mockResolvedValue({
      packages: [],
      lastByType: {},
      recentTeamIds: ['mem_rhea', 'mem_nisha'],
    });
    const { result } = render({ values: emptyInvoiceForm('2026-10-12') });

    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual(['mem_rhea', 'mem_nisha']),
    );
    expect(saleApi.fetchSalePresets).not.toHaveBeenCalled();
  });

  it('falls back to the member themself, and to nobody when they are unknown', async () => {
    const { result } = render({
      values: emptyInvoiceForm('2026-10-12'),
      patientId: null,
    });
    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual([
        'mem_me000000000000000000',
      ]),
    );

    membership.id = null;
    const unknown = render({ values: emptyInvoiceForm('2026-10-12'), patientId: null });
    expect(unknown.result.current.form.getValues('teamIds')).toEqual([]);
  });

  it('takes a sale’s team from the fixture world, with its patient’s latest Rx', async () => {
    saleApi.fetchSalePresets.mockResolvedValue({
      packages: [],
      lastByType: {},
      latestRx: RX,
      recentTeamIds: ['usr_staff_rhea'],
    });
    const { result } = render({ values: saleForm(), sale: true });

    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual(['usr_staff_rhea']),
    );
    expect(result.current.team.latestRx).toEqual(RX);
    expect(result.current.team.presets).toBeNull();
    expect(invoiceApi.fetchInvoicePresets).not.toHaveBeenCalled();
  });

  it('starts a walk-in sale’s team with the member’s own fixture staff record', async () => {
    staffApi.fetchFixtureMyStaff.mockResolvedValue({ id: 'usr_staff_me' });
    const { result } = render({ values: saleForm(), sale: true, patientId: null });
    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual(['usr_staff_me']),
    );
    expect(saleApi.fetchSalePresets).not.toHaveBeenCalled();
    expect(staffApi.fetchFixtureMyStaff).toHaveBeenCalledWith('member@clinic.test');
  });

  it('never replaces a team of its own, or one the member changed', async () => {
    invoiceApi.fetchInvoicePresets.mockResolvedValue({
      packages: [],
      lastByType: {},
      recentTeamIds: ['mem_rhea'],
    });
    const own = render({
      values: { ...emptyInvoiceForm('2026-10-12'), teamIds: ['mem_saved'] },
      ownTeam: true,
    });
    await waitFor(() => expect(invoiceApi.fetchInvoicePresets).toHaveBeenCalled());
    expect(own.result.current.form.getValues('teamIds')).toEqual(['mem_saved']);

    const touched = render({ values: emptyInvoiceForm('2026-10-12'), patientId: null });
    act(() => touched.result.current.team.touch());
    act(() => touched.result.current.form.setValue('teamIds', ['mem_picked']));
    expect(touched.result.current.form.getValues('teamIds')).toEqual(['mem_picked']);
  });
});

describe('useSaveToast — a save’s toast, then the host’s hand-off', () => {
  const outcome = (
    patch: Partial<Parameters<ReturnType<typeof useSaveToast>>[0]> = {},
  ) => ({
    invoiceId: 'inv_788',
    seq: 788,
    type: 'clinic' as const,
    planLinked: 0,
    ...patch,
  });

  function toast(kind: 'create' | 'copy' | 'edit') {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSaveToast(kind, onSaved));
    return { say: result.current, onSaved };
  }

  it('names a new invoice by its type, with the plan rows it billed', () => {
    const { say, onSaved } = toast('create');
    say(outcome());
    expect(notifyMock.success).toHaveBeenLastCalledWith('Clinic invoice #788 created');
    say(outcome({ type: 'consultation' }));
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Consultation invoice #788 created',
    );
    say(outcome({ type: 'medical' }));
    expect(notifyMock.success).toHaveBeenLastCalledWith('Medical invoice #788 created');
    say(outcome({ planLinked: 1 }));
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Clinic invoice #788 created · 1 offering suggestions item marked invoiced',
    );
    say(outcome({ planLinked: 2 }));
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Clinic invoice #788 created · 2 offering suggestions items marked invoiced',
    );
    expect(onSaved).toHaveBeenCalledTimes(5);
    expect(onSaved).toHaveBeenLastCalledWith(outcome({ planLinked: 2 }));
  });

  it('says a copy and an edit in their own words', () => {
    const copy = toast('copy');
    copy.say(outcome({ planLinked: 2 }));
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Copied as #788 · 2 offering suggestions items marked invoiced',
    );
    const edit = toast('edit');
    edit.say(outcome({ seq: 5 }));
    expect(notifyMock.success).toHaveBeenLastCalledWith('Invoice #5 saved');
    edit.say(outcome({ seq: 5, planLinked: 3 }));
    expect(notifyMock.success).toHaveBeenLastCalledWith(
      'Invoice #5 saved · offering suggestions updated',
    );
  });
});

describe('useBranchPrefill', () => {
  it('files a new invoice under the screen’s branch once known — never over one picked', () => {
    const { result, rerender } = renderHook(
      ({ branchId }) => {
        const form = useForm<InvoiceFormValues>({
          defaultValues: emptyInvoiceForm('2026-10-12'),
        });
        useBranchPrefill(form, branchId);
        return form;
      },
      { initialProps: { branchId: null as string | null } },
    );
    expect(result.current.getValues('branchId')).toBeNull();
    rerender({ branchId: TEST_VESU_BRANCH_ID });
    expect(result.current.getValues('branchId')).toBe(TEST_VESU_BRANCH_ID);
    rerender({ branchId: 'brn_other' });
    expect(result.current.getValues('branchId')).toBe(TEST_VESU_BRANCH_ID);
  });
});

describe('useInvoiceStacks — "New offering" from a row’s picker', () => {
  function render() {
    return renderHook(
      () => {
        const form = useForm<InvoiceFormValues>({
          defaultValues: {
            ...emptyInvoiceForm('2026-10-12', { branchId: TEST_VESU_BRANCH_ID }),
            items: [blankLine(), { ...blankLine(), qty: 3 }],
          },
        });
        return { form, stacks: useInvoiceStacks(form) };
      },
      { wrapper },
    );
  }

  it('fills the row it was opened from with the new offering, keeping its quantity', () => {
    const { result } = render();
    act(() => result.current.stacks.openNewOffering(1, 'Hydra'));
    expect(result.current.stacks.offering.isOpen).toBe(true);
    expect(result.current.stacks.offering.query).toBe('Hydra');

    act(() =>
      result.current.stacks.offering.complete(
        offeringRecord({ id: 'off_hydra', name: 'Hydrafacial' }),
      ),
    );

    expect(result.current.stacks.offering.isOpen).toBe(false);
    expect(result.current.form.getValues('items.1')).toMatchObject({
      offeringId: 'off_hydra',
      name: 'Hydrafacial',
      qty: 3,
    });
    expect(result.current.form.getValues('items.0')).toEqual(blankLine());
  });

  it('fills no row when none opened it', () => {
    const { result } = render();
    act(() => result.current.stacks.offering.complete(offeringRecord()));
    expect(result.current.form.getValues('items')).toEqual([
      blankLine(),
      { ...blankLine(), qty: 3 },
    ]);
  });

  it('sets the party, marking the form changed', () => {
    const { result } = render();
    const party: InvoicePartyForm = {
      kind: 'patient',
      id: 'pat_priya',
      contactId: 'con_priya',
      name: 'Priya Shah',
      phone: null,
    };
    act(() => result.current.stacks.setParty(party));
    expect(result.current.form.getValues('party')).toEqual(party);
    expect(result.current.form.getFieldState('party').isDirty).toBe(true);
  });
});
