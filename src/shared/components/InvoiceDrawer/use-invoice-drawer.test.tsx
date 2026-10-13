import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_VESU_BRANCH_ID } from '@/tests/utils/invoice-doubles.ts';
import { medicineRow } from '@/tests/utils/medical-doubles.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

const { notifyMock, rxApi, invoiceApi, offersApi, membership } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  rxApi: { listPatientPrescriptions: vi.fn() },
  invoiceApi: { fetchInvoicePresets: vi.fn() },
  offersApi: { fetchAllOffers: vi.fn() },
  membership: { id: 'mem_me000000000000000000' as string | null },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...rxApi,
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...invoiceApi,
}));
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...offersApi,
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
import { salePrescriptionOf } from './sale-form.ts';
import {
  useBranchPrefill,
  useInvoiceStacks,
  usePrescriptionPrefill,
  useSaveToast,
  useTeamPrefill,
} from './use-invoice-drawer.ts';

const GLYCOLAC_ID = 'med_glycolac0000000000000';
const PRIYA_ID = 'pat_priya0000000000000000';

/** Glycolac Cream as the sale's catalogue lists it — 3 in stock at ₹162. */
const GLYCOLAC: InvoiceCatalogItem = medicineCatalogItem(
  medicineRow({
    id: GLYCOLAC_ID,
    name: 'Glycolac Cream',
    composition: 'Glycolic acid 6%',
    mrp: 162,
    stock: 3,
    nearExpiryDiscountPct: 20,
  }),
);

/** One line of a prescription, as the patient file writes it. */
const rxItem = (medicineId: string | null, medicineName: string, qty: number) => ({
  medicineId,
  medicineName,
  doseMorning: 1,
  doseAfternoon: 0,
  doseNight: 1,
  sos: false,
  meal: null,
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty,
  remarks: null,
});

/** Rx #500 for Priya, approved: Glycolac ×2, and a name the store does not list. */
const RX: PrescriptionRecord = {
  id: 'rx_rx5000000000000000000',
  seq: 500,
  patientId: PRIYA_ID,
  appointmentId: null,
  doctorId: 'mem_drashti00000000000000',
  date: '2026-10-10',
  items: [rxItem(GLYCOLAC_ID, 'Glycolac Cream', 2), rxItem(null, 'Flubolt 400', 1)],
  advice: null,
  labReport: null,
  procedureToday: null,
  followUpDate: null,
  status: 'approved',
  approvedAt: '2026-10-10T05:00:00.000Z',
  approvedById: 'mem_drashti00000000000000',
  createdAt: '2026-10-10T05:00:00.000Z',
  updatedAt: '2026-10-10T05:00:00.000Z',
};

/** Priya as the sale's prefilled patient, once read. */
const PRIYA: InvoicePartyForm = {
  kind: 'patient',
  id: PRIYA_ID,
  contactId: 'con_priya0000000000000000',
  name: 'Priya Shah',
  phone: null,
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
    ...Object.values(rxApi),
    ...Object.values(invoiceApi),
    ...Object.values(offersApi),
  ]) {
    fn.mockReset();
  }
  offersApi.fetchAllOffers.mockResolvedValue([]);
});
afterEach(() => client.clear());

describe('usePrescriptionPrefill — a sale from a prescription (clinozy-be’s)', () => {
  function render(
    values: InvoiceFormValues,
    catalog: InvoiceCatalogItem[] = [GLYCOLAC],
    prescriptionId: string | null = RX.id,
    patientId: string | null = PRIYA_ID,
  ) {
    return renderHook(
      ({ items }) => {
        const form = useForm<InvoiceFormValues>({ defaultValues: values });
        usePrescriptionPrefill(form, { prescriptionId, patientId, catalog: items });
        return form;
      },
      { wrapper, initialProps: { items: catalog } },
    );
  }

  it('bills its medicines in stock, names the Rx, and says which it could not find — the buyer kept', async () => {
    rxApi.listPatientPrescriptions.mockResolvedValue([RX]);
    const { result } = render(saleForm({ party: PRIYA }));

    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));
    expect(rxApi.listPatientPrescriptions).toHaveBeenCalledWith(PRIYA_ID);
    expect(result.current.getValues('items')).toEqual([
      expect.objectContaining({
        medicineId: GLYCOLAC_ID,
        name: 'Glycolac Cream',
        qty: 2,
      }),
    ]);
    expect(result.current.getValues('party')).toEqual(PRIYA);
    expect(notifyMock.info).toHaveBeenCalledOnce();
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Flubolt 400 not in the medicine list · add from the quick line',
    );
  });

  it('fills nothing from a draft — only an approved prescription is sold', async () => {
    rxApi.listPatientPrescriptions.mockResolvedValue([{ ...RX, status: 'draft' }]);
    const { result } = render(saleForm({ party: PRIYA }));

    await waitFor(() => expect(rxApi.listPatientPrescriptions).toHaveBeenCalled());
    expect(result.current.getValues('remark')).toBe('');
    expect(result.current.getValues('items')).toEqual([blankLine()]);
  });

  it('keeps the blank row when nothing it names is in the store', async () => {
    rxApi.listPatientPrescriptions.mockResolvedValue([
      { ...RX, items: [rxItem(null, 'Flubolt 400', 1)] },
    ]);
    const { result } = render(saleForm({ party: PRIYA }));

    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));
    expect(result.current.getValues('items')).toEqual([blankLine()]);
  });

  it('waits for the catalogue, then fills once — a later catalogue never refills', async () => {
    rxApi.listPatientPrescriptions.mockResolvedValue([RX]);
    const { result, rerender } = render(saleForm({ party: PRIYA }), []);

    await waitFor(() => expect(rxApi.listPatientPrescriptions).toHaveBeenCalled());
    expect(result.current.getValues('remark')).toBe('');

    rerender({ items: [GLYCOLAC] });
    await waitFor(() => expect(result.current.getValues('remark')).toBe('From Rx #500'));

    act(() => result.current.setValue('items', [blankLine()]));
    rerender({ items: [GLYCOLAC, { ...GLYCOLAC, key: 'med_other' }] });
    expect(result.current.getValues('items')).toEqual([blankLine()]);
    expect(notifyMock.info).toHaveBeenCalledOnce();
  });

  it('reads nothing without a prescription, or without a patient to read it among', () => {
    render(saleForm({ party: PRIYA }), [GLYCOLAC], null);
    render(saleForm(), [GLYCOLAC], RX.id, null);
    expect(rxApi.listPatientPrescriptions).not.toHaveBeenCalled();
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
    expect(rxApi.listPatientPrescriptions).not.toHaveBeenCalled();
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

  it('starts a sale’s "Prescribed by" with the member themself, with its patient’s latest approved Rx', async () => {
    rxApi.listPatientPrescriptions.mockResolvedValue([
      { ...RX, id: 'rx_rx5010000000000000000', seq: 501, status: 'draft' },
      RX,
    ]);
    const { result } = render({ values: saleForm(), sale: true, patientId: PRIYA_ID });

    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual([
        'mem_me000000000000000000',
      ]),
    );
    await waitFor(() =>
      expect(result.current.team.latestRx).toEqual(salePrescriptionOf(RX)),
    );
    expect(result.current.team.presets).toBeNull();
    expect(invoiceApi.fetchInvoicePresets).not.toHaveBeenCalled();
  });

  it('starts a walk-in sale with the member themself, reading no prescriptions', async () => {
    const { result } = render({ values: saleForm(), sale: true, patientId: null });
    await waitFor(() =>
      expect(result.current.form.getValues('teamIds')).toEqual([
        'mem_me000000000000000000',
      ]),
    );
    expect(result.current.team.latestRx).toBeNull();
    expect(rxApi.listPatientPrescriptions).not.toHaveBeenCalled();
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
